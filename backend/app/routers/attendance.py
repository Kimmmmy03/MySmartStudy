from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from ..audit import audit_log
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.get("/course/{course_id}")
def get_attendance_sessions(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get all attendance sessions for a course."""
    try:
        docs = (
            db.collection(models.ATTENDANCE)
            .where(filter=FieldFilter("courseId", "==", course_id))
            .order_by("date", direction="DESCENDING")
            .get()
        )
    except Exception:
        docs = db.collection(models.ATTENDANCE).where(filter=FieldFilter("courseId", "==", course_id)).get()

    results = []
    for d in docs:
        session = models.doc_to_dict(d)
        if not session:
            continue

        # Get records for this session
        rec_docs = db.collection(models.ATTENDANCE_RECORDS).where(filter=FieldFilter("sessionId", "==", session["id"])).get()
        records = []
        present = 0
        total = 0
        for r_doc in rec_docs:
            r = models.doc_to_dict(r_doc)
            if r:
                total += 1
                if r.get("status") == "present":
                    present += 1
                # Get student name + photo
                s_doc = db.collection(models.USERS).document(r.get("studentId", "")).get()
                s = models.doc_to_dict(s_doc)
                records.append({
                    "student_id": r.get("studentId", ""),
                    "student_name": s.get("displayName", "") if s else "",
                    "student_photo": s.get("photoURL", "") if s else "",
                    "status": r.get("status", "absent"),
                    "scanned_at": r.get("scannedAt"),
                })

        results.append({
            "id": session["id"],
            "course_id": course_id,
            "date": session.get("date", ""),
            "title": session.get("title", ""),
            "start_time": session.get("startTime", ""),
            "end_time": session.get("endTime", ""),
            "qr_token": session.get("qrToken", ""),
            "records": records,
            "present_count": present,
            "total_count": total,
            "created_at": session.get("createdAt", datetime.now(timezone.utc)),
        })

    return results


@router.post("/course/{course_id}", status_code=201)
def create_attendance_session(
    course_id: str,
    req: schemas.AttendanceSessionCreate,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Create a new attendance session."""
    sid = models.gen_id()
    qr_token = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "courseId": course_id,
        "date": req.date,
        "title": req.title or f"Session {req.date}",
        "startTime": (req.start_time or "").strip(),
        "endTime": (req.end_time or "").strip(),
        "qrToken": qr_token,
        "createdAt": now,
    }
    db.collection(models.ATTENDANCE).document(sid).set(data)
    data["id"] = sid

    # Auto-create records for all enrolled students (default absent)
    course_doc = db.collection(models.COURSES).document(course_id).get()
    course = models.doc_to_dict(course_doc)
    if course:
        for student_id in course.get("enrolledStudents", []):
            rid = models.gen_id()
            db.collection(models.ATTENDANCE_RECORDS).document(rid).set({
                "sessionId": sid,
                "studentId": student_id,
                "status": "absent",
            })

    audit_log(db, user["id"], "create", "attendance", sid, f"Attendance session: {req.date}")
    return {
        "id": sid,
        "date": req.date,
        "title": data["title"],
        "start_time": data["startTime"],
        "end_time": data["endTime"],
        "qr_token": qr_token,
    }


