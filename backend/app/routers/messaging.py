from fastapi import APIRouter, Depends, HTTPException, Query
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from .notifications import create_notification
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/messages", tags=["Messaging"])


def _msg_out(m: dict, photo_url: str | None = None) -> schemas.MessageOut:
    deleted = bool(m.get("deleted", False))
    # Don't leak the original text after a soft delete; the client renders
    # a "Message deleted" placeholder when deleted=True.
    text = "" if deleted else m.get("text", "")
    return schemas.MessageOut(
        id=m["id"],
        conversation_id=m.get("conversationId", ""),
        sender_id=m.get("senderId", ""),
        sender_name=m.get("senderName", ""),
        sender_photo_url=photo_url if photo_url is not None else m.get("senderPhotoUrl"),
        text=text,
        edited=m.get("edited", False),
        edited_at=m.get("editedAt"),
        deleted=deleted,
        deleted_at=m.get("deletedAt"),
        created_at=m.get("createdAt", datetime.now(timezone.utc)),
    )


def _get_or_create_conversation(db, user_id: str, other_id: str) -> dict:
    """Find existing conversation between two users, or create one."""
    # Check both orderings
    docs = list(
        db.collection(models.CONVERSATIONS)
        .where(filter=FieldFilter("participants", "==", sorted([user_id, other_id])))
        .limit(1)
        .get()
    )
    if docs:
        return models.doc_to_dict(docs[0])

    # Create new conversation
    cid = models.gen_id()
    data = {
        "participants": sorted([user_id, other_id]),
        "lastMessage": None,
        "lastMessageAt": None,
        "createdAt": datetime.now(timezone.utc),
    }
    db.collection(models.CONVERSATIONS).document(cid).set(data)
    data["id"] = cid
    return data


def _conv_out(c: dict, db, current_user_id: str) -> dict:
    """Build ConversationOut with participant details and unread count."""
    participants = c.get("participants", [])
    names = []
    photos = []
    roles = []
    for pid in participants:
        if pid == current_user_id:
            continue
        u_doc = db.collection(models.USERS).document(pid).get()
        u = models.doc_to_dict(u_doc)
        if u:
            names.append(u.get("displayName", ""))
            photos.append(u.get("photoURL", ""))
            roles.append(u.get("role", "") or "")
        else:
            names.append("Unknown")
            photos.append("")
            roles.append("")

    # Count unread messages (messages not from this user, not yet in their readBy).
    # Note: Firestore's `not-in` does not support comparing array fields against
    # array literals, so we count in Python instead of via a server-side filter.
    unread = 0
    try:
        msg_docs = (
            db.collection(models.MESSAGES)
            .where(filter=FieldFilter("conversationId", "==", c["id"]))
            .get()
        )
        for md in msg_docs:
            m = models.doc_to_dict(md)
            if m and m.get("senderId") != current_user_id and current_user_id not in m.get("readBy", []):
                unread += 1
    except Exception:
        pass

    return schemas.ConversationOut(
        id=c["id"],
        participants=participants,
        participant_names=names,
        participant_photos=photos,
        participant_roles=roles,
        last_message=c.get("lastMessage"),
        last_message_at=c.get("lastMessageAt"),
        unread_count=unread,
    ).model_dump()


_EPOCH = datetime.min.replace(tzinfo=timezone.utc)


def _to_aware_dt(value) -> datetime:
    """Normalise heterogeneous timestamp values to a tz-aware datetime so a
    Python sort doesn't crash. Firestore can return DatetimeWithNanoseconds,
    a plain datetime, an ISO string (legacy seed data), or None — comparing
    these directly raises TypeError. Anything we can't parse falls back to
    epoch so the row sorts to the bottom rather than blowing up the request.
    """
    if value is None:
        return _EPOCH
    if isinstance(value, datetime):
        # Naive datetimes from old code paths still need a tzinfo to compare
        # against tz-aware Firestore timestamps.
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return _EPOCH
    return _EPOCH


