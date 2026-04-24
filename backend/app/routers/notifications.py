import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from .. import models
from ..firestore import get_db
from ..auth import get_current_user
from ..services.email_service import send_notification_email
from datetime import datetime, timezone, timedelta
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


@router.get("/grouped")
def get_notifications_grouped(
    limit: int = Query(40, le=100),
    window_hours: int = Query(24, ge=1, le=168),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Notifications grouped into Instagram-style digests.

    Buckets raw notifications of the same (type, link) tuple within a rolling
    window (default 24h) into a single entry with an actors[] list and a
    count. Clients render "Ali, Sarah and 3 others liked your mind map
    'Sejarah'" from the resulting digest.

    The raw endpoint (GET /) stays untouched so existing read-state +
    delete code paths keep working. The grouped endpoint reads more rows
    (limit * 2, capped) because N raw notifications may collapse to a
    single digest, then trims after grouping.
    """
    # Pull a wider slice than the client's target so we have room to
    # collapse many raw rows into fewer digest entries.
    fetch_limit = min(limit * 4, 200)
    try:
        docs = (
            db.collection(models.NOTIFICATIONS)
            .where(filter=FieldFilter("userId", "==", user["id"]))
            .order_by("createdAt", direction="DESCENDING")
            .limit(fetch_limit)
            .get()
        )
        raw = [models.doc_to_dict(d) for d in docs]
    except Exception:
        docs = (
            db.collection(models.NOTIFICATIONS)
            .where(filter=FieldFilter("userId", "==", user["id"]))
            .get()
        )
        raw = [models.doc_to_dict(d) for d in docs]
        raw.sort(key=lambda x: x.get("createdAt") or datetime.min, reverse=True)
        raw = raw[:fetch_limit]

    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    groups: dict[tuple[str, str], dict] = {}
    ungrouped: list[dict] = []

    # Only grouping types where many actors hitting the same link make sense.
    # new_follower is keyed by link too so multiple followers on the same day
    # collapse to one bell entry.
    GROUPING_TYPES = {"map_like", "map_comment", "new_follower", "map_posted"}

    for n in raw:
        if not n:
            continue
        n_type = (n.get("type") or "info")
        link = (n.get("link") or "")
        created = n.get("createdAt")
        # Normalise to UTC-aware so comparisons don't throw.
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except Exception:
                created = None
        # Don't group old rows outside the window or unknown types.
        if (
            n_type not in GROUPING_TYPES
            or not link
            or not created
            or created < cutoff
        ):
            ungrouped.append(n)
            continue

        key = (n_type, link)
        existing = groups.get(key)
        if not existing:
            # Seed the digest with this row.
            title = _digest_title_for(n_type, 1)
            groups[key] = {
                "id": f"digest_{n['id']}",
                "kind": "digest",
                "type": n_type,
                "link": link,
                "title": title or n.get("title", ""),
                "message": n.get("message", ""),
                "createdAt": created,
                "read": bool(n.get("read")),
                "count": 1,
                "actors": [_extract_actor(n)],
                "source_ids": [n["id"]],
            }
        else:
            existing["count"] += 1
            existing["source_ids"].append(n["id"])
            actor = _extract_actor(n)
            # De-dup actors so the same person double-liking doesn't list twice.
            if actor and actor not in existing["actors"]:
                existing["actors"].append(actor)
            # read flag: digest is read only when every source is read.
            if not n.get("read"):
                existing["read"] = False
            # Keep latest message preview (helps map_comment digests show the
            # newest comment text even when many comments are pending).
            if created and (not existing.get("createdAt") or created > existing["createdAt"]):
                existing["createdAt"] = created
                if n_type == "map_comment" and n.get("message"):
                    existing["message"] = n["message"]
            # Re-title based on updated count.
            existing["title"] = _digest_title_for(n_type, existing["count"]) or existing["title"]

    # Assemble: digests + ungrouped, newest-first, trim to limit.
    merged: list[dict] = []
    for g in groups.values():
        # Frontend expects createdAt as iso string to match the raw endpoint.
        created = g.get("createdAt")
        if isinstance(created, datetime):
            g["createdAt"] = created.isoformat()
        merged.append(g)
    for u in ungrouped:
        u = dict(u)
        u["kind"] = "single"
        created = u.get("createdAt")
        if isinstance(created, datetime):
            u["createdAt"] = created.isoformat()
        merged.append(u)

    def _key(x):
        c = x.get("createdAt") or ""
        return c
    merged.sort(key=_key, reverse=True)
    return merged[:limit]


def _extract_actor(n: dict) -> str:
    """Pull a display name out of a raw notification. We don't store a
    dedicated actorId on notifications yet, so we lean on the natural-
    language message which the notification creators format consistently
    as '<Name> did something' or '<Name>: preview'."""
    msg = (n.get("message") or "").strip()
    if not msg:
        return ""
    # Patterns like "Ali started following you" → "Ali"
    # "Ali: great map!" → "Ali"
    # "Ali liked \"Sejarah\"." → "Ali"
    for sep in (" started ", " liked ", " commented ", " posted ", ": ", " added ", " opened "):
        idx = msg.find(sep)
        if 0 < idx < 60:
            return msg[:idx].strip()
    # Fallback: first word.
    first = msg.split(None, 1)[0]
    return first[:40] if first else ""


def _digest_title_for(n_type: str, count: int) -> str:
    """Rewrite the title for a digest so 'Ali liked…' becomes '5 people liked
    your mind map'. Single-item digests fall back to the raw title."""
    if count <= 1:
        return ""
    if n_type == "map_like":
        return f"{count} people liked your mind map"
    if n_type == "map_comment":
        return f"{count} new comments on your mind map"
    if n_type == "new_follower":
        return f"{count} new followers"
    if n_type == "map_posted":
        return f"{count} new posts from people you follow"
    return ""


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