@router.post("/check-in")
def check_in_via_qr(
    req: schemas.AttendanceCheckIn,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Student checks in via QR token."""
    # Find session by qrToken
    session_docs = list(
        db.collection(models.ATTENDANCE)
        .where(filter=FieldFilter("qrToken", "==", req.token))
        .limit(1)
        .get()
    )
    if not session_docs:
        raise HTTPException(status_code=404, detail="Invalid or expired QR token")

    session = models.doc_to_dict(session_docs[0])
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired QR token")

    session_id = session["id"]
    student_id = user["id"]
    scanned_now = datetime.now(timezone.utc)

    # Determine status: if after end_time, mark "late"; otherwise "present".
    status_to_set = "present"
    try:
        end_t = (session.get("endTime") or "").strip()
        date_str = (session.get("date") or "").strip()
        if end_t and date_str and len(end_t) >= 4:
            # Parse "HH:MM" + date as local (treat as UTC for comparison — deadlines are approximate)
            hh, mm = end_t.split(":")[:2]
            y, m, d = date_str.split("-")
            end_dt = datetime(int(y), int(m), int(d), int(hh), int(mm), tzinfo=timezone.utc)
            if scanned_now > end_dt:
                status_to_set = "late"
    except Exception:
        pass

    # Find or create attendance record and mark present (or late)
    rec_docs = list(
        db.collection(models.ATTENDANCE_RECORDS)
        .where(filter=FieldFilter("sessionId", "==", session_id))
        .where(filter=FieldFilter("studentId", "==", student_id))
        .limit(1)
        .get()
    )
    if rec_docs:
        rec_docs[0].reference.update({"status": status_to_set, "scannedAt": scanned_now})
    else:
        rid = models.gen_id()
        db.collection(models.ATTENDANCE_RECORDS).document(rid).set({
            "sessionId": session_id,
            "studentId": student_id,
            "status": status_to_set,
            "scannedAt": scanned_now,
        })

    return {
        "ok": True,
        "session_title": session.get("title", ""),
        "course_id": session.get("courseId", ""),
    }


@router.get("/session/{session_id}")
def get_attendance_session(session_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get a single attendance session with all records and student info."""
    session_doc = db.collection(models.ATTENDANCE).document(session_id).get()
    session = models.doc_to_dict(session_doc)
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    # Get records
    rec_docs = db.collection(models.ATTENDANCE_RECORDS).where(filter=FieldFilter("sessionId", "==", session_id)).get()
    records = []
    present = 0
    total = 0
    for r_doc in rec_docs:
        r = models.doc_to_dict(r_doc)
        if r:
            total += 1
            if r.get("status") == "present":
                present += 1
            s_doc = db.collection(models.USERS).document(r.get("studentId", "")).get()
            s = models.doc_to_dict(s_doc)
            records.append({
                "student_id": r.get("studentId", ""),
                "student_name": s.get("displayName", "") if s else "",
                "student_photo": s.get("photoURL", "") if s else "",
                "status": r.get("status", "absent"),
                "scanned_at": r.get("scannedAt"),
            })

    return {
        "id": session["id"],
        "course_id": session.get("courseId", ""),
        "date": session.get("date", ""),
        "title": session.get("title", ""),
        "start_time": session.get("startTime", ""),
        "end_time": session.get("endTime", ""),
        "qr_token": session.get("qrToken", ""),
        "records": records,
        "present_count": present,
        "total_count": total,
        "created_at": session.get("createdAt", datetime.now(timezone.utc)),
    }


@router.post("/session/{session_id}/regenerate-qr")
def regenerate_qr_token(
    session_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Regenerate the QR token for an attendance session (lecturer only)."""
    session_doc = db.collection(models.ATTENDANCE).document(session_id).get()
    session = models.doc_to_dict(session_doc)
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    new_token = models.gen_id()
    db.collection(models.ATTENDANCE).document(session_id).update({"qrToken": new_token})

    return {"ok": True, "qr_token": new_token}


@router.patch("/session/{session_id}/record")
def update_attendance_record(
    session_id: str,
    req: schemas.AttendanceRecordCreate,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Update a student's attendance status."""
    # Find existing record
    docs = list(
        db.collection(models.ATTENDANCE_RECORDS)
        .where(filter=FieldFilter("sessionId", "==", session_id))
        .where(filter=FieldFilter("studentId", "==", req.student_id))
        .limit(1)
        .get()
    )
    if docs:
        docs[0].reference.update({"status": req.status})
    else:
        rid = models.gen_id()
        db.collection(models.ATTENDANCE_RECORDS).document(rid).set({
            "sessionId": session_id,
            "studentId": req.student_id,
            "status": req.status,
        })
    return {"ok": True}


@router.patch("/session/{session_id}/bulk")
def bulk_update_attendance(
    session_id: str,
    records: list[schemas.AttendanceRecordCreate],
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Bulk update attendance records."""
    for rec in records:
        docs = list(
            db.collection(models.ATTENDANCE_RECORDS)
            .where(filter=FieldFilter("sessionId", "==", session_id))
            .where(filter=FieldFilter("studentId", "==", rec.student_id))
            .limit(1)
            .get()
        )
        if docs:
            docs[0].reference.update({"status": rec.status})
        else:
            rid = models.gen_id()
            db.collection(models.ATTENDANCE_RECORDS).document(rid).set({
                "sessionId": session_id,
                "studentId": rec.student_id,
                "status": rec.status,
            })
    return {"ok": True}


@router.delete("/session/{session_id}")
def delete_attendance_session(session_id: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Delete an attendance session and its records."""
    # Delete records
    for r in db.collection(models.ATTENDANCE_RECORDS).where(filter=FieldFilter("sessionId", "==", session_id)).get():
        r.reference.delete()
    db.collection(models.ATTENDANCE).document(session_id).delete()
    return {"ok": True}


@router.get("/student/my")
def get_my_attendance(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get attendance summary for the current student across all courses."""
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

        session_docs = db.collection(models.ATTENDANCE).where(filter=FieldFilter("courseId", "==", c["id"])).get()
        total = 0
        present = 0
        late = 0

        for s_doc in session_docs:
            s = models.doc_to_dict(s_doc)
            if not s:
                continue
            total += 1
            rec_docs = list(
                db.collection(models.ATTENDANCE_RECORDS)
                .where(filter=FieldFilter("sessionId", "==", s["id"]))
                .where(filter=FieldFilter("studentId", "==", user["id"]))
                .limit(1)
                .get()
            )
            if rec_docs:
                r = models.doc_to_dict(rec_docs[0])
                if r and r.get("status") == "present":
                    present += 1
                elif r and r.get("status") == "late":
                    late += 1

        pct = ((present + late) / total * 100) if total > 0 else 0
        results.append({
            "course_id": c["id"],
            "course_name": c.get("courseName", ""),
            "course_code": c.get("courseCode", ""),
            "total_sessions": total,
            "present": present,
            "late": late,
            "absent": total - present - late,
            "attendance_percentage": round(pct, 1),
        })

    return results
