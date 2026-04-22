from fastapi import APIRouter, Depends, Query
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from datetime import datetime
import csv
import io
from fastapi.responses import StreamingResponse
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/gradebook", tags=["Gradebook"])


@router.get("/settings/{course_id}")
def get_grade_settings(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get grade weight settings for a course."""
    docs = list(
        db.collection(models.GRADE_SETTINGS)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .limit(1)
        .get()
    )
    if docs:
        s = models.doc_to_dict(docs[0])
        return {
            "assignment_weight": s.get("assignmentWeight", 60),
            "quiz_weight": s.get("quizWeight", 40),
        }
    return {"assignment_weight": 60, "quiz_weight": 40}


@router.post("/settings/{course_id}")
def update_grade_settings(
    course_id: str,
    assignment_weight: int = 60,
    quiz_weight: int = 40,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Set grade weight settings for a course."""
    docs = list(
        db.collection(models.GRADE_SETTINGS)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .limit(1)
        .get()
    )
    data = {
        "courseId": course_id,
        "assignmentWeight": assignment_weight,
        "quizWeight": quiz_weight,
    }
    if docs:
        docs[0].reference.update(data)
    else:
        sid = models.gen_id()
        db.collection(models.GRADE_SETTINGS).document(sid).set(data)
    return {"ok": True, "assignment_weight": assignment_weight, "quiz_weight": quiz_weight}


def _get_student_gradebook(db, student_id: str, course_id: str | None = None) -> list[schemas.CourseGradebook]:
    """Build gradebook for a student across enrolled courses."""
    if course_id:
        doc = db.collection(models.COURSES).document(course_id).get()
        c = models.doc_to_dict(doc)
        courses = [c] if c else []
    else:
        course_docs = (
            db.collection(models.COURSES)
            .where(filter=FieldFilter("enrolledStudents", "array_contains", student_id))
            .get()
        )
        courses = [models.doc_to_dict(d) for d in course_docs]

    results = []
    for course in courses:
        if not course:
            continue
        cid = course["id"]
        entries = []

        # Get assignment grades
        assignment_docs = (
            db.collection(models.ASSIGNMENTS)
            .where(filter=FieldFilter("courseId", "==", cid))
            .get()
        )
        for a_doc in assignment_docs:
            a = models.doc_to_dict(a_doc)
            if not a:
                continue
            # Get student's submission
            sub_docs = list(
                db.collection(models.SUBMISSIONS)
                .where(filter=FieldFilter("assignmentId", "==", a["id"]))
                .where(filter=FieldFilter("studentId", "==", student_id))
                .limit(1)
                .get()
            )
            sub = models.doc_to_dict(sub_docs[0]) if sub_docs else None
            entries.append(schemas.GradebookEntry(
                item_type="assignment",
                item_id=a["id"],
                title=a.get("title", ""),
                grade=sub.get("grade") if sub else None,
                total_points=100,
                percentage=sub.get("grade") if sub else None,
                feedback=sub.get("feedback") if sub else None,
                submitted_at=sub.get("submittedAt") if sub else None,
            ))

        # Get quiz grades
        quiz_docs = (
            db.collection(models.QUIZZES)
            .where(filter=FieldFilter("courseId", "==", cid))
            .get()
        )
        for q_doc in quiz_docs:
            q = models.doc_to_dict(q_doc)
            if not q:
                continue
            # Get student's attempt
            attempt_docs = list(
                db.collection(models.QUIZ_ATTEMPTS)
                .where(filter=FieldFilter("quizId", "==", q["id"]))
                .where(filter=FieldFilter("studentId", "==", student_id))
                .limit(1)
                .get()
            )
            attempt = models.doc_to_dict(attempt_docs[0]) if attempt_docs else None
            entries.append(schemas.GradebookEntry(
                item_type="quiz",
                item_id=q["id"],
                title=q.get("title", ""),
                grade=attempt.get("score") if attempt else None,
                total_points=attempt.get("totalPoints", 0) if attempt else 0,
                percentage=attempt.get("percentage") if attempt else None,
                feedback=None,
                submitted_at=attempt.get("submittedAt") if attempt else None,
            ))

        # Get grade weights
        settings_docs = list(
            db.collection(models.GRADE_SETTINGS)
            .where(filter=FieldFilter("courseId", "==", cid))
            .limit(1)
            .get()
        )
        if settings_docs:
            s = models.doc_to_dict(settings_docs[0])
            a_weight = s.get("assignmentWeight", 60) / 100
            q_weight = s.get("quizWeight", 40) / 100
        else:
            a_weight = 0.6
            q_weight = 0.4

        # Calculate weighted average
        a_graded = [e for e in entries if e.percentage is not None and e.item_type == "assignment"]
        q_graded = [e for e in entries if e.percentage is not None and e.item_type == "quiz"]
        a_avg = sum(e.percentage for e in a_graded) / len(a_graded) if a_graded else None
        q_avg = sum(e.percentage for e in q_graded) / len(q_graded) if q_graded else None

        if a_avg is not None and q_avg is not None:
            avg = a_avg * a_weight + q_avg * q_weight
        elif a_avg is not None:
            avg = a_avg
        elif q_avg is not None:
            avg = q_avg
        else:
            avg = None

        results.append(schemas.CourseGradebook(
            course_id=cid,
            course_name=course.get("courseName", ""),
            course_code=course.get("courseCode", ""),
            entries=entries,
            average=round(avg, 1) if avg is not None else None,
        ))

    return results


@router.get("/my", response_model=list[schemas.CourseGradebook])
def get_my_gradebook(
    course_id: str | None = Query(None),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Student: get your unified gradebook across all courses or for a specific course."""
    return _get_student_gradebook(db, user["id"], course_id)


@router.get("/course/{course_id}")
def get_course_gradebook(
    course_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Lecturer: get gradebook for all students in a course."""
    doc = db.collection(models.COURSES).document(course_id).get()
    course = models.doc_to_dict(doc)
    if not course or course.get("lecturerId") != user["id"]:
        return []

    student_ids = course.get("enrolledStudents", [])
    results = []
    for sid in student_ids:
        s_doc = db.collection(models.USERS).document(sid).get()
        s = models.doc_to_dict(s_doc)
        if not s:
            continue
        gradebook = _get_student_gradebook(db, sid, course_id)
        if gradebook:
            gb = gradebook[0].model_dump()
            gb["student_id"] = sid
            gb["student_name"] = s.get("displayName", "")
            gb["student_email"] = s.get("email", "")
            gb["student_photo_url"] = s.get("photoURL", "") or None
            results.append(gb)
    return results


@router.get("/student/{student_id}/course/{course_id}")
def get_student_report(
    student_id: str,
    course_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Lecturer: get detailed report for a specific student in a course."""
    # Grades
    gradebook = _get_student_gradebook(db, student_id, course_id)
    gb = gradebook[0].model_dump() if gradebook else None

    # Student info
    s_doc = db.collection(models.USERS).document(student_id).get()
    s = models.doc_to_dict(s_doc)

    # Attendance
    session_docs = db.collection(models.ATTENDANCE).where(filter=FieldFilter("courseId", "==", course_id)).get()
    total_sessions = 0
    present = 0
    late = 0
    for sess_doc in session_docs:
        sess = models.doc_to_dict(sess_doc)
        if not sess:
            continue
        total_sessions += 1
        rec_docs = list(
            db.collection(models.ATTENDANCE_RECORDS)
            .where(filter=FieldFilter("sessionId", "==", sess["id"]))
            .where(filter=FieldFilter("studentId", "==", student_id))
            .limit(1)
            .get()
        )
        if rec_docs:
            r = models.doc_to_dict(rec_docs[0])
            if r and r.get("status") == "present":
                present += 1
            elif r and r.get("status") == "late":
                late += 1

    # Activity count
    try:
        activity_docs = list(
            db.collection(models.ACTIVITY_FEED)
            .where(filter=FieldFilter("userId", "==", student_id))
            .limit(50)
            .get()
        )
        activity_count = len(activity_docs)
    except Exception:
        activity_count = 0

    # Peer reviews given/received
    reviews_given = len(list(
        db.collection(models.PEER_REVIEWS)
        .where(filter=FieldFilter("reviewerId", "==", student_id))
        .get()
    ))

    return {
        "student": {
            "id": student_id,
            "name": s.get("displayName", "") if s else "",
            "email": s.get("email", "") if s else "",
            "photo_url": s.get("photoURL", "") if s else "",
            "badges": s.get("badges", []) if s else [],
            "points": s.get("points", 0) if s else 0,
            "streak": s.get("streak", 0) if s else 0,
        },
        "gradebook": gb,
        "attendance": {
            "total_sessions": total_sessions,
            "present": present,
            "late": late,
            "absent": total_sessions - present - late,
            "percentage": round((present + late) / total_sessions * 100, 1) if total_sessions > 0 else 0,
        },
        "activity_count": activity_count,
        "reviews_given": reviews_given,
    }


@router.get("/course/{course_id}/export")
def export_course_gradebook(
    course_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Lecturer: export course gradebook as CSV."""
    doc = db.collection(models.COURSES).document(course_id).get()
    course = models.doc_to_dict(doc)
    if not course or course.get("lecturerId") != user["id"]:
        return {"error": "Course not found"}

    student_ids = course.get("enrolledStudents", [])

    # Collect all item titles
    all_items = []
    assignment_docs = db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("courseId", "==", course_id)).get()
    for a_doc in assignment_docs:
        a = models.doc_to_dict(a_doc)
        if a:
            all_items.append(("assignment", a["id"], a.get("title", "")))

    quiz_docs = db.collection(models.QUIZZES).where(filter=FieldFilter("courseId", "==", course_id)).get()
    for q_doc in quiz_docs:
        q = models.doc_to_dict(q_doc)
        if q:
            all_items.append(("quiz", q["id"], q.get("title", "")))

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    headers = ["Student Name", "Email"] + [f"{title} ({t})" for t, _, title in all_items] + ["Average"]
    writer.writerow(headers)

    for sid in student_ids:
        s_doc = db.collection(models.USERS).document(sid).get()
        s = models.doc_to_dict(s_doc)
        if not s:
            continue

        row = [s.get("displayName", ""), s.get("email", "")]
        grades = []

        for item_type, item_id, _ in all_items:
            if item_type == "assignment":
                sub_docs = list(
                    db.collection(models.SUBMISSIONS)
                    .where(filter=FieldFilter("assignmentId", "==", item_id))
                    .where(filter=FieldFilter("studentId", "==", sid))
                    .limit(1)
                    .get()
                )
                sub = models.doc_to_dict(sub_docs[0]) if sub_docs else None
                grade = sub.get("grade") if sub else None
            else:
                att_docs = list(
                    db.collection(models.QUIZ_ATTEMPTS)
                    .where(filter=FieldFilter("quizId", "==", item_id))
                    .where(filter=FieldFilter("studentId", "==", sid))
                    .limit(1)
                    .get()
                )
                att = models.doc_to_dict(att_docs[0]) if att_docs else None
                grade = att.get("percentage") if att else None

            row.append(str(round(grade, 1)) if grade is not None else "—")
            if grade is not None:
                grades.append(grade)

        avg = round(sum(grades) / len(grades), 1) if grades else "—"
        row.append(str(avg))
        writer.writerow(row)

    output.seek(0)
    course_name = course.get("courseName", "course").replace(" ", "_")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=gradebook_{course_name}.csv"},
    )
