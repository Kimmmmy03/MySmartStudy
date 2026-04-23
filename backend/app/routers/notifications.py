import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from .. import models
from ..firestore import get_db
from ..auth import get_current_user
from ..services.email_service import send_notification_email
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def create_notification(
    db,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    link: str = "",
    send_email: bool = True,
) -> None:
    """Create an in-app notification for a user and optionally mirror it by email.

    The email is fire-and-forget (spawned in a background thread by
    `send_notification_email`) and respects the user's `emailNotifications`
    flag — default true if the field isn't set. Set `send_email=False` for
    noisy channels (e.g. map-view pings) where the in-app notif is enough.
    """
    nid = models.gen_id()
    db.collection(models.NOTIFICATIONS).document(nid).set({
        "userId": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "link": link,
        "read": False,
        "createdAt": datetime.now(timezone.utc),
    })

    if not send_email:
        return

    try:
        user_doc = db.collection(models.USERS).document(user_id).get()
        if not user_doc.exists:
            return
        user = user_doc.to_dict() or {}
        if user.get("emailNotifications") is False:
            return
        to_email = user.get("email", "")
        if not to_email:
            return
        send_notification_email(
            to_email=to_email,
            display_name=user.get("displayName", ""),
            title=title,
            message=message,
            link=link,
        )
    except Exception as e:
        logger.warning("Notification email hook failed for user %s: %s", user_id, e)


@router.get("/")
def get_notifications(
    limit: int = Query(20, le=50),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        docs = (
            db.collection(models.NOTIFICATIONS)
            .where(filter=FieldFilter("userId", "==", user["id"]))
            .order_by("createdAt", direction="DESCENDING")
            .limit(limit)
            .get()
        )
        return [models.doc_to_dict(d) for d in docs]
    except Exception:
        # Fallback: query without order_by (avoids missing composite index error),
        # then sort and limit in Python
        docs = (
            db.collection(models.NOTIFICATIONS)
            .where(filter=FieldFilter("userId", "==", user["id"]))
            .get()
        )
        results = [models.doc_to_dict(d) for d in docs]
        results.sort(key=lambda x: x.get("createdAt", datetime.min), reverse=True)
        return results[:limit]


@router.patch("/{nid}/read")
def mark_read(nid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.NOTIFICATIONS).document(nid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.collection(models.NOTIFICATIONS).document(nid).update({"read": True})
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.NOTIFICATIONS)
        .where(filter=FieldFilter("userId", "==", user["id"]))
        .where(filter=FieldFilter("read", "==", False))
        .get()
    )
    batch = db.batch()
    for d in docs:
        batch.update(d.reference, {"read": True})
    batch.commit()
    return {"ok": True}


@router.delete("/{nid}")
def delete_notification(nid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.NOTIFICATIONS).document(nid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Notification not found")
    data = doc.to_dict() or {}
    if data.get("userId") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your notification")
    db.collection(models.NOTIFICATIONS).document(nid).delete()
    return {"ok": True}


@router.delete("/")
def clear_all_notifications(user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.NOTIFICATIONS)
        .where(filter=FieldFilter("userId", "==", user["id"]))
        .get()
    )
    batch = db.batch()
    for d in docs:
        batch.delete(d.reference)
    batch.commit()
    return {"ok": True}


@router.post("/register-token")
def register_fcm_token(
    body: dict,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Store FCM token for push notifications."""
    token = body.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token required")
    db.collection(models.FCM_TOKENS).document(user["id"]).set({
        "token": token,
        "updatedAt": datetime.now(timezone.utc),
    })
    return {"ok": True}
