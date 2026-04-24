"""Social graph — Phase 1 followers foundations.

Endpoints:
    POST   /api/social/follow/{user_id}
    DELETE /api/social/follow/{user_id}
    GET    /api/social/followers/{user_id}
    GET    /api/social/following/{user_id}
    GET    /api/social/profile/{user_id}

Design notes:
- Follow edges live in `follows/{followerId}_{followedId}` so "am I following X?"
  is a single doc.get(). Prevents duplicate follows without a transaction.
- Counters (`followerCount`, `followingCount`) live on the user doc and are
  updated atomically with `Increment(±1)`. Two writes per follow/unfollow: the
  edge doc, plus both users' counters. If a counter write fails we log but
  don't roll back — nightly reconcile if drift is ever visible.
- new_follower notification fires through `create_notification()` which also
  mirrors to SMTP email, respecting the target's emailNotifications flag.
- Students can only follow / be followed by other students — enforced server-
  side so the lecturer↔student boundary stays clean.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore_v1 import Increment
from google.cloud.firestore_v1.base_query import FieldFilter

from .. import models, schemas
from ..auth import get_current_user
from ..firestore import get_db
from .notifications import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/social", tags=["Social"])


# ── Helpers ────────────────────────────────────────────────────────────────

def _edge_id(follower_id: str, followed_id: str) -> str:
    return f"{follower_id}_{followed_id}"


def _require_student(user_doc: dict, subject: str = "user") -> None:
    if (user_doc.get("role") or "").lower() != "student":
        raise HTTPException(400, f"Following is only available between students (got role={user_doc.get('role')} for {subject})")


def _public_profile(u: dict, is_followed_by_me: bool = False) -> schemas.PublicProfileOut:
    return schemas.PublicProfileOut(
        id=u["id"],
        display_name=u.get("displayName", ""),
        photo_url=u.get("photoURL", "") or "",
        cover_photo_url=u.get("coverPhotoURL", "") or "",
        bio=u.get("bio", "") or "",
        role=u.get("role", "student"),
        follower_count=int(u.get("followerCount", 0) or 0),
        following_count=int(u.get("followingCount", 0) or 0),
        is_followed_by_me=is_followed_by_me,
        created_at=u.get("createdAt"),
    )


def _is_followed(db, follower_id: str, followed_id: str) -> bool:
    if not follower_id or not followed_id or follower_id == followed_id:
        return False
    return db.collection(models.FOLLOWS).document(_edge_id(follower_id, followed_id)).get().exists


# ── Follow / unfollow ──────────────────────────────────────────────────────

@router.post("/follow/{user_id}", status_code=201)
def follow_user(user_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    if user_id == user["id"]:
        raise HTTPException(400, "Cannot follow yourself")

    _require_student(user, "you")

    target_ref = db.collection(models.USERS).document(user_id)
    target_snap = target_ref.get()
    if not target_snap.exists:
        raise HTTPException(404, "User not found")
    target = target_snap.to_dict() or {}
    target["id"] = user_id
    _require_student(target, "target user")

    edge_ref = db.collection(models.FOLLOWS).document(_edge_id(user["id"], user_id))
    if edge_ref.get().exists:
        return {"ok": True, "already_following": True}

    now = datetime.now(timezone.utc)
    edge_ref.set({
        "followerId": user["id"],
        "followedId": user_id,
        "createdAt": now,
    })

    # Bump counters (best-effort; drift self-heals via a reconcile script).
    try:
        db.collection(models.USERS).document(user["id"]).update({"followingCount": Increment(1)})
    except Exception as e:
        logger.warning("following counter increment failed for %s: %s", user["id"], e)
    try:
        target_ref.update({"followerCount": Increment(1)})
    except Exception as e:
        logger.warning("follower counter increment failed for %s: %s", user_id, e)

    # Respect target's notification pref (default True if unset).
    prefs = (target.get("notificationPrefs") or {})
    if prefs.get("newFollower", True) is not False:
        try:
            create_notification(
                db,
                user_id=user_id,
                title="You have a new follower",
                message=f"{user.get('displayName', 'Someone')} started following you.",
                notification_type="new_follower",
                link=f"/student/profile/{user['id']}",
            )
        except Exception as e:
            logger.warning("new_follower notification failed: %s", e)

    return {"ok": True, "already_following": False}


@router.delete("/follow/{user_id}")
def unfollow_user(user_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    if user_id == user["id"]:
        raise HTTPException(400, "Cannot unfollow yourself")

    edge_ref = db.collection(models.FOLLOWS).document(_edge_id(user["id"], user_id))
    if not edge_ref.get().exists:
        return {"ok": True, "was_following": False}

    edge_ref.delete()
    try:
        db.collection(models.USERS).document(user["id"]).update({"followingCount": Increment(-1)})
    except Exception:
        pass
    try:
        db.collection(models.USERS).document(user_id).update({"followerCount": Increment(-1)})
    except Exception:
        pass
    return {"ok": True, "was_following": True}


# ── Followers / following lists ────────────────────────────────────────────

def _list_edges(
    db,
    viewer_id: str,
    key_field: str,   # "followedId" = target, queries who I follow. "followerId" = source.
    match_field: str, # "followerId"  = whose following list. "followedId"  = whose followers list.
    match_value: str,
    limit: int,
) -> list[dict]:
    docs = (
        db.collection(models.FOLLOWS)
        .where(filter=FieldFilter(match_field, "==", match_value))
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
        .get()
    )
    edge_dicts = [d.to_dict() or {} for d in docs]
    other_ids = [e.get(key_field) for e in edge_dicts if e.get(key_field)]
    if not other_ids:
        return []

    # Batch-load user docs.
    refs = [db.collection(models.USERS).document(uid) for uid in other_ids]
    try:
        user_docs = db.get_all(refs)
    except Exception:
        user_docs = [db.collection(models.USERS).document(uid).get() for uid in other_ids]

    by_id = {}
    for d in user_docs:
        if d.exists:
            data = d.to_dict() or {}
            data["id"] = d.id
            by_id[d.id] = data

    # Batch-load my follow edges for the "am I following X?" flag.
    my_follows: set[str] = set()
    if viewer_id and other_ids:
        try:
            follow_refs = [db.collection(models.FOLLOWS).document(_edge_id(viewer_id, uid)) for uid in other_ids]
            for d in db.get_all(follow_refs):
                if d.exists:
                    data = d.to_dict() or {}
                    fid = data.get("followedId")
                    if fid:
                        my_follows.add(fid)
        except Exception:
            pass

    out = []
    for uid in other_ids:
        u = by_id.get(uid)
        if not u:
            continue
        out.append(_public_profile(u, is_followed_by_me=(uid in my_follows)))
    return out


@router.get("/followers/{user_id}", response_model=list[schemas.PublicProfileOut])
def list_followers(
    user_id: str,
    limit: int = Query(100, le=500),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return _list_edges(
        db,
        viewer_id=user["id"],
        key_field="followerId",   # the follower is the "other" user in a follower list
        match_field="followedId",
        match_value=user_id,
        limit=limit,
    )


@router.get("/following/{user_id}", response_model=list[schemas.PublicProfileOut])
def list_following(
    user_id: str,
    limit: int = Query(100, le=500),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return _list_edges(
        db,
        viewer_id=user["id"],
        key_field="followedId",   # the followed user is the "other" user in a following list
        match_field="followerId",
        match_value=user_id,
        limit=limit,
    )


# ── Public profile ─────────────────────────────────────────────────────────

@router.get("/profile/{user_id}", response_model=schemas.PublicProfileOut)
def get_public_profile(
    user_id: str,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    snap = db.collection(models.USERS).document(user_id).get()
    if not snap.exists:
        raise HTTPException(404, "User not found")
    u = snap.to_dict() or {}
    u["id"] = user_id
    is_followed = _is_followed(db, user["id"], user_id)
    return _public_profile(u, is_followed_by_me=is_followed)
