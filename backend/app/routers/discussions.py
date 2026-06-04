from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from ..sanitize import clean_text
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/courses/{course_id}/discussions", tags=["Discussions"])


def _disc_out(d: dict, photo_url: str | None = None) -> schemas.DiscussionOut:
    return schemas.DiscussionOut(
        id=d["id"],
        course_id=d.get("courseId", ""),
        text=d.get("text", ""),
        sender_id=d.get("senderId", ""),
        sender_name=d.get("senderName", ""),
        sender_role=d.get("senderRole", "student"),
        sender_photo_url=photo_url if photo_url is not None else d.get("senderPhotoUrl"),
        edited=d.get("edited", False),
        edited_at=d.get("editedAt"),
        created_at=d.get("createdAt", datetime.now(timezone.utc)),
    )


@router.get("/", response_model=list[schemas.DiscussionOut])
def get_discussions(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.DISCUSSIONS)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .order_by("createdAt")
        .get()
    )
    items = [models.doc_to_dict(d) for d in docs]
    # Fetch fresh photo URLs so avatars update when a user changes their photo.
    photo_map = models.get_user_photo_urls(db, [i.get("senderId") for i in items])
    return [_disc_out(i, photo_map.get(i.get("senderId"))) for i in items]


@router.post("/", response_model=schemas.DiscussionOut, status_code=201)
def send_message(course_id: str, req: schemas.DiscussionCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    msg_id = models.gen_id()
    now = datetime.now(timezone.utc)
    photo_url = models.get_user_photo_url(db, user["id"])
    data = {
        "courseId": course_id,
        "text": clean_text(req.text),
        "senderId": user["id"],
        "senderName": user.get("displayName", ""),
        "senderRole": user.get("role", "student"),
        "senderPhotoUrl": photo_url,
        "createdAt": now,
    }
    db.collection(models.DISCUSSIONS).document(msg_id).set(data)
    data["id"] = msg_id
    return _disc_out(data, photo_url)


@router.patch("/{msg_id}", response_model=schemas.DiscussionOut)
def edit_message(course_id: str, msg_id: str, req: schemas.DiscussionCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Edit a discussion message. Only the sender can edit their own message."""
    doc_ref = db.collection(models.DISCUSSIONS).document(msg_id)
    doc = doc_ref.get()
    d = models.doc_to_dict(doc)
    if not d or d.get("courseId") != course_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if d.get("senderId") != user["id"]:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")
    now = datetime.now(timezone.utc)
    safe_text = clean_text(req.text)
    doc_ref.update({"text": safe_text, "edited": True, "editedAt": now})
    d["text"] = safe_text
    d["edited"] = True
    d["editedAt"] = now
    return _disc_out(d, models.get_user_photo_url(db, d.get("senderId", "")))


@router.delete("/{msg_id}")
def delete_message(course_id: str, msg_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.DISCUSSIONS).document(msg_id).get()
    d = models.doc_to_dict(doc)
    if not d or d.get("courseId") != course_id:
        raise HTTPException(status_code=404, detail="Message not found")
    # Also delete replies
    for r in db.collection(models.DISCUSSIONS).where(filter=FieldFilter("parentId", "==", msg_id)).get():
        r.reference.delete()
    db.collection(models.DISCUSSIONS).document(msg_id).delete()
    return {"ok": True}


# ── Threaded Replies ──
@router.get("/{msg_id}/replies", response_model=list[schemas.DiscussionOut])
def get_replies(course_id: str, msg_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get replies to a discussion message."""
    try:
        docs = (
            db.collection(models.DISCUSSIONS)
            .where(filter=FieldFilter("parentId", "==", msg_id))
            .order_by("createdAt")
            .get()
        )
    except Exception:
        docs = db.collection(models.DISCUSSIONS).where(filter=FieldFilter("parentId", "==", msg_id)).get()
    items = [models.doc_to_dict(d) for d in docs]
    photo_map = models.get_user_photo_urls(db, [i.get("senderId") for i in items])
    return [_disc_out(i, photo_map.get(i.get("senderId"))) for i in items]


@router.post("/{msg_id}/replies", response_model=schemas.DiscussionOut, status_code=201)
def reply_to_message(course_id: str, msg_id: str, req: schemas.DiscussionCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Reply to a discussion message."""
    # Verify parent exists
    parent = db.collection(models.DISCUSSIONS).document(msg_id).get()
    if not parent.exists:
        raise HTTPException(status_code=404, detail="Parent message not found")

    reply_id = models.gen_id()
    now = datetime.now(timezone.utc)
    photo_url = models.get_user_photo_url(db, user["id"])
    data = {
        "courseId": course_id,
        "parentId": msg_id,
        "text": clean_text(req.text),
        "senderId": user["id"],
        "senderName": user.get("displayName", ""),
        "senderRole": user.get("role", "student"),
        "senderPhotoUrl": photo_url,
        "createdAt": now,
    }
    db.collection(models.DISCUSSIONS).document(reply_id).set(data)
    data["id"] = reply_id

    # Update parent reply count
    parent_data = models.doc_to_dict(parent)
    reply_count = parent_data.get("replyCount", 0) + 1
    parent.reference.update({"replyCount": reply_count})

    return _disc_out(data, photo_url)
