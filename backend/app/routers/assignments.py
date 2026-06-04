from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from ..authz import assert_course_owner, assert_assignment_owner
from ..audit import audit_log
from .activity import log_activity
from .notifications import create_notification
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])

# snake_case API field → camelCase Firestore field
_SUB_FIELD_MAP = {
    "submission_type": "submissionType",
    "map_id": "mapId",
    "external_link": "externalLink",
    "file_url": "fileUrl",
    "file_name": "fileName",
}


def _assignment_out(a: dict, db=None) -> schemas.AssignmentOut:
    prerequisite_title = None
    prereq_id = a.get("prerequisiteId")
    if prereq_id and db:
        prereq_doc = db.collection(models.ASSIGNMENTS).document(prereq_id).get()
        p = models.doc_to_dict(prereq_doc)
        if p:
            prerequisite_title = p.get("title", "")
    return schemas.AssignmentOut(
        id=a["id"],
        lecturer_id=a.get("lecturerId", ""),
        course_id=a.get("courseId", ""),
        title=a.get("title", ""),
        description=a.get("description", ""),
        deadline=a.get("deadline", ""),
        allowed_map_types=a.get("allowedMapTypes", []),
        available_from=a.get("availableFrom"),
        available_until=a.get("availableUntil"),
        prerequisite_id=prereq_id,
        prerequisite_title=prerequisite_title,
        min_grade=a.get("minGrade"),
        assignment_type=a.get("assignmentType", "assignment"),
        quiz_id=a.get("quizId"),
        attachments=a.get("attachments", []),
        peer_review_enabled=a.get("peerReviewEnabled", False),
        created_at=a.get("createdAt", datetime.now(timezone.utc)),
    )


def _submission_out(s: dict, photo_url: str | None = None) -> schemas.SubmissionOut:
    return schemas.SubmissionOut(
        id=s["id"],
        assignment_id=s.get("assignmentId", ""),
        student_id=s.get("studentId", ""),
        student_name=s.get("studentName", ""),
        student_photo_url=photo_url if photo_url is not None else s.get("studentPhotoUrl"),
        submission_type=s.get("submissionType", "map"),
        map_id=s.get("mapId"),
        external_link=s.get("externalLink"),
        file_url=s.get("fileUrl"),
        file_name=s.get("fileName"),
        comments=s.get("comments", ""),
        grade=s.get("grade"),
        feedback=s.get("feedback"),
        submitted_at=s.get("submittedAt", datetime.now(timezone.utc)),
    )


def _to_sub_firestore(updates: dict) -> dict:
    return {_SUB_FIELD_MAP.get(k, k): v for k, v in updates.items()}


