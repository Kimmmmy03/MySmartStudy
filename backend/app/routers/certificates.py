from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from .notifications import create_notification
from datetime import datetime, timezone
import hashlib
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])


def _cert_out(c: dict) -> schemas.CertificateOut:
    return schemas.CertificateOut(
        id=c["id"],
        student_id=c.get("studentId", ""),
        student_name=c.get("studentName", ""),
        course_id=c.get("courseId", ""),
        course_name=c.get("courseName", ""),
        course_code=c.get("courseCode", ""),
        lecturer_name=c.get("lecturerName", ""),
        completion_percentage=c.get("completionPercentage", 100),
        issued_at=c.get("issuedAt", datetime.now(timezone.utc)),
        certificate_number=c.get("certificateNumber", ""),
    )


def _calculate_progress(db, user_id: str, course_id: str) -> float:
    """Calculate course completion percentage for a student."""
    # Assignments
    a_docs = list(db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("courseId", "==", course_id)).get())
    total_a = len(a_docs)
    submitted_a = 0
    for a_doc in a_docs:
        a = models.doc_to_dict(a_doc)
        if not a:
            continue
        subs = list(
            db.collection(models.SUBMISSIONS)
            .where(filter=FieldFilter("assignmentId", "==", a["id"]))
            .where(filter=FieldFilter("studentId", "==", user_id))
            .limit(1)
            .get()
        )
        if subs:
            submitted_a += 1

    # Quizzes
    q_docs = list(db.collection(models.QUIZZES).where(filter=FieldFilter("courseId", "==", course_id)).get())
    total_q = len(q_docs)
    completed_q = 0
    for q_doc in q_docs:
        q = models.doc_to_dict(q_doc)
        if not q:
            continue
        atts = list(
            db.collection(models.QUIZ_ATTEMPTS)
            .where(filter=FieldFilter("quizId", "==", q["id"]))
            .where(filter=FieldFilter("studentId", "==", user_id))
            .limit(1)
            .get()
        )
        if atts:
            completed_q += 1

    total_items = total_a + total_q
    completed_items = submitted_a + completed_q
    return (completed_items / total_items * 100) if total_items > 0 else 0


def _gen_certificate_number(student_id: str, course_id: str) -> str:
    raw = f"{student_id}-{course_id}"
    return "MSS-" + hashlib.sha256(raw.encode()).hexdigest()[:8].upper()


@router.get("/my", response_model=list[schemas.CertificateOut])
def get_my_certificates(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get all certificates earned by the current user."""
    docs = db.collection(models.CERTIFICATES).where(filter=FieldFilter("studentId", "==", user["id"])).get()
    return [_cert_out(models.doc_to_dict(d)) for d in docs if models.doc_to_dict(d)]


@router.get("/course/{cid}", response_model=list[schemas.CertificateOut])
def get_course_certificates(cid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get all certificates issued for a course (lecturer view)."""
    docs = db.collection(models.CERTIFICATES).where(filter=FieldFilter("courseId", "==", cid)).get()
    return [_cert_out(models.doc_to_dict(d)) for d in docs if models.doc_to_dict(d)]


@router.post("/claim/{cid}", response_model=schemas.CertificateOut)
def claim_certificate(cid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Claim a certificate for a completed course."""
    # Check if already issued
    existing = list(
        db.collection(models.CERTIFICATES)
        .where(filter=FieldFilter("studentId", "==", user["id"]))
        .where(filter=FieldFilter("courseId", "==", cid))
        .limit(1)
        .get()
    )
    if existing:
        return _cert_out(models.doc_to_dict(existing[0]))

    # Calculate progress
    pct = _calculate_progress(db, user["id"], cid)
    if pct < 100:
        raise HTTPException(status_code=400, detail=f"Course not fully completed ({pct:.0f}%)")

    # Get course info
    c_doc = db.collection(models.COURSES).document(cid).get()
    c = models.doc_to_dict(c_doc)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")

    cert_id = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "studentId": user["id"],
        "studentName": user.get("displayName", ""),
        "courseId": cid,
        "courseName": c.get("courseName", ""),
        "courseCode": c.get("courseCode", ""),
        "lecturerName": c.get("lecturerName", ""),
        "completionPercentage": pct,
        "issuedAt": now,
        "certificateNumber": _gen_certificate_number(user["id"], cid),
    }
    db.collection(models.CERTIFICATES).document(cert_id).set(data)
    data["id"] = cert_id

    create_notification(
        db, user["id"],
        "Certificate Earned!",
        f"Congratulations! You earned a certificate for {c.get('courseName', '')}",
        "certificate",
    )

    return _cert_out(data)


@router.get("/verify/{cert_number}")
def verify_certificate(cert_number: str, db=Depends(get_db)):
    """Verify a certificate by its number (public endpoint)."""
    docs = list(
        db.collection(models.CERTIFICATES)
        .where(filter=FieldFilter("certificateNumber", "==", cert_number))
        .limit(1)
        .get()
    )
    if not docs:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return _cert_out(models.doc_to_dict(docs[0]))
