from fastapi import APIRouter, Depends, HTTPException, Query
from .. import models
from ..firestore import get_db
from ..auth import get_current_user
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def create_notification(
    db,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    link: str = "",
) -> None:
    """Create a notification for a user."""
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
