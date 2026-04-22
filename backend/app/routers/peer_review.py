from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from .notifications import create_notification
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/peer-reviews", tags=["Peer Reviews"])


def _review_out(r: dict, photo_url: str | None = None) -> schemas.PeerReviewOut:
    return schemas.PeerReviewOut(
        id=r["id"],
        submission_id=r.get("submissionId", ""),
        reviewer_id=r.get("reviewerId", ""),
        reviewer_name=r.get("reviewerName", ""),
        reviewer_photo_url=photo_url if photo_url is not None else r.get("reviewerPhotoUrl"),
        rating=r.get("rating", 0),
        comment=r.get("comment", ""),
        created_at=r.get("createdAt", datetime.now(timezone.utc)),
    )


@router.get("/enabled/{cid}")
def list_peer_review_assignments(cid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """List assignments in a course that have peer review enabled, with counts.

    Returned fields per assignment: id, title, description, deadline,
    submission_count (total submissions), my_reviewed_count (submissions the
    current user has already reviewed).
    """
    a_docs = (
        db.collection(models.ASSIGNMENTS)
        .where(filter=FieldFilter("courseId", "==", cid))
        .get()
    )
    results = []
    for a_doc in a_docs:
        a = models.doc_to_dict(a_doc)
        if not a or not a.get("peerReviewEnabled"):
            continue
        subs = list(
            db.collection(models.SUBMISSIONS)
            .where(filter=FieldFilter("assignmentId", "==", a["id"]))
            .get()
        )
        submission_count = 0
        reviewable_count = 0
        my_reviewed_count = 0
        for s_doc in subs:
            s = models.doc_to_dict(s_doc)
            if not s:
                continue
            submission_count += 1
            if s.get("studentId") == user["id"]:
                continue
            reviewable_count += 1
            mine = list(
                db.collection(models.PEER_REVIEWS)
                .where(filter=FieldFilter("submissionId", "==", s["id"]))
                .where(filter=FieldFilter("reviewerId", "==", user["id"]))
                .limit(1)
                .get()
            )
            if mine:
                my_reviewed_count += 1
        results.append({
            "id": a["id"],
            "title": a.get("title", ""),
            "description": a.get("description", ""),
            "deadline": a.get("deadline", ""),
            "submission_count": submission_count,
            "reviewable_count": reviewable_count,
            "my_reviewed_count": my_reviewed_count,
        })
    results.sort(key=lambda x: str(x.get("deadline", "")))
    return results


@router.get("/assignment/{aid}")
def get_reviewable_submissions(aid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get submissions available for peer review (excluding own).

    Only returns results if the assignment has peer review enabled.
    """
    a = models.doc_to_dict(db.collection(models.ASSIGNMENTS).document(aid).get())
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not a.get("peerReviewEnabled"):
        raise HTTPException(status_code=403, detail="Peer review is not enabled for this assignment")

    sub_docs = (
        db.collection(models.SUBMISSIONS)
        .where(filter=FieldFilter("assignmentId", "==", aid))
        .get()
    )
    sub_list = [models.doc_to_dict(d) for d in sub_docs]
    sub_list = [s for s in sub_list if s and s.get("studentId") != user["id"]]
    photo_map = models.get_user_photo_urls(db, [s.get("studentId") for s in sub_list])
    results = []
    for s in sub_list:

        # Check if already reviewed by this user
        existing = list(
            db.collection(models.PEER_REVIEWS)
            .where(filter=FieldFilter("submissionId", "==", s["id"]))
            .where(filter=FieldFilter("reviewerId", "==", user["id"]))
            .limit(1)
            .get()
        )

        # Get review stats
        all_reviews = list(
            db.collection(models.PEER_REVIEWS)
            .where(filter=FieldFilter("submissionId", "==", s["id"]))
            .get()
        )
        review_count = len(all_reviews)
        avg_rating = (
            sum(models.doc_to_dict(r).get("rating", 0) for r in all_reviews) / review_count
            if review_count > 0 else None
        )

        results.append({
            "submission_id": s["id"],
            "student_name": s.get("studentName", ""),
            "student_photo_url": photo_map.get(s.get("studentId")) or None,
            "submission_type": s.get("submissionType", ""),
            "map_id": s.get("mapId"),
            "external_link": s.get("externalLink"),
            "comments": s.get("comments", ""),
            "submitted_at": s.get("submittedAt"),
            "already_reviewed": len(existing) > 0,
            "review_count": review_count,
            "avg_rating": round(avg_rating, 1) if avg_rating else None,
        })
    return results


@router.post("/submission/{sid}", status_code=201)
def create_review(sid: str, req: schemas.PeerReviewCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Submit a peer review for a submission."""
    # Verify submission exists
    sub_doc = db.collection(models.SUBMISSIONS).document(sid).get()
    sub = models.doc_to_dict(sub_doc)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Can't review own
    if sub.get("studentId") == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot review your own submission")

    # Enforce peer_review_enabled flag on the parent assignment
    parent_aid = sub.get("assignmentId", "")
    parent = models.doc_to_dict(db.collection(models.ASSIGNMENTS).document(parent_aid).get()) if parent_aid else None
    if not parent or not parent.get("peerReviewEnabled"):
        raise HTTPException(status_code=403, detail="Peer review is not enabled for this assignment")

    # Check duplicate
    existing = list(
        db.collection(models.PEER_REVIEWS)
        .where(filter=FieldFilter("submissionId", "==", sid))
        .where(filter=FieldFilter("reviewerId", "==", user["id"]))
        .limit(1)
        .get()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this submission")

    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")

    rid = models.gen_id()
    now = datetime.now(timezone.utc)
    photo_url = models.get_user_photo_url(db, user["id"])
    data = {
        "submissionId": sid,
        "reviewerId": user["id"],
        "reviewerName": user.get("displayName", ""),
        "reviewerPhotoUrl": photo_url,
        "rating": req.rating,
        "comment": req.comment,
        "createdAt": now,
    }
    db.collection(models.PEER_REVIEWS).document(rid).set(data)
    data["id"] = rid

    # Notify the submission owner
    create_notification(
        db, sub.get("studentId", ""),
        "New peer review",
        f"{user.get('displayName', 'Someone')} reviewed your submission ({req.rating}/5)",
        "peer_review",
    )

    # Auto-badge check
    try:
        from .auto_badges import check_and_award_badges
        check_and_award_badges(db, user["id"])
    except Exception:
        pass

    return _review_out(data, photo_url)


@router.get("/submission/{sid}")
def get_reviews_for_submission(sid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get all peer reviews for a specific submission."""
    docs = db.collection(models.PEER_REVIEWS).where(filter=FieldFilter("submissionId", "==", sid)).get()
    items = [models.doc_to_dict(d) for d in docs]
    photo_map = models.get_user_photo_urls(db, [r.get("reviewerId") for r in items])
    return [_review_out(r, photo_map.get(r.get("reviewerId"))).model_dump() for r in items]


@router.get("/my-reviews")
def get_my_reviews(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get reviews the current user has written."""
    docs = db.collection(models.PEER_REVIEWS).where(filter=FieldFilter("reviewerId", "==", user["id"])).get()
    my_photo = models.get_user_photo_url(db, user["id"])
    return [_review_out(models.doc_to_dict(d), my_photo).model_dump() for d in docs]
