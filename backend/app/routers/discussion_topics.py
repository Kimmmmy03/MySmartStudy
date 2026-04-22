from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/courses/{course_id}/topics", tags=["Discussion Topics"])


def _topic_out(t: dict) -> schemas.TopicOut:
    return schemas.TopicOut(
        id=t["id"],
        course_id=t.get("courseId", ""),
        title=t.get("title", ""),
        description=t.get("description", ""),
        pinned=t.get("pinned", False),
        author_id=t.get("authorId", ""),
        author_name=t.get("authorName", ""),
        reply_count=t.get("replyCount", 0),
        last_activity=t.get("lastActivity"),
        created_at=t.get("createdAt", datetime.now(timezone.utc)),
    )


@router.get("/", response_model=list[schemas.TopicOut])
def list_topics(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """List all discussion topics for a course, pinned first, then by last activity."""
    docs = (
        db.collection(models.DISCUSSION_TOPICS)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .get()
    )
    topics = [_topic_out(models.doc_to_dict(d)) for d in docs if models.doc_to_dict(d)]
    # Sort: pinned first, then by last_activity descending
    topics.sort(key=lambda t: (not t.pinned, -(t.last_activity or t.created_at).timestamp()))
    return topics


@router.post("/", status_code=201)
def create_topic(
    course_id: str,
    req: schemas.TopicCreate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new discussion topic. Any user can create topics."""
    tid = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "courseId": course_id,
        "title": req.title,
        "description": req.description,
        "pinned": req.pinned if user.get("role") == "lecturer" else False,
        "authorId": user["id"],
        "authorName": user.get("displayName", ""),
        "replyCount": 0,
        "lastActivity": now,
        "createdAt": now,
    }
    db.collection(models.DISCUSSION_TOPICS).document(tid).set(data)
    data["id"] = tid
    return _topic_out(data).model_dump()


@router.patch("/{topic_id}")
def update_topic(
    course_id: str,
    topic_id: str,
    req: schemas.TopicCreate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update a topic. Only the author or a lecturer can update."""
    doc = db.collection(models.DISCUSSION_TOPICS).document(topic_id).get()
    t = models.doc_to_dict(doc)
    if not t or t.get("courseId") != course_id:
        raise HTTPException(status_code=404, detail="Topic not found")
    if t.get("authorId") != user["id"] and user.get("role") != "lecturer":
        raise HTTPException(status_code=403, detail="Not authorized")
    updates = {
        "title": req.title,
        "description": req.description,
    }
    if user.get("role") == "lecturer":
        updates["pinned"] = req.pinned
    doc.reference.update(updates)
    t.update(updates)
    return _topic_out(t).model_dump()


@router.delete("/{topic_id}")
def delete_topic(
    course_id: str,
    topic_id: str,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete a topic and all its posts. Only author or lecturer."""
    doc = db.collection(models.DISCUSSION_TOPICS).document(topic_id).get()
    t = models.doc_to_dict(doc)
    if not t or t.get("courseId") != course_id:
        raise HTTPException(status_code=404, detail="Topic not found")
    if t.get("authorId") != user["id"] and user.get("role") != "lecturer":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Delete all posts under this topic
    posts = db.collection(models.DISCUSSIONS).where(filter=FieldFilter("topicId", "==", topic_id)).get()
    for p in posts:
        p.reference.delete()

    db.collection(models.DISCUSSION_TOPICS).document(topic_id).delete()
    return {"ok": True}


@router.patch("/{topic_id}/pin")
def toggle_pin(
    course_id: str,
    topic_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Lecturer: toggle pin on a topic."""
    doc = db.collection(models.DISCUSSION_TOPICS).document(topic_id).get()
    t = models.doc_to_dict(doc)
    if not t or t.get("courseId") != course_id:
        raise HTTPException(status_code=404, detail="Topic not found")
    new_pinned = not t.get("pinned", False)
    doc.reference.update({"pinned": new_pinned})
    return {"ok": True, "pinned": new_pinned}


# ── Topic Posts (messages within a topic) ──

@router.get("/{topic_id}/posts")
def get_topic_posts(
    course_id: str,
    topic_id: str,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get all posts within a discussion topic."""
    try:
        docs = (
            db.collection(models.DISCUSSIONS)
            .where(filter=FieldFilter("topicId", "==", topic_id))
            .order_by("createdAt")
            .get()
        )
    except Exception:
        docs = db.collection(models.DISCUSSIONS).where(filter=FieldFilter("topicId", "==", topic_id)).get()

    results = []
    for d in docs:
        msg = models.doc_to_dict(d)
        if not msg:
            continue
        results.append({
            "id": msg["id"],
            "topic_id": topic_id,
            "course_id": course_id,
            "text": msg.get("text", ""),
            "sender_id": msg.get("senderId", ""),
            "sender_name": msg.get("senderName", ""),
            "sender_role": msg.get("senderRole", "student"),
            "created_at": msg.get("createdAt", datetime.now(timezone.utc)).isoformat() if hasattr(msg.get("createdAt", ""), "isoformat") else str(msg.get("createdAt", "")),
        })
    return results


@router.post("/{topic_id}/posts", status_code=201)
def create_topic_post(
    course_id: str,
    topic_id: str,
    req: schemas.DiscussionCreate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Post a message in a discussion topic."""
    # Verify topic exists
    topic_doc = db.collection(models.DISCUSSION_TOPICS).document(topic_id).get()
    if not topic_doc.exists:
        raise HTTPException(status_code=404, detail="Topic not found")

    msg_id = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "courseId": course_id,
        "topicId": topic_id,
        "text": req.text,
        "senderId": user["id"],
        "senderName": user.get("displayName", ""),
        "senderRole": user.get("role", "student"),
        "createdAt": now,
    }
    db.collection(models.DISCUSSIONS).document(msg_id).set(data)
    data["id"] = msg_id

    # Update topic reply count and last activity
    t = models.doc_to_dict(topic_doc)
    topic_doc.reference.update({
        "replyCount": (t.get("replyCount", 0) + 1) if t else 1,
        "lastActivity": now,
    })

    return {
        "id": msg_id,
        "topic_id": topic_id,
        "course_id": course_id,
        "text": req.text,
        "sender_id": user["id"],
        "sender_name": user.get("displayName", ""),
        "sender_role": user.get("role", "student"),
        "created_at": now.isoformat(),
    }


@router.delete("/{topic_id}/posts/{post_id}")
def delete_topic_post(
    course_id: str,
    topic_id: str,
    post_id: str,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete a post. Only the author or a lecturer."""
    doc = db.collection(models.DISCUSSIONS).document(post_id).get()
    msg = models.doc_to_dict(doc)
    if not msg:
        raise HTTPException(status_code=404, detail="Post not found")
    if msg.get("senderId") != user["id"] and user.get("role") != "lecturer":
        raise HTTPException(status_code=403, detail="Not authorized")
    db.collection(models.DISCUSSIONS).document(post_id).delete()

    # Decrement reply count
    topic_doc = db.collection(models.DISCUSSION_TOPICS).document(topic_id).get()
    t = models.doc_to_dict(topic_doc)
    if t:
        new_count = max(0, t.get("replyCount", 1) - 1)
        topic_doc.reference.update({"replyCount": new_count})

    return {"ok": True}
