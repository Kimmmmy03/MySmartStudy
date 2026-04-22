from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1 import ArrayUnion
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from ..audit import audit_log
from .activity import log_activity
from .auto_badges import check_and_award_badges as check_auto_badges
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/courses", tags=["Courses"])

# snake_case API field → camelCase Firestore field
_COURSE_FIELD_MAP = {
    "course_name": "courseName",
    "course_code": "courseCode",
    "theme_color": "themeColor",
}


def _course_out(c: dict) -> schemas.CourseOut:
    return schemas.CourseOut(
        id=c["id"],
        lecturer_id=c.get("lecturerId", ""),
        lecturer_name=c.get("lecturerName", ""),
        course_name=c.get("courseName", ""),
        course_code=c.get("courseCode", ""),
        semester=c.get("semester", "1"),
        join_code=c.get("joinCode", ""),
        description=c.get("description", ""),
        enrolled_count=len(c.get("enrolledStudents", [])),
        theme_color=c.get("themeColor", ""),
        pattern=c.get("pattern", ""),
        created_at=c.get("createdAt", datetime.now(timezone.utc)),
    )


def _to_firestore_fields(updates: dict) -> dict:
    return {_COURSE_FIELD_MAP.get(k, k): v for k, v in updates.items()}


def _gen_unique_join_code(db) -> str:
    for _ in range(10):
        code = models.gen_code()
        existing = db.collection(models.COURSES).where(filter=FieldFilter("joinCode", "==", code)).limit(1).get()
        if not list(existing):
            return code
    return models.gen_code()


@router.get("/teaching", response_model=list[schemas.CourseOut])
def get_teaching_courses(user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.COURSES)
        .where(filter=FieldFilter("lecturerId", "==", user["id"]))
        .order_by("createdAt", direction="DESCENDING")
        .get()
    )
    return [_course_out(models.doc_to_dict(d)) for d in docs]


@router.get("/enrolled", response_model=list[schemas.CourseOut])
def get_enrolled_courses(user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.COURSES)
        .where(filter=FieldFilter("enrolledStudents", "array_contains", user["id"]))
        .get()
    )
    return [_course_out(models.doc_to_dict(d)) for d in docs]


@router.post("/", response_model=schemas.CourseOut, status_code=201)
def create_course(req: schemas.CourseCreate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    course_id = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "lecturerId": user["id"],
        "lecturerName": user.get("displayName", ""),
        "courseName": req.course_name,
        "courseCode": req.course_code.upper(),
        "semester": req.semester,
        "joinCode": _gen_unique_join_code(db),
        "description": req.description,
        "themeColor": req.theme_color,
        "pattern": req.pattern,
        "enrolledStudents": [],
        "createdAt": now,
    }
    db.collection(models.COURSES).document(course_id).set(data)
    data["id"] = course_id

    # Auto-create 16 weekly modules
    for week in range(1, 17):
        mid = models.gen_id()
        db.collection(models.COURSE_MODULES).document(mid).set({
            "courseId": course_id,
            "title": f"Week {week}",
            "description": "",
            "createdAt": now,
            "order": week - 1,
        })

    audit_log(db, user["id"], "create", "course", course_id, f"Created course: {req.course_name}")
    return _course_out(data)