@router.get("/conversations")
def list_conversations(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get all conversations for the current user."""
    docs = (
        db.collection(models.CONVERSATIONS)
        .where(filter=FieldFilter("participants", "array_contains", user["id"]))
        .get()
    )
    convs = [models.doc_to_dict(d) for d in docs]
    convs.sort(key=lambda c: _to_aware_dt(c.get("lastMessageAt")), reverse=True)
    return [_conv_out(c, db, user["id"]) for c in convs]


@router.post("/conversations/{other_user_id}")
def get_or_create_conversation(other_user_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get or create a DM conversation with another user."""
    # Verify other user exists
    other_doc = db.collection(models.USERS).document(other_user_id).get()
    if not other_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    conv = _get_or_create_conversation(db, user["id"], other_user_id)
    return _conv_out(conv, db, user["id"])


@router.get("/conversations/{conv_id}/messages")
def get_messages(
    conv_id: str,
    limit: int = Query(50, le=100),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get messages in a conversation."""
    # Verify user is participant
    conv_doc = db.collection(models.CONVERSATIONS).document(conv_id).get()
    conv = models.doc_to_dict(conv_doc)
    if not conv or user["id"] not in conv.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    try:
        docs = (
            db.collection(models.MESSAGES)
            .where(filter=FieldFilter("conversationId", "==", conv_id))
            .order_by("createdAt")
            .limit(limit)
            .get()
        )
    except Exception:
        docs = db.collection(models.MESSAGES).where(filter=FieldFilter("conversationId", "==", conv_id)).get()

    items = [models.doc_to_dict(d) for d in docs]
    # Always sort chronologically in Python — protects against the fallback
    # path above (no order_by) and against any Firestore index gaps. Without
    # this, chat history rendered in arbitrary order on the web client.
    items.sort(key=lambda m: _to_aware_dt(m.get("createdAt")))
    if len(items) > limit:
        items = items[-limit:]
    photo_map = models.get_user_photo_urls(db, [m.get("senderId") for m in items])
    messages = [_msg_out(m, photo_map.get(m.get("senderId"))) for m in items]

    # Mark as read
    for d in docs:
        m = models.doc_to_dict(d)
        if m and m.get("senderId") != user["id"] and user["id"] not in m.get("readBy", []):
            read_by = m.get("readBy", [])
            read_by.append(user["id"])
            d.reference.update({"readBy": read_by})

    return messages


@router.post("/conversations/{conv_id}/messages", status_code=201)
def send_message(
    conv_id: str,
    req: schemas.MessageCreate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Send a message in a conversation."""
    conv_doc = db.collection(models.CONVERSATIONS).document(conv_id).get()
    conv = models.doc_to_dict(conv_doc)
    if not conv or user["id"] not in conv.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    msg_id = models.gen_id()
    now = datetime.now(timezone.utc)
    photo_url = models.get_user_photo_url(db, user["id"])
    data = {
        "conversationId": conv_id,
        "senderId": user["id"],
        "senderName": user.get("displayName", ""),
        "senderPhotoUrl": photo_url,
        "text": req.text,
        "readBy": [user["id"]],
        "createdAt": now,
    }
    db.collection(models.MESSAGES).document(msg_id).set(data)
    data["id"] = msg_id

    # Update conversation last message
    db.collection(models.CONVERSATIONS).document(conv_id).update({
        "lastMessage": req.text[:100],
        "lastMessageAt": now,
    })

    # Notify the other participant. Web routes are role-prefixed
    # (/student/messages, /lecturer/messages) — a bare /messages/{id} link
    # 404s. We pass conv as a query param so the inbox page can auto-open
    # the conversation instead of dropping the user on an empty list.
    other_ids = [pid for pid in conv.get("participants", []) if pid != user["id"]]
    for oid in other_ids:
        recipient_doc = db.collection(models.USERS).document(oid).get()
        recipient = (recipient_doc.to_dict() or {}) if recipient_doc.exists else {}
        role = recipient.get("role") or "student"
        base = f"/{role}/messages" if role in ("student", "lecturer") else "/student/messages"
        link = f"{base}?conv={conv_id}"
        create_notification(
            db, oid,
            f"New message from {user.get('displayName', 'Someone')}",
            req.text[:100],
            "message",
            link,
        )

    return _msg_out(data)


@router.patch("/conversations/{conv_id}/messages/{msg_id}")
def edit_message(
    conv_id: str,
    msg_id: str,
    req: schemas.MessageCreate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Edit a private message. Only the sender can edit."""
    # Verify user is participant
    conv_doc = db.collection(models.CONVERSATIONS).document(conv_id).get()
    conv = models.doc_to_dict(conv_doc)
    if not conv or user["id"] not in conv.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    doc_ref = db.collection(models.MESSAGES).document(msg_id)
    doc = doc_ref.get()
    d = models.doc_to_dict(doc)
    if not d or d.get("conversationId") != conv_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if d.get("senderId") != user["id"]:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")
    if d.get("deleted"):
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")

    now = datetime.now(timezone.utc)
    doc_ref.update({"text": req.text, "edited": True, "editedAt": now})
    d["text"] = req.text
    d["edited"] = True
    d["editedAt"] = now
    return _msg_out(d, models.get_user_photo_url(db, d.get("senderId", "")))


@router.delete("/conversations/{conv_id}/messages/{msg_id}")
def delete_message(
    conv_id: str,
    msg_id: str,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Soft-delete a private message. Only the sender can delete.

    We mark deleted=True and clear the text on read (in _msg_out) instead of
    removing the doc, so both participants see a 'Message deleted' placeholder
    in chronological position rather than the message vanishing silently.
    """
    conv_doc = db.collection(models.CONVERSATIONS).document(conv_id).get()
    conv = models.doc_to_dict(conv_doc)
    if not conv or user["id"] not in conv.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    doc_ref = db.collection(models.MESSAGES).document(msg_id)
    doc = doc_ref.get()
    d = models.doc_to_dict(doc)
    if not d or d.get("conversationId") != conv_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if d.get("senderId") != user["id"]:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")
    if d.get("deleted"):
        # Idempotent: already soft-deleted.
        return _msg_out(d, models.get_user_photo_url(db, d.get("senderId", "")))

    now = datetime.now(timezone.utc)
    doc_ref.update({"deleted": True, "deletedAt": now, "text": ""})
    d["deleted"] = True
    d["deletedAt"] = now
    d["text"] = ""

    # Update the conversation last-message preview only when the deleted
    # message was actually the latest one — otherwise the inbox row would
    # flicker for unrelated deletions.
    last_at = conv.get("lastMessageAt")
    msg_at = d.get("createdAt")
    if last_at and msg_at and _to_aware_dt(last_at) == _to_aware_dt(msg_at):
        db.collection(models.CONVERSATIONS).document(conv_id).update({
            "lastMessage": "Message deleted",
        })

    return _msg_out(d, models.get_user_photo_url(db, d.get("senderId", "")))


@router.get("/search-users")
def search_users(
    q: str = Query("", min_length=2),
    role: str = Query(None),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Search users to start a conversation with. Use role=student to list all students."""
    results = []
    seen = set()

    # If role filter is provided, list all users of that role
    if role:
        role_docs = (
            db.collection(models.USERS)
            .where(filter=FieldFilter("role", "==", role))
            .limit(50)
            .get()
        )
        for d in role_docs:
            u = models.doc_to_dict(d)
            if u and u["id"] != user["id"] and u["id"] not in seen:
                # Apply text filter if query is provided
                if q and q != "@":
                    name = (u.get("displayName", "") or "").lower()
                    email = (u.get("email", "") or "").lower()
                    if q.lower() not in name and q.lower() not in email:
                        continue
                seen.add(u["id"])
                results.append({
                    "id": u["id"],
                    "display_name": u.get("displayName", ""),
                    "email": u.get("email", ""),
                    "photo_url": u.get("photoURL", ""),
                    "role": u.get("role", ""),
                })
        return results[:50]

    # Search by email prefix
    email_docs = (
        db.collection(models.USERS)
        .order_by("email")
        .start_at({"email": q.lower()})
        .end_at({"email": q.lower() + "\uf8ff"})
        .limit(10)
        .get()
    )
    for d in email_docs:
        u = models.doc_to_dict(d)
        if u and u["id"] != user["id"] and u["id"] not in seen:
            seen.add(u["id"])
            results.append({
                "id": u["id"],
                "display_name": u.get("displayName", ""),
                "email": u.get("email", ""),
                "photo_url": u.get("photoURL", ""),
                "role": u.get("role", ""),
            })

    # Search by display name
    name_docs = (
        db.collection(models.USERS)
        .order_by("displayName")
        .start_at({"displayName": q})
        .end_at({"displayName": q + "\uf8ff"})
        .limit(10)
        .get()
    )
    for d in name_docs:
        u = models.doc_to_dict(d)
        if u and u["id"] != user["id"] and u["id"] not in seen:
            seen.add(u["id"])
            results.append({
                "id": u["id"],
                "display_name": u.get("displayName", ""),
                "email": u.get("email", ""),
                "photo_url": u.get("photoURL", ""),
                "role": u.get("role", ""),
            })

    return results[:10]
