"""Social graph — Phase 1 followers + Phase 2 feed & explore.

Endpoints:
    POST   /api/social/follow/{user_id}
    DELETE /api/social/follow/{user_id}
    GET    /api/social/followers/{user_id}
    GET    /api/social/following/{user_id}
    GET    /api/social/profile/{user_id}

    # Phase 2
    GET    /api/social/feed
    GET    /api/social/explore/trending
    GET    /api/social/explore/suggested
    GET    /api/social/users/search

    # Phase 3
    POST   /api/social/maps/{map_id}/like
    DELETE /api/social/maps/{map_id}/like
    GET    /api/social/maps/{map_id}/comments
    POST   /api/social/maps/{map_id}/comments
    DELETE /api/social/maps/{map_id}/comments/{comment_id}

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
- Feed query chunks followed-user IDs into groups of 30 (Firestore's `in` cap)
  and merges results client-side. Most students follow << 30 people, so this
  rarely fires. If it becomes hot we'll migrate to a write-amplified feed/{uid}
  subcollection — not now.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore_v1 import Increment
from google.cloud.firestore_v1.base_query import FieldFilter

from .. import models, schemas
from ..auth import get_current_user
from ..firestore import get_db
from .maps import _map_out as _map_out_helper
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


# ── Phase 2: Feed + Explore ────────────────────────────────────────────────

def _chunk(seq: list[str], size: int = 30) -> list[list[str]]:
    """Firestore caps `in` clauses at 30 values. Chunk helper."""
    return [seq[i:i + size] for i in range(0, len(seq), size)]


def _bulk_owner_docs(db, owner_ids: list[str]) -> dict:
    """Batch-load user docs for a set of owner ids."""
    unique_ids = list({oid for oid in owner_ids if oid})
    if not unique_ids:
        return {}
    refs = [db.collection(models.USERS).document(uid) for uid in unique_ids]
    try:
        docs = db.get_all(refs)
    except Exception:
        docs = [db.collection(models.USERS).document(uid).get() for uid in unique_ids]
    out = {}
    for d in docs:
        if d.exists:
            data = d.to_dict() or {}
            data["id"] = d.id
            out[d.id] = data
    return out


def _viewer_follows(db, viewer_id: str, owner_ids: list[str]) -> set[str]:
    """Which of these owner ids does the viewer follow? One batch read."""
    unique_ids = list({oid for oid in owner_ids if oid and oid != viewer_id})
    if not unique_ids:
        return set()
    refs = [db.collection(models.FOLLOWS).document(_edge_id(viewer_id, oid)) for oid in unique_ids]
    followed: set[str] = set()
    try:
        for d in db.get_all(refs):
            if d.exists:
                data = d.to_dict() or {}
                fid = data.get("followedId")
                if fid:
                    followed.add(fid)
    except Exception:
        for oid in unique_ids:
            if db.collection(models.FOLLOWS).document(_edge_id(viewer_id, oid)).get().exists:
                followed.add(oid)
    return followed


def _viewer_likes(db, viewer_id: str, map_ids: list[str]) -> set[str]:
    """Which of these maps has the viewer liked? One batch read."""
    unique_ids = list({m for m in map_ids if m})
    if not unique_ids:
        return set()
    refs = [db.collection(models.MAP_LIKES).document(f"{mid}_{viewer_id}") for mid in unique_ids]
    liked: set[str] = set()
    try:
        for d in db.get_all(refs):
            if d.exists:
                data = d.to_dict() or {}
                mid = data.get("mapId")
                if mid:
                    liked.add(mid)
    except Exception:
        for mid in unique_ids:
            if db.collection(models.MAP_LIKES).document(f"{mid}_{viewer_id}").get().exists:
                liked.add(mid)
    return liked


@router.get("/feed", response_model=list[schemas.MapOut])
def get_feed(
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Public maps posted by users the viewer follows, newest first.

    Phase 2: simple read-time aggregation. We fetch the viewer's followed-user
    ids, batch them into Firestore `in` chunks of 30, fetch each chunk's
    public maps sorted by publishedAt desc, merge and sort in Python, trim to
    `limit`. Fine while students follow << 30 people; if it gets hot later
    we'll migrate to per-user feed subcollections.
    """
    # 1. Who does the viewer follow?
    follow_docs = (
        db.collection(models.FOLLOWS)
        .where(filter=FieldFilter("followerId", "==", user["id"]))
        .limit(500)  # soft cap — 500 is already more than anyone will follow
        .get()
    )
    followed_ids = [d.to_dict().get("followedId") for d in follow_docs if d.to_dict().get("followedId")]
    if not followed_ids:
        return []

    # 2. Public maps from each chunk. One query per chunk-of-30.
    collected: list[dict] = []
    for chunk in _chunk(followed_ids, 30):
        try:
            docs = (
                db.collection(models.MAPS)
                .where(filter=FieldFilter("ownerId", "in", chunk))
                .where(filter=FieldFilter("visibility", "==", "public"))
                .order_by("publishedAt", direction="DESCENDING")
                .limit(limit * 2)  # over-fetch per chunk; we'll trim after merge
                .get()
            )
        except Exception:
            # Missing composite index or similar — fall back to a single-field
            # query then filter client-side. Slower but unblocks deploys.
            docs = (
                db.collection(models.MAPS)
                .where(filter=FieldFilter("ownerId", "in", chunk))
                .limit(limit * 4)
                .get()
            )
        for d in docs:
            data = d.to_dict() or {}
            if (data.get("visibility") or "").lower() != "public":
                continue
            data["id"] = d.id
            collected.append(data)

    # 3. Sort merged results newest-first.
    def _published_key(m: dict):
        ts = m.get("publishedAt") or m.get("lastModified")
        if hasattr(ts, "timestamp"):
            return ts.timestamp()
        return 0
    collected.sort(key=_published_key, reverse=True)
    collected = collected[:limit]

    # 4. Enrich with owner + viewer-relative flags (batched).
    owner_map = _bulk_owner_docs(db, [m.get("ownerId", "") for m in collected])
    map_ids = [m["id"] for m in collected]
    liked_ids = _viewer_likes(db, user["id"], map_ids)

    return [
        _map_out_helper(
            m,
            owner=owner_map.get(m.get("ownerId", "")),
            is_liked_by_me=(m["id"] in liked_ids),
            owner_is_followed_by_me=True,  # feed is always from followed users
        )
        for m in collected
    ]


