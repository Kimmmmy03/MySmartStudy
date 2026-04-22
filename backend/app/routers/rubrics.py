from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/rubrics", tags=["Rubrics"])


@router.get("/assignment/{aid}")
def get_rubric(aid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get the rubric for an assignment."""
    docs = list(
        db.collection(models.RUBRICS)
        .where(filter=FieldFilter("assignmentId", "==", aid))
        .limit(1)
        .get()
    )
    if not docs:
        return None
    r = models.doc_to_dict(docs[0])
    return {
        "id": r["id"],
        "assignment_id": r.get("assignmentId", ""),
        "title": r.get("title", ""),
        "criteria": r.get("criteria", []),
        "created_at": r.get("createdAt", datetime.now(timezone.utc)),
    }


@router.post("/", status_code=201)
def create_rubric(req: schemas.RubricCreate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Create or replace a rubric for an assignment."""
    # Delete existing rubric if any
    existing = list(
        db.collection(models.RUBRICS)
        .where(filter=FieldFilter("assignmentId", "==", req.assignment_id))
        .get()
    )
    for doc in existing:
        doc.reference.delete()

    rid = models.gen_id()
    now = datetime.now(timezone.utc)
    criteria = [c.model_dump() for c in req.criteria]
    data = {
        "assignmentId": req.assignment_id,
        "title": req.title,
        "criteria": criteria,
        "lecturerId": user["id"],
        "createdAt": now,
    }
    db.collection(models.RUBRICS).document(rid).set(data)
    data["id"] = rid
    return {
        "id": rid,
        "assignment_id": req.assignment_id,
        "title": req.title,
        "criteria": criteria,
        "created_at": now,
    }


@router.delete("/{rid}")
def delete_rubric(rid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc = db.collection(models.RUBRICS).document(rid).get()
    r = models.doc_to_dict(doc)
    if not r or r.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Rubric not found")
    db.collection(models.RUBRICS).document(rid).delete()
    return {"ok": True}


@router.post("/grade/{aid}/{sid}")
def grade_with_rubric(
    aid: str,
    sid: str,
    req: schemas.RubricGradeCreate,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Grade a submission using rubric criterion scores."""
    # Get rubric
    rubric_docs = list(
        db.collection(models.RUBRICS)
        .where(filter=FieldFilter("assignmentId", "==", aid))
        .limit(1)
        .get()
    )
    if not rubric_docs:
        raise HTTPException(status_code=404, detail="No rubric found for this assignment")

    rubric = models.doc_to_dict(rubric_docs[0])
    criteria = rubric.get("criteria", [])

    # Calculate total score
    total_earned = 0
    total_possible = 0
    for c in criteria:
        name = c.get("name", "")
        max_pts = c.get("max_points", 10)
        total_possible += max_pts
        total_earned += min(req.criterion_scores.get(name, 0), max_pts)

    percentage = (total_earned / total_possible * 100) if total_possible > 0 else 0

    # Update submission
    sub_ref = db.collection(models.SUBMISSIONS).document(sid)
    sub_doc = sub_ref.get()
    if not sub_doc.exists:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Build detailed feedback
    feedback_parts = []
    for c in criteria:
        name = c.get("name", "")
        max_pts = c.get("max_points", 10)
        earned = req.criterion_scores.get(name, 0)
        feedback_parts.append(f"{name}: {earned}/{max_pts}")
    if req.feedback:
        feedback_parts.append(f"\n{req.feedback}")
    full_feedback = " | ".join(feedback_parts[:len(criteria)]) + (f"\n{req.feedback}" if req.feedback else "")

    sub_ref.update({
        "grade": round(percentage, 1),
        "feedback": full_feedback,
        "rubricScores": req.criterion_scores,
    })

    return {
        "ok": True,
        "grade": round(percentage, 1),
        "total_earned": total_earned,
        "total_possible": total_possible,
        "feedback": full_feedback,
    }