@router.get("/views/recent")
def get_recent_views(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Return the user's recently viewed courses, sorted by most recent."""
    docs = (
        db.collection(models.COURSE_VIEWS)
        .where(filter=FieldFilter("userId", "==", user["id"]))
        .order_by("viewedAt", direction="DESCENDING")
        .limit(20)
        .get()
    )
    return [{"course_id": d.to_dict().get("courseId"), "viewed_at": d.to_dict().get("viewedAt")} for d in docs]


@router.get("/{course_id}", response_model=schemas.CourseOut)
def get_course(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.COURSES).document(course_id).get()
    c = models.doc_to_dict(doc)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_out(c)


@router.patch("/{course_id}", response_model=schemas.CourseOut)
def update_course(course_id: str, req: schemas.CourseUpdate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc_ref = db.collection(models.COURSES).document(course_id)
    doc = doc_ref.get()
    c = models.doc_to_dict(doc)
    if not c or c.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Course not found")
    updates = req.model_dump(exclude_unset=True)
    fs_updates = _to_firestore_fields(updates)
    if "courseCode" in fs_updates:
        fs_updates["courseCode"] = fs_updates["courseCode"].upper()
    if fs_updates:
        doc_ref.update(fs_updates)
        c.update(fs_updates)
    return _course_out(c)


@router.delete("/{course_id}")
def delete_course(course_id: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc = db.collection(models.COURSES).document(course_id).get()
    c = models.doc_to_dict(doc)
    if not c or c.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Course not found")

    # Delete the course doc first so it disappears from lecturer/student queries immediately,
    # then cascade children in batched writes (up to 500 ops per batch).
    db.collection(models.COURSES).document(course_id).delete()
    audit_log(db, user["id"], "delete", "course", course_id)

    batch = db.batch()
    ops = 0

    def _flush_if_needed():
        nonlocal batch, ops
        if ops >= 450:
            batch.commit()
            batch = db.batch()
            ops = 0

    def _queue(ref):
        nonlocal ops
        batch.delete(ref)
        ops += 1
        _flush_if_needed()

    for a in db.collection(models.ANNOUNCEMENTS).where(filter=FieldFilter("courseId", "==", course_id)).get():
        _queue(a.reference)
    for d in db.collection(models.DISCUSSIONS).where(filter=FieldFilter("courseId", "==", course_id)).get():
        _queue(d.reference)
    for m in db.collection(models.COURSE_MODULES).where(filter=FieldFilter("courseId", "==", course_id)).get():
        for item in db.collection(models.MODULE_ITEMS).where(filter=FieldFilter("moduleId", "==", m.id)).get():
            _queue(item.reference)
        _queue(m.reference)
    for a in db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("courseId", "==", course_id)).get():
        for s in db.collection(models.SUBMISSIONS).where(filter=FieldFilter("assignmentId", "==", a.id)).get():
            _queue(s.reference)
        _queue(a.reference)
    for q in db.collection(models.QUIZZES).where(filter=FieldFilter("courseId", "==", course_id)).get():
        for qq in db.collection(models.QUIZ_QUESTIONS).where(filter=FieldFilter("quizId", "==", q.id)).get():
            _queue(qq.reference)
        for att in db.collection(models.QUIZ_ATTEMPTS).where(filter=FieldFilter("quizId", "==", q.id)).get():
            _queue(att.reference)
        _queue(q.reference)

    if ops > 0:
        batch.commit()

    return {"ok": True}


@router.post("/join", response_model=schemas.CourseOut)
def join_course(req: schemas.JoinCourseRequest, user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = db.collection(models.COURSES).where(filter=FieldFilter("joinCode", "==", req.join_code.upper())).limit(1).get()
    results = list(docs)
    if not results:
        raise HTTPException(status_code=404, detail="Invalid join code")
    c = models.doc_to_dict(results[0])
    if user["id"] in c.get("enrolledStudents", []):
        raise HTTPException(status_code=400, detail="Already enrolled")
    db.collection(models.COURSES).document(c["id"]).update(
        {"enrolledStudents": ArrayUnion([user["id"]])}
    )
    c.setdefault("enrolledStudents", []).append(user["id"])
    log_activity(db, user["id"], "joined", "course", c["id"], c.get("courseName", ""))
    try:
        check_auto_badges(db, user["id"])
    except Exception:
        pass
    return _course_out(c)


@router.get("/{course_id}/students", response_model=list[schemas.UserOut])
def get_course_students(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.COURSES).document(course_id).get()
    c = models.doc_to_dict(doc)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    student_ids = c.get("enrolledStudents", [])
    result = []
    for sid in student_ids:
        sdoc = db.collection(models.USERS).document(sid).get()
        s = models.doc_to_dict(sdoc)
        if s:
            result.append(schemas.UserOut(
                id=s["id"], email=s.get("email", ""),
                display_name=s.get("displayName", ""), role=s.get("role", "student"),
                class_name=s.get("className", ""), photo_url=s.get("photoURL", ""),
                year=s.get("year"), semester=s.get("semester"),
                department=s.get("department"),
                points=s.get("points", 0), streak=s.get("streak", 0),
                badges=s.get("badges", []),
                created_at=s.get("createdAt", datetime.now(timezone.utc)),
            ))
    return result


@router.post("/{course_id}/view")
def mark_course_viewed(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Stamp that the current user just viewed this course."""
    doc_id = f"{user['id']}_{course_id}"
    db.collection(models.COURSE_VIEWS).document(doc_id).set({
        "userId": user["id"],
        "courseId": course_id,
        "viewedAt": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@router.get("/search/students", response_model=list[schemas.UserOut])
def search_students(q: str = "", user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Search students by email or display name (for manual enrollment)."""
    if not q or len(q) < 2:
        return []
    q_lower = q.lower()
    # Search by email (exact prefix match)
    results = []
    seen_ids = set()
    # Try email match
    email_docs = (
        db.collection(models.USERS)
        .where(filter=FieldFilter("role", "==", "student"))
        .order_by("email")
        .start_at({"email": q_lower})
        .end_at({"email": q_lower + "\uf8ff"})
        .limit(10)
        .get()
    )
    for d in email_docs:
        s = models.doc_to_dict(d)
        if s and s["id"] not in seen_ids:
            seen_ids.add(s["id"])
            results.append(schemas.UserOut(
                id=s["id"], email=s.get("email", ""),
                display_name=s.get("displayName", ""), role=s.get("role", "student"),
                class_name=s.get("className", ""), photo_url=s.get("photoURL", ""),
                year=s.get("year"), semester=s.get("semester"),
                department=s.get("department"),
                points=s.get("points", 0), streak=s.get("streak", 0),
                badges=s.get("badges", []),
                created_at=s.get("createdAt", datetime.now(timezone.utc)),
            ))
    # Also search by display name
    name_docs = (
        db.collection(models.USERS)
        .where(filter=FieldFilter("role", "==", "student"))
        .order_by("displayName")
        .start_at({"displayName": q})
        .end_at({"displayName": q + "\uf8ff"})
        .limit(10)
        .get()
    )
    for d in name_docs:
        s = models.doc_to_dict(d)
        if s and s["id"] not in seen_ids:
            seen_ids.add(s["id"])
            results.append(schemas.UserOut(
                id=s["id"], email=s.get("email", ""),
                display_name=s.get("displayName", ""), role=s.get("role", "student"),
                class_name=s.get("className", ""), photo_url=s.get("photoURL", ""),
                year=s.get("year"), semester=s.get("semester"),
                department=s.get("department"),
                points=s.get("points", 0), streak=s.get("streak", 0),
                badges=s.get("badges", []),
                created_at=s.get("createdAt", datetime.now(timezone.utc)),
            ))
    return results[:10]


@router.post("/{course_id}/add-student")
def add_student_to_course(course_id: str, body: dict, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Manually add a student to a course by their user ID."""
    student_id = body.get("student_id")
    if not student_id:
        raise HTTPException(status_code=400, detail="student_id is required")
    # Verify course exists and belongs to lecturer
    doc = db.collection(models.COURSES).document(course_id).get()
    c = models.doc_to_dict(doc)
    if not c or c.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Course not found")
    # Verify student exists
    sdoc = db.collection(models.USERS).document(student_id).get()
    s = models.doc_to_dict(sdoc)
    if not s or s.get("role") != "student":
        raise HTTPException(status_code=404, detail="Student not found")
    # Check already enrolled
    if student_id in c.get("enrolledStudents", []):
        raise HTTPException(status_code=400, detail="Student already enrolled")
    # Add student
    db.collection(models.COURSES).document(course_id).update(
        {"enrolledStudents": ArrayUnion([student_id])}
    )
    return {"ok": True, "student_id": student_id}