@router.get("/my-upcoming")
def my_upcoming_assignments(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get all upcoming assignments for the current student across enrolled courses."""
    now = datetime.now(timezone.utc).isoformat()

    # Get courses where this student is enrolled
    course_docs = (
        db.collection(models.COURSES)
        .where(filter=FieldFilter("enrolledStudents", "array_contains", user["id"]))
        .get()
    )

    results = []
    for c_doc in course_docs:
        c = models.doc_to_dict(c_doc)
        if not c:
            continue
        course_name = c.get("courseName", "")
        course_id = c["id"]

        # Get assignments for this course
        a_docs = (
            db.collection(models.ASSIGNMENTS)
            .where(filter=FieldFilter("courseId", "==", course_id))
            .get()
        )
        for a_doc in a_docs:
            a = models.doc_to_dict(a_doc)
            if not a:
                continue
            deadline = a.get("deadline", "")
            if deadline and deadline >= now:
                # Check if student already submitted
                sub_docs = list(
                    db.collection(models.SUBMISSIONS)
                    .where(filter=FieldFilter("assignmentId", "==", a["id"]))
                    .where(filter=FieldFilter("studentId", "==", user["id"]))
                    .limit(1)
                    .get()
                )
                out = _assignment_out(a).model_dump()
                out["course_name"] = course_name
                out["submitted"] = len(sub_docs) > 0
                results.append(out)

    results.sort(key=lambda x: x.get("deadline", ""))
    return results


@router.get("/", response_model=list[schemas.AssignmentOut])
def get_assignments(course_id: str = Query(...), user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.ASSIGNMENTS)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .order_by("deadline")
        .get()
    )
    return [_assignment_out(models.doc_to_dict(d), db) for d in docs]


@router.get("/{aid}/similarity-report")
def get_similarity_report(aid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Run TF-IDF similarity check on all submissions for this assignment."""
    assert_assignment_owner(db, aid, user)
    from ..similarity import compute_similarity_report
    return compute_similarity_report(db, aid)


@router.get("/{aid}/full-plagiarism-report")
def get_full_plagiarism_report(aid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Generate a comprehensive plagiarism report across all submission types."""
    assert_assignment_owner(db, aid, user)
    try:
        from ..similarity import compute_full_plagiarism_report
        result = compute_full_plagiarism_report(db, aid)
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _pair_key(a_id: str, b_id: str) -> str:
    """Order-independent key so a flagged pair maps to one review regardless of side."""
    return "__".join(sorted([a_id or "", b_id or ""]))


class PlagiarismReviewIn(BaseModel):
    student_a_id: str
    student_b_id: str
    status: str  # "pending" | "confirmed" | "dismissed"
    note: str | None = None


@router.get("/{aid}/plagiarism-reviews")
def get_plagiarism_reviews(aid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Return the lecturer's review decisions for this assignment, keyed by pair_key."""
    assert_assignment_owner(db, aid, user)
    docs = db.collection(models.PLAGIARISM_REVIEWS).where(
        filter=FieldFilter("assignmentId", "==", aid)
    ).get()
    out: dict = {}
    for d in docs:
        r = models.doc_to_dict(d)
        if not r:
            continue
        out[r.get("pairKey", "")] = {
            "status": r.get("status", "pending"),
            "note": r.get("note", ""),
            "reviewer_name": r.get("reviewerName", ""),
            "reviewed_at": r.get("reviewedAt", ""),
        }
    return out


@router.post("/{aid}/plagiarism-review")
def review_plagiarism_pair(aid: str, body: PlagiarismReviewIn, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Record a human-in-the-loop decision on a flagged pair (confirm / dismiss / reset).

    This is the audit trail that turns an automated similarity flag into a
    reviewed academic-integrity finding — required before any action is taken.
    """
    if body.status not in ("pending", "confirmed", "dismissed"):
        raise HTTPException(400, "Invalid status")
    assert_assignment_owner(db, aid, user)

    pair_key = _pair_key(body.student_a_id, body.student_b_id)
    doc_id = f"{aid}|{pair_key}"
    reviewer_name = user.get("displayName") or user.get("name") or user.get("email") or "Lecturer"
    record = {
        "assignmentId": aid,
        "pairKey": pair_key,
        "studentAId": body.student_a_id,
        "studentBId": body.student_b_id,
        "status": body.status,
        "note": body.note or "",
        "reviewerId": user["id"],
        "reviewerName": reviewer_name,
        "reviewedAt": datetime.now(timezone.utc).isoformat(),
    }
    db.collection(models.PLAGIARISM_REVIEWS).document(doc_id).set(record)
    audit_log(db, user["id"], "plagiarism_review", "assignment", aid,
              details=f"pair={pair_key} status={body.status}")
    return {"ok": True, "pair_key": pair_key}


@router.get("/pending-reviews")
def get_pending_reviews(user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Get assignments with ungraded submissions for this lecturer."""
    assignments = db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()
    results = []
    for a_doc in assignments:
        a = models.doc_to_dict(a_doc)
        subs = db.collection(models.SUBMISSIONS).where(filter=FieldFilter("assignmentId", "==", a["id"])).get()
        ungraded = [s for s in subs if models.doc_to_dict(s).get("grade") is None]
        if ungraded:
            results.append({
                "assignment": _assignment_out(a).model_dump(),
                "ungraded_count": len(ungraded),
                "total_submissions": len(list(subs)),
            })
    return results


@router.get("/by-lecturer", response_model=list[schemas.AssignmentOut])
def get_lecturer_assignments(user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()
    return [_assignment_out(models.doc_to_dict(d)) for d in docs]


@router.post("/", response_model=schemas.AssignmentOut, status_code=201)
def create_assignment(req: schemas.AssignmentCreate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    aid = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "lecturerId": user["id"],
        "courseId": req.course_id,
        "title": req.title,
        "description": req.description,
        "deadline": req.deadline,
        "allowedMapTypes": req.allowed_map_types,
        "createdAt": now,
    }
    if req.available_from:
        data["availableFrom"] = req.available_from
    if req.available_until:
        data["availableUntil"] = req.available_until
    if req.prerequisite_id:
        data["prerequisiteId"] = req.prerequisite_id
    if req.min_grade is not None:
        data["minGrade"] = req.min_grade
    if req.assignment_type:
        data["assignmentType"] = req.assignment_type
    if req.quiz_id:
        data["quizId"] = req.quiz_id
    if req.attachments:
        data["attachments"] = [att.model_dump() for att in req.attachments]
    if req.peer_review_enabled:
        data["peerReviewEnabled"] = True
    db.collection(models.ASSIGNMENTS).document(aid).set(data)
    data["id"] = aid
    audit_log(db, user["id"], "create", "assignment", aid, f"Created assignment: {req.title}")

    # Notify enrolled students (best-effort; never blocks the create)
    try:
        c_doc = db.collection(models.COURSES).document(req.course_id).get()
        c = models.doc_to_dict(c_doc) or {}
        course_name = c.get("courseName", "")
        link = f"/student/course/{req.course_id}/assignments"
        for sid in c.get("enrolledStudents", []) or []:
            create_notification(
                db,
                user_id=sid,
                title=f"New assignment: {req.title}",
                message=f"{course_name} — due {req.deadline}.",
                notification_type="assignment",
                link=link,
            )
    except Exception:
        pass

    return _assignment_out(data, db)


_ASSIGN_FIELD_MAP = {
    "available_from": "availableFrom",
    "available_until": "availableUntil",
    "prerequisite_id": "prerequisiteId",
    "min_grade": "minGrade",
    "allowed_map_types": "allowedMapTypes",
    "course_id": "courseId",
    "assignment_type": "assignmentType",
    "quiz_id": "quizId",
    "attachments": "attachments",
    "peer_review_enabled": "peerReviewEnabled",
}

@router.patch("/{aid}", response_model=schemas.AssignmentOut)
def update_assignment(aid: str, req: schemas.AssignmentUpdate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc_ref = db.collection(models.ASSIGNMENTS).document(aid)
    doc = doc_ref.get()
    a = models.doc_to_dict(doc)
    if not a or a.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Assignment not found")
    updates = req.model_dump(exclude_unset=True)
    if updates:
        fs_updates = {_ASSIGN_FIELD_MAP.get(k, k): v for k, v in updates.items()}
        doc_ref.update(fs_updates)
        a.update(fs_updates)
    return _assignment_out(a, db)


@router.delete("/{aid}")
def delete_assignment(aid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc = db.collection(models.ASSIGNMENTS).document(aid).get()
    a = models.doc_to_dict(doc)
    if not a or a.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Assignment not found")
    # Cascading delete submissions
    for s in db.collection(models.SUBMISSIONS).where(filter=FieldFilter("assignmentId", "==", aid)).get():
        s.reference.delete()
    db.collection(models.ASSIGNMENTS).document(aid).delete()
    audit_log(db, user["id"], "delete", "assignment", aid)
    return {"ok": True}


@router.post("/{aid}/attachments/upload")
async def upload_assignment_attachment(
    aid: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Upload a file attachment (PDF, image, etc.) for an assignment."""
    import os

    doc = db.collection(models.ASSIGNMENTS).document(aid).get()
    a = models.doc_to_dict(doc)
    if not a or a.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Assignment not found")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")

    course_id = a.get("courseId", "unknown")
    dir_path = f"uploads/assignments/{course_id}/{aid}"
    os.makedirs(dir_path, exist_ok=True)
    filename = file.filename or "file"
    full_path = os.path.join(dir_path, filename)
    with open(full_path, "wb") as f:
        f.write(content)

    file_url = f"/api/files/{dir_path}/{filename}"

    # Detect type from extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("pdf",):
        file_type = "pdf"
    elif ext in ("png", "jpg", "jpeg", "gif", "webp", "svg"):
        file_type = "image"
    else:
        file_type = "file"

    return {"ok": True, "url": file_url, "name": filename, "type": file_type}


@router.get("/{aid}/access-check")
def check_access(aid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Check if the current student can access/submit to this assignment."""
    doc = db.collection(models.ASSIGNMENTS).document(aid).get()
    a = models.doc_to_dict(doc)
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    now = datetime.now(timezone.utc).isoformat()
    reasons = []

    # Date restrictions
    avail_from = a.get("availableFrom")
    avail_until = a.get("availableUntil")
    if avail_from and now < avail_from:
        reasons.append(f"Not available until {avail_from}")
    if avail_until and now > avail_until:
        reasons.append("Availability period has ended")

    # Prerequisite check
    prereq_id = a.get("prerequisiteId")
    if prereq_id:
        min_grade = a.get("minGrade", 0)
        sub_docs = list(
            db.collection(models.SUBMISSIONS)
            .where(filter=FieldFilter("assignmentId", "==", prereq_id))
            .where(filter=FieldFilter("studentId", "==", user["id"]))
            .limit(1)
            .get()
        )
        if not sub_docs:
            prereq_doc = db.collection(models.ASSIGNMENTS).document(prereq_id).get()
            p = models.doc_to_dict(prereq_doc)
            prereq_title = p.get("title", "prerequisite") if p else "prerequisite"
            reasons.append(f"Must complete \"{prereq_title}\" first")
        elif min_grade and min_grade > 0:
            sub = models.doc_to_dict(sub_docs[0])
            grade = sub.get("grade")
            if grade is None or grade < min_grade:
                reasons.append(f"Must achieve at least {min_grade}% on prerequisite")

    return {"accessible": len(reasons) == 0, "reasons": reasons}


# ── Submissions ──
@router.get("/{aid}/submissions", response_model=list[schemas.SubmissionOut])
def get_submissions(aid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    # Object-level authz: only the lecturer who owns this assignment's course
    # (or an admin) may read the full submission list. Students use
    # /submissions/mine, which is scoped to their own studentId.
    assert_assignment_owner(db, aid, user)
    docs = db.collection(models.SUBMISSIONS).where(filter=FieldFilter("assignmentId", "==", aid)).get()
    items = [models.doc_to_dict(d) for d in docs]
    photo_map = models.get_user_photo_urls(db, [s.get("studentId") for s in items])
    return [_submission_out(s, photo_map.get(s.get("studentId"))) for s in items]


@router.get("/{aid}/submissions/mine", response_model=schemas.SubmissionOut | None)
def get_my_submission(aid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.SUBMISSIONS)
        .where(filter=FieldFilter("assignmentId", "==", aid))
        .where(filter=FieldFilter("studentId", "==", user["id"]))
        .limit(1)
        .get()
    )
    results = list(docs)
    if not results:
        return None
    s = models.doc_to_dict(results[0])
    return _submission_out(s, models.get_user_photo_url(db, s.get("studentId", "")))


@router.post("/{aid}/submissions", response_model=schemas.SubmissionOut, status_code=201)
def submit(aid: str, req: schemas.SubmissionCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    # Check for existing submission (upsert)
    existing_docs = (
        db.collection(models.SUBMISSIONS)
        .where(filter=FieldFilter("assignmentId", "==", aid))
        .where(filter=FieldFilter("studentId", "==", user["id"]))
        .limit(1)
        .get()
    )
    existing = list(existing_docs)

    if existing:
        doc_ref = existing[0].reference
        updates = req.model_dump(exclude_unset=True)
        fs_updates = _to_sub_firestore(updates)
        fs_updates["submittedAt"] = datetime.now(timezone.utc)
        doc_ref.update(fs_updates)
        s = models.doc_to_dict(existing[0])
        s.update(fs_updates)
        return _submission_out(s, models.get_user_photo_url(db, s.get("studentId", "")))

    sid = models.gen_id()
    now = datetime.now(timezone.utc)
    photo_url = models.get_user_photo_url(db, user["id"])
    data = {
        "assignmentId": aid,
        "studentId": user["id"],
        "studentName": user.get("displayName", ""),
        "studentPhotoUrl": photo_url,
        "submissionType": req.submission_type,
        "mapId": req.map_id,
        "externalLink": req.external_link,
        "comments": req.comments,
        "grade": None,
        "feedback": None,
        "submittedAt": now,
    }
    db.collection(models.SUBMISSIONS).document(sid).set(data)
    data["id"] = sid
    log_activity(db, user["id"], "submitted", "assignment", aid, "")
    # Auto-badge check (non-blocking)
    try:
        from .auto_badges import check_and_award_badges
        check_and_award_badges(db, user["id"])
    except Exception:
        pass
    return _submission_out(data, photo_url)


@router.post("/{aid}/submissions/upload")
async def upload_submission(
    aid: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Upload a file submission with magic number validation."""
    from ..file_validation import validate_file
    import os

    content = await file.read()
    is_valid, error = validate_file(content, file.filename or "unknown")
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Get course_id from assignment
    a_doc = db.collection(models.ASSIGNMENTS).document(aid).get()
    a = models.doc_to_dict(a_doc)
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    course_id = a.get("courseId", "unknown")
    file_path = f"uploads/submissions/{course_id}/{aid}/{user['id']}"
    os.makedirs(file_path, exist_ok=True)
    full_path = os.path.join(file_path, file.filename or "file")
    with open(full_path, "wb") as f:
        f.write(content)

    file_url = f"/{full_path}"

    # Create or update submission
    existing_docs = (
        db.collection(models.SUBMISSIONS)
        .where(filter=FieldFilter("assignmentId", "==", aid))
        .where(filter=FieldFilter("studentId", "==", user["id"]))
        .limit(1)
        .get()
    )
    existing = list(existing_docs)
    now = datetime.now(timezone.utc)

    if existing:
        doc_ref = existing[0].reference
        doc_ref.update({
            "submissionType": "file",
            "fileUrl": file_url,
            "fileName": file.filename,
            "submittedAt": now,
        })
        s = models.doc_to_dict(existing[0])
        s.update({"submissionType": "file", "fileUrl": file_url, "fileName": file.filename, "submittedAt": now})
        return {"ok": True, "file_url": file_url, "submission_id": s["id"]}

    sid = models.gen_id()
    data = {
        "assignmentId": aid,
        "studentId": user["id"],
        "studentName": user.get("displayName", ""),
        "studentPhotoUrl": models.get_user_photo_url(db, user["id"]),
        "submissionType": "file",
        "fileUrl": file_url,
        "fileName": file.filename,
        "mapId": None,
        "externalLink": None,
        "comments": "",
        "grade": None,
        "feedback": None,
        "submittedAt": now,
    }
    db.collection(models.SUBMISSIONS).document(sid).set(data)
    return {"ok": True, "file_url": file_url, "submission_id": sid}


@router.patch("/{aid}/submissions/{sid}/grade", response_model=schemas.SubmissionOut)
def grade_submission(aid: str, sid: str, req: schemas.SubmissionGrade, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc_ref = db.collection(models.SUBMISSIONS).document(sid)
    doc = doc_ref.get()
    s = models.doc_to_dict(doc)
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")
    doc_ref.update({"grade": req.grade, "feedback": req.feedback})
    s["grade"] = req.grade
    s["feedback"] = req.feedback
    return _submission_out(s, models.get_user_photo_url(db, s.get("studentId", "")))


class BulkGradeItem(BaseModel):
    submission_id: str
    grade: float
    feedback: str = ""


class BulkGradeRequest(BaseModel):
    grades: list[BulkGradeItem]


@router.post("/{aid}/submissions/bulk-grade")
def bulk_grade(aid: str, req: BulkGradeRequest, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Bulk-update grades for multiple submissions at once."""
    updated = 0
    for item in req.grades:
        doc_ref = db.collection(models.SUBMISSIONS).document(item.submission_id)
        doc = doc_ref.get()
        if doc.exists:
            doc_ref.update({"grade": item.grade, "feedback": item.feedback})
            updated += 1
    return {"ok": True, "updated": updated}


@router.post("/{aid}/release-grades")
def release_grades(aid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Mark grades as released so students can see them. Sets releasedAt on the assignment."""
    doc_ref = db.collection(models.ASSIGNMENTS).document(aid)
    doc = doc_ref.get()
    a = models.doc_to_dict(doc)
    if not a or a.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Assignment not found")
    now = datetime.now(timezone.utc).isoformat()
    doc_ref.update({"gradesReleased": True, "gradesReleasedAt": now})

    # Notify students who have submissions
    subs = db.collection(models.SUBMISSIONS).where(filter=FieldFilter("assignmentId", "==", aid)).get()
    title = a.get("title", "Assignment")
    for s_doc in subs:
        s = models.doc_to_dict(s_doc)
        if s and s.get("grade") is not None:
            nid = models.gen_id()
            db.collection(models.NOTIFICATIONS).document(nid).set({
                "userId": s["studentId"],
                "title": "Grades Released",
                "message": f"Your grade for '{title}' is now available.",
                "type": "grade",
                "read": False,
                "createdAt": now,
            })

    return {"ok": True, "released_at": now}