@router.get("/explore/trending", response_model=list[schemas.MapOut])
def get_trending(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Global public maps ordered by likeCount desc, optionally windowed to
    the last N days. Used by the Explore → Trending tab."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    collected: list[dict] = []
    try:
        docs = (
            db.collection(models.MAPS)
            .where(filter=FieldFilter("visibility", "==", "public"))
            .where(filter=FieldFilter("publishedAt", ">=", cutoff))
            .order_by("publishedAt", direction="DESCENDING")
            .order_by("likeCount", direction="DESCENDING")
            .limit(max(limit * 4, 40))
            .get()
        )
        for d in docs:
            data = d.to_dict() or {}
            data["id"] = d.id
            collected.append(data)
    except Exception:
        # Fallback without the date window if the composite index isn't built.
        docs = (
            db.collection(models.MAPS)
            .where(filter=FieldFilter("visibility", "==", "public"))
            .limit(max(limit * 4, 40))
            .get()
        )
        for d in docs:
            data = d.to_dict() or {}
            data["id"] = d.id
            collected.append(data)

    # Final sort by like count desc (tiebreak: publishedAt desc).
    def _rank(m: dict) -> tuple[int, float]:
        likes = int(m.get("likeCount", 0) or 0)
        ts = m.get("publishedAt") or m.get("lastModified")
        ts_val = ts.timestamp() if hasattr(ts, "timestamp") else 0
        return (likes, ts_val)
    collected.sort(key=_rank, reverse=True)
    collected = collected[:limit]

    # Enrich.
    owner_map = _bulk_owner_docs(db, [m.get("ownerId", "") for m in collected])
    map_ids = [m["id"] for m in collected]
    liked_ids = _viewer_likes(db, user["id"], map_ids)
    followed_ids = _viewer_follows(db, user["id"], [m.get("ownerId", "") for m in collected])

    return [
        _map_out_helper(
            m,
            owner=owner_map.get(m.get("ownerId", "")),
            is_liked_by_me=(m["id"] in liked_ids),
            owner_is_followed_by_me=(m.get("ownerId") in followed_ids),
        )
        for m in collected
    ]


@router.get("/explore/suggested", response_model=list[schemas.PublicProfileOut])
def get_suggested_users(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Students I don't follow yet, ranked by followerCount. A lightweight
    v1 — later phases can factor in shared classes, similar interests, etc."""
    # Who am I already following (so we can exclude them)?
    following_docs = (
        db.collection(models.FOLLOWS)
        .where(filter=FieldFilter("followerId", "==", user["id"]))
        .limit(500)
        .get()
    )
    followed_ids = {d.to_dict().get("followedId") for d in following_docs if d.to_dict().get("followedId")}
    followed_ids.add(user["id"])  # exclude self

    try:
        candidates = (
            db.collection(models.USERS)
            .where(filter=FieldFilter("role", "==", "student"))
            .order_by("followerCount", direction="DESCENDING")
            .limit(limit * 3)
            .get()
        )
    except Exception:
        # No composite index yet — fall back to unfiltered read.
        candidates = (
            db.collection(models.USERS)
            .where(filter=FieldFilter("role", "==", "student"))
            .limit(limit * 5)
            .get()
        )

    out: list[schemas.PublicProfileOut] = []
    for d in candidates:
        data = d.to_dict() or {}
        data["id"] = d.id
        if d.id in followed_ids:
            continue
        out.append(_public_profile(data, is_followed_by_me=False))
        if len(out) >= limit:
            break
    return out


@router.get("/users/search", response_model=list[schemas.PublicProfileOut])
def search_users(
    q: str = Query("", min_length=0),
    limit: int = Query(15, ge=1, le=50),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Student search for the Explore page's Find Classmates field. Case-
    insensitive prefix match on email + substring match on displayName."""
    term = (q or "").strip().lower()
    if len(term) < 2:
        return []

    results: list[dict] = []
    seen: set[str] = set()

    # Prefix on email — efficient with the ordered email index.
    try:
        email_docs = (
            db.collection(models.USERS)
            .where(filter=FieldFilter("role", "==", "student"))
            .order_by("email")
            .start_at({"email": term})
            .end_at({"email": term + ""})
            .limit(limit)
            .get()
        )
        for d in email_docs:
            data = d.to_dict() or {}
            data["id"] = d.id
            if d.id == user["id"] or d.id in seen:
                continue
            seen.add(d.id)
            results.append(data)
    except Exception:
        pass

    # Substring on displayName — scan up to 200 students. Cheap enough for a
    # typeahead while the population is small.
    if len(results) < limit:
        try:
            all_docs = (
                db.collection(models.USERS)
                .where(filter=FieldFilter("role", "==", "student"))
                .limit(200)
                .get()
            )
            for d in all_docs:
                if d.id == user["id"] or d.id in seen:
                    continue
                data = d.to_dict() or {}
                data["id"] = d.id
                name = (data.get("displayName") or "").lower()
                email = (data.get("email") or "").lower()
                if term in name or term in email:
                    seen.add(d.id)
                    results.append(data)
                    if len(results) >= limit:
                        break
        except Exception:
            pass

    # Attach is_followed_by_me flags in one batch.
    followed_ids = _viewer_follows(db, user["id"], [r["id"] for r in results])
    return [_public_profile(r, is_followed_by_me=(r["id"] in followed_ids)) for r in results]


# ── Phase 3: Likes + Comments ──────────────────────────────────────────────

def _like_id(map_id: str, user_id: str) -> str:
    return f"{map_id}_{user_id}"


def _require_readable_map(db, map_id: str, user: dict) -> dict:
    """Return the map doc if the viewer is allowed to see it — same rules as
    get_map (owner, collaborator, lecturer, admin, or public/unlisted).

    Raises 404 (not 403) for strangers on private maps so we don't leak
    existence.
    """
    snap = db.collection(models.MAPS).document(map_id).get()
    if not snap.exists:
        raise HTTPException(404, "Map not found")
    m = snap.to_dict() or {}
    m["id"] = map_id

    viewer_role = (user.get("role") or "").lower()
    viewer_email = (user.get("email") or "").lower()
    collab_emails = [c.lower() for c in (m.get("collaborators") or [])]
    visibility = (m.get("visibility") or "private").lower()
    is_owner = m.get("ownerId") == user["id"]
    is_collab = viewer_email and viewer_email in collab_emails
    is_lecturer = viewer_role == "lecturer"
    is_admin = viewer_role == "admin"
    allowed = (
        is_owner or is_collab or is_lecturer or is_admin
        or visibility in ("public", "unlisted")
    )
    if not allowed:
        raise HTTPException(404, "Map not found")
    return m


@router.post("/maps/{map_id}/like", status_code=201)
def like_map(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Add a like. Idempotent — a repeat call returns already_liked without
    double-counting. Fires a map_like notification to the owner the first
    time, respecting their notificationPrefs."""
    m = _require_readable_map(db, map_id, user)

    like_ref = db.collection(models.MAP_LIKES).document(_like_id(map_id, user["id"]))
    if like_ref.get().exists:
        return {"ok": True, "already_liked": True, "like_count": int(m.get("likeCount", 0) or 0)}

    now = datetime.now(timezone.utc)
    like_ref.set({
        "mapId": map_id,
        "userId": user["id"],
        "createdAt": now,
    })
    try:
        db.collection(models.MAPS).document(map_id).update({"likeCount": Increment(1)})
    except Exception as e:
        logger.warning("likeCount increment failed for %s: %s", map_id, e)

    # Notify the owner (skip self-likes; respect pref).
    owner_id = m.get("ownerId", "")
    if owner_id and owner_id != user["id"]:
        try:
            owner_snap = db.collection(models.USERS).document(owner_id).get()
            owner = owner_snap.to_dict() or {}
            prefs = owner.get("notificationPrefs") or {}
            if prefs.get("mapLike", True) is not False:
                create_notification(
                    db,
                    user_id=owner_id,
                    title="Your mind map was liked",
                    message=f"{user.get('displayName', 'Someone')} liked \"{m.get('title', 'your map')}\".",
                    notification_type="map_like",
                    link=f"/view-map/{map_id}",
                )
        except Exception as e:
            logger.warning("map_like notification failed: %s", e)

    return {"ok": True, "already_liked": False, "like_count": int(m.get("likeCount", 0) or 0) + 1}


@router.delete("/maps/{map_id}/like")
def unlike_map(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Remove a like. Idempotent."""
    like_ref = db.collection(models.MAP_LIKES).document(_like_id(map_id, user["id"]))
    if not like_ref.get().exists:
        return {"ok": True, "was_liked": False}
    like_ref.delete()
    try:
        db.collection(models.MAPS).document(map_id).update({"likeCount": Increment(-1)})
    except Exception:
        pass
    return {"ok": True, "was_liked": True}


def _comment_out(c: dict, author_photo: str | None = None) -> schemas.MapCommentOut:
    return schemas.MapCommentOut(
        id=c["id"],
        map_id=c.get("mapId", ""),
        author_id=c.get("authorId", ""),
        author_name=c.get("authorName", ""),
        author_photo_url=author_photo if author_photo is not None else c.get("authorPhotoURL"),
        text=c.get("text", ""),
        created_at=c.get("createdAt", datetime.now(timezone.utc)),
    )


@router.get("/maps/{map_id}/comments", response_model=list[schemas.MapCommentOut])
def list_comments(
    map_id: str,
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Newest-first comment list for a map. Viewer must be able to read the
    map (public/unlisted, owner, collaborator, or elevated role)."""
    _require_readable_map(db, map_id, user)

    docs = (
        db.collection(models.MAP_COMMENTS)
        .where(filter=FieldFilter("mapId", "==", map_id))
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
        .get()
    )
    rows = [models.doc_to_dict(d) for d in docs]
    rows = [r for r in rows if r]

    # Batch fetch live author photos (denormalised snapshot can go stale).
    photo_map = models.get_user_photo_urls(db, [r.get("authorId") for r in rows])
    return [_comment_out(r, photo_map.get(r.get("authorId"))) for r in rows]


@router.post("/maps/{map_id}/comments", response_model=schemas.MapCommentOut, status_code=201)
def create_comment(
    map_id: str,
    req: schemas.MapCommentCreate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Post a comment on a map. 500-char cap server-side."""
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "Comment cannot be empty")
    if len(text) > 500:
        text = text[:500]

    m = _require_readable_map(db, map_id, user)

    cid = models.gen_id()
    now = datetime.now(timezone.utc)
    photo_url = (user.get("photoURL") or "") or None
    data = {
        "mapId": map_id,
        "authorId": user["id"],
        "authorName": user.get("displayName", ""),
        "authorPhotoURL": photo_url,
        "text": text,
        "createdAt": now,
    }
    db.collection(models.MAP_COMMENTS).document(cid).set(data)
    data["id"] = cid

    try:
        db.collection(models.MAPS).document(map_id).update({"commentCount": Increment(1)})
    except Exception as e:
        logger.warning("commentCount increment failed for %s: %s", map_id, e)

    # Notify the owner (skip self-comments; respect pref; truncate preview).
    owner_id = m.get("ownerId", "")
    if owner_id and owner_id != user["id"]:
        try:
            owner_snap = db.collection(models.USERS).document(owner_id).get()
            owner = owner_snap.to_dict() or {}
            prefs = owner.get("notificationPrefs") or {}
            if prefs.get("mapComment", True) is not False:
                preview = text if len(text) <= 120 else text[:117] + "..."
                create_notification(
                    db,
                    user_id=owner_id,
                    title="New comment on your mind map",
                    message=f"{user.get('displayName', 'Someone')}: \"{preview}\"",
                    notification_type="map_comment",
                    link=f"/view-map/{map_id}",
                )
        except Exception as e:
            logger.warning("map_comment notification failed: %s", e)

    return _comment_out(data, photo_url)


@router.delete("/maps/{map_id}/comments/{comment_id}")
def delete_comment(
    map_id: str,
    comment_id: str,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete a comment. Author can delete their own; map owner can delete any
    comment on their map."""
    c_ref = db.collection(models.MAP_COMMENTS).document(comment_id)
    c_snap = c_ref.get()
    if not c_snap.exists:
        raise HTTPException(404, "Comment not found")
    c = c_snap.to_dict() or {}
    if c.get("mapId") != map_id:
        raise HTTPException(404, "Comment not found on this map")

    # Permissions
    if c.get("authorId") != user["id"]:
        m_snap = db.collection(models.MAPS).document(map_id).get()
        m = m_snap.to_dict() or {}
        if m.get("ownerId") != user["id"] and (user.get("role") or "").lower() != "admin":
            raise HTTPException(403, "Not allowed to delete this comment")

    c_ref.delete()
    try:
        db.collection(models.MAPS).document(map_id).update({"commentCount": Increment(-1)})
    except Exception:
        pass
    return {"ok": True}
