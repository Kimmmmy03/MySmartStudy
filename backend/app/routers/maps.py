from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from google.cloud.firestore_v1 import ArrayUnion, ArrayRemove
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from ..audit import audit_log
from .activity import log_activity
from .auto_badges import check_and_award_badges as check_auto_badges
from .notifications import create_notification
from datetime import datetime, timezone
import os, uuid, aiofiles
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/maps", tags=["Maps"])

# snake_case API field → camelCase Firestore field
_MAP_FIELD_MAP = {
    "graph_data": "graphData",
    "nodes_text": "nodesText",
}

_VALID_VISIBILITIES = {"private", "unlisted", "public"}


def _map_out(
    m: dict,
    *,
    owner: dict | None = None,
    is_liked_by_me: bool | None = None,
    owner_is_followed_by_me: bool | None = None,
) -> schemas.MapOut:
    """Map camelCase Firestore fields → snake_case API response.

    When `owner` is passed the response includes display name + photo for the
    map author, so feed / explore UIs don't need a second lookup per card.
    Viewer-relative flags pass through untouched when None so list endpoints
    can omit them.
    """
    last_mod = m.get("lastModified") or datetime.now(timezone.utc)
    owner = owner or {}
    return schemas.MapOut(
        id=m["id"],
        owner_id=m.get("ownerId", ""),
        owner_email=m.get("ownerEmail", ""),
        owner_name=owner.get("displayName", "") or "",
        owner_photo_url=owner.get("photoURL") or None,
        title=m.get("title", "Untitled Map"),
        graph_data=m.get("graphData", "{}"),
        graph_format=m.get("graphFormat", "reactflow"),
        nodes_text=m.get("nodesText", ""),
        thumbnail=m.get("thumbnail", ""),
        share_code=m.get("shareCode", ""),
        collaborators=m.get("collaborators", []),
        visibility=m.get("visibility", "private") or "private",
        like_count=int(m.get("likeCount", 0) or 0),
        comment_count=int(m.get("commentCount", 0) or 0),
        published_at=m.get("publishedAt"),
        is_liked_by_me=is_liked_by_me,
        owner_is_followed_by_me=owner_is_followed_by_me,
        last_modified=last_mod,
    )


def _to_firestore_fields(updates: dict) -> dict:
    """Convert snake_case update keys to camelCase Firestore keys."""
    return {_MAP_FIELD_MAP.get(k, k): v for k, v in updates.items()}


def _log_map_history(db, map_id: str, user: dict, action: str, summary: str):
    """Write a history entry for a map change."""
    entry_id = models.gen_id()
    db.collection(models.MAP_HISTORY).document(entry_id).set({
        "mapId": map_id,
        "userId": user["id"],
        "userEmail": user.get("email", ""),
        "userName": user.get("displayName", user.get("email", "Unknown")),
        "action": action,
        "summary": summary,
        "createdAt": datetime.now(timezone.utc),
    })


def _gen_unique_share_code(db) -> str:
    for _ in range(10):
        code = models.gen_code()
        existing = db.collection(models.MAPS).where(filter=FieldFilter("shareCode", "==", code)).limit(1).get()
        if not list(existing):
            return code
    return models.gen_code()


@router.get("/", response_model=list[schemas.MapOut])
def get_my_maps(user: dict = Depends(get_current_user), db=Depends(get_db), limit: int = Query(100)):
    # Own maps
    own_docs = (
        db.collection(models.MAPS)
        .where(filter=FieldFilter("ownerId", "==", user["id"]))
        .order_by("lastModified", direction="DESCENDING")
        .limit(limit)
        .get()
    )
    own_ids = set()
    results = []
    for d in own_docs:
        m = models.doc_to_dict(d)
        own_ids.add(m["id"])
        results.append(_map_out(m))

    # Collaborated maps (where user's email is in the collaborators array)
    email = user.get("email", "")
    if email:
        collab_docs = (
            db.collection(models.MAPS)
            .where(filter=FieldFilter("collaborators", "array_contains", email))
            .order_by("lastModified", direction="DESCENDING")
            .limit(limit)
            .get()
        )
        for d in collab_docs:
            m = models.doc_to_dict(d)
            if m["id"] not in own_ids:
                results.append(_map_out(m))

    # Sort combined results by last_modified descending
    results.sort(key=lambda x: x.last_modified, reverse=True)
    return results


@router.post("/", response_model=schemas.MapOut, status_code=201)
def create_map(req: schemas.MapCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    map_id = models.gen_id()
    now = datetime.now(timezone.utc)
    visibility = (req.visibility or "private").lower()
    if visibility not in _VALID_VISIBILITIES:
        visibility = "private"
    data = {
        "ownerId": user["id"],
        "ownerEmail": user.get("email", ""),
        "title": req.title,
        "graphData": req.graph_data,
        "graphFormat": req.graph_format,
        "nodesText": req.nodes_text,
        "thumbnail": req.thumbnail,
        "shareCode": _gen_unique_share_code(db),
        "collaborators": [],
        "visibility": visibility,
        "likeCount": 0,
        "commentCount": 0,
        "publishedAt": now if visibility == "public" else None,
        "lastModified": now,
    }
    db.collection(models.MAPS).document(map_id).set(data)
    data["id"] = map_id
    audit_log(db, user["id"], "create", "map", map_id, f"Created map: {req.title}")
    log_activity(db, user["id"], "created", "map", map_id, req.title)
    _log_map_history(db, map_id, user, "created", f"Created map \"{req.title}\"")
    try:
        check_auto_badges(db, user["id"])
    except Exception:
        pass
    return _map_out(data)


@router.get("/search/by-code", response_model=list[schemas.MapOut])
def search_by_code(code: str = Query(...), user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = db.collection(models.MAPS).where(filter=FieldFilter("shareCode", "==", code.upper())).get()
    return [_map_out(models.doc_to_dict(d)) for d in docs]


@router.get("/search/by-email", response_model=list[schemas.MapOut])
def search_by_email(email: str = Query(...), user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Search maps by exact owner email."""
    docs = db.collection(models.MAPS).where(filter=FieldFilter("ownerEmail", "==", email.lower())).get()
    return [_map_out(models.doc_to_dict(d)) for d in docs]


@router.get("/search/students")
def search_students(
    q: str = Query("", min_length=1),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Search student users by partial email or display name for autocomplete."""
    results = []
    seen = set()
    query_lower = q.lower()

    # Search by email prefix
    email_docs = (
        db.collection(models.USERS)
        .where(filter=FieldFilter("role", "==", "student"))
        .order_by("email")
        .start_at({"email": query_lower})
        .end_at({"email": query_lower + "\uf8ff"})
        .limit(15)
        .get()
    )
    for d in email_docs:
        u = models.doc_to_dict(d)
        if u and u["id"] not in seen:
            seen.add(u["id"])
            results.append({
                "id": u["id"],
                "display_name": u.get("displayName", ""),
                "email": u.get("email", ""),
                "photo_url": u.get("photoURL", ""),
            })

    # Also search by display name containing query
    if len(results) < 15:
        all_students = (
            db.collection(models.USERS)
            .where(filter=FieldFilter("role", "==", "student"))
            .limit(200)
            .get()
        )
        for d in all_students:
            u = models.doc_to_dict(d)
            if u and u["id"] not in seen:
                name = (u.get("displayName", "") or "").lower()
                email = (u.get("email", "") or "").lower()
                if query_lower in name or query_lower in email:
                    seen.add(u["id"])
                    results.append({
                        "id": u["id"],
                        "display_name": u.get("displayName", ""),
                        "email": u.get("email", ""),
                        "photo_url": u.get("photoURL", ""),
                    })
                    if len(results) >= 15:
                        break
    return results[:15]


@router.get("/search/by-course/{course_id}", response_model=list[schemas.MapOut])
def search_by_course(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get maps submitted via assignments for a specific course."""
    course_doc = db.collection(models.COURSES).document(course_id).get()
    if not course_doc.exists:
        raise HTTPException(status_code=404, detail="Course not found")
    course = course_doc.to_dict()
    if course.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your course")

    # 1. Get all assignments for this course
    assign_docs = db.collection(models.ASSIGNMENTS).where(
        filter=FieldFilter("courseId", "==", course_id)
    ).get()
    assignment_ids = [models.doc_to_dict(d)["id"] for d in assign_docs]
    if not assignment_ids:
        return []

    # 2. Get all submissions for those assignments that have a mapId
    map_ids: set[str] = set()
    for i in range(0, len(assignment_ids), 30):
        batch = assignment_ids[i:i + 30]
        sub_docs = db.collection(models.SUBMISSIONS).where(
            filter=FieldFilter("assignmentId", "in", batch)
        ).get()
        for sd in sub_docs:
            sub = models.doc_to_dict(sd)
            mid = sub.get("mapId")
            if mid:
                map_ids.add(mid)
    if not map_ids:
        return []

    # 3. Fetch the actual maps
    all_maps = []
    map_id_list = list(map_ids)
    for i in range(0, len(map_id_list), 30):
        batch = map_id_list[i:i + 30]
        for mid in batch:
            doc = db.collection(models.MAPS).document(mid).get()
            if doc.exists:
                all_maps.append(_map_out(models.doc_to_dict(doc)))
    return all_maps


@router.get("/views/recent")
def get_recent_map_views(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Return the current user's recently viewed maps (enriched), newest first.

    Filters out entries whose underlying map no longer exists. Lecturer-only in practice,
    but not gated by role — if a student ever records a view it'll round-trip fine.
    """
    docs = (
        db.collection(models.MAP_VIEWS)
        .where(filter=FieldFilter("userId", "==", user["id"]))
        .order_by("viewedAt", direction="DESCENDING")
        .limit(20)
        .get()
    )
    out = []
    for d in docs:
        v = d.to_dict()
        map_id = v.get("mapId")
        if not map_id:
            continue
        map_doc = db.collection(models.MAPS).document(map_id).get()
        if not map_doc.exists:
            continue
        m = map_doc.to_dict()
        out.append({
            "id": map_id,
            "title": m.get("title", "Untitled Map"),
            "owner_email": m.get("ownerEmail", ""),
            "thumbnail": m.get("thumbnail", ""),
            "share_code": m.get("shareCode", ""),
            "last_modified": m.get("lastModified").isoformat() if m.get("lastModified") else "",
            "viewed_at": v.get("viewedAt", ""),
        })
    return out


@router.post("/{map_id}/view")
def mark_map_viewed(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Stamp that the current user just viewed this map. Recorded for lecturers only
    (students don't need a 'recently reviewed' list). Upserts on (userId, mapId)."""
    if user.get("role") != "lecturer":
        return {"ok": True, "skipped": True}
    map_doc = db.collection(models.MAPS).document(map_id).get()
    if not map_doc.exists:
        raise HTTPException(status_code=404, detail="Map not found")
    doc_id = f"{user['id']}_{map_id}"
    db.collection(models.MAP_VIEWS).document(doc_id).set({
        "userId": user["id"],
        "mapId": map_id,
        "viewedAt": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@router.get("/{map_id}", response_model=schemas.MapOut)
def get_map(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.MAPS).document(map_id).get()
    m = models.doc_to_dict(doc)
    if not m:
        raise HTTPException(status_code=404, detail="Map not found")

    # Read gate: owner / collaborators / lecturers / public visibility all OK.
    # Unlisted maps are accessible to anyone who hits this endpoint with the id
    # (they typically arrive via the shareCode lookup which returns the id).
    viewer_role = (user.get("role") or "").lower()
    viewer_email = (user.get("email") or "").lower()
    collab_emails = [c.lower() for c in (m.get("collaborators") or [])]
    visibility = (m.get("visibility") or "private").lower()
    is_owner = m.get("ownerId") == user["id"]
    is_collab = viewer_email and viewer_email in collab_emails
    is_lecturer = viewer_role == "lecturer"
    is_admin = viewer_role == "admin"
    allowed = (
        is_owner
        or is_collab
        or is_lecturer
        or is_admin
        or visibility in ("public", "unlisted")
    )
    if not allowed:
        # Hide existence rather than leak a 403 — matches how the UI expects
        # "you can't see this map" to behave.
        raise HTTPException(status_code=404, detail="Map not found")

    # Log lecturer view + notify owner (deduped to once/day per lecturer per map)
    if is_lecturer and m.get("ownerId") != user["id"]:
        try:
            _log_map_history(db, map_id, user, "viewed", f"Lecturer {user.get('displayName', '')} viewed this map")
        except Exception:
            pass
        try:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            flag_id = f"mv_{user['id']}_{map_id}_{today}"
            flag_ref = db.collection("mapViewNotifyFlags").document(flag_id)
            if not flag_ref.get().exists:
                flag_ref.set({"createdAt": datetime.now(timezone.utc)})
                create_notification(
                    db,
                    user_id=m["ownerId"],
                    title="Your mind map was viewed",
                    message=f"{user.get('displayName', 'A lecturer')} opened \"{m.get('title', 'your map')}\".",
                    notification_type="map_view",
                    link=f"/view-map/{map_id}",
                    send_email=False,  # In-app only; email would be spammy
                )
        except Exception:
            pass

    # Enrich response with owner profile + viewer-relative flags.
    owner: dict | None = None
    is_liked_by_me: bool | None = None
    owner_is_followed_by_me: bool | None = None
    try:
        owner_id = m.get("ownerId", "")
        if owner_id:
            o_snap = db.collection(models.USERS).document(owner_id).get()
            if o_snap.exists:
                owner = o_snap.to_dict() or {}
            if user.get("id") and owner_id != user["id"]:
                like_id = f"{map_id}_{user['id']}"
                is_liked_by_me = db.collection(models.MAP_LIKES).document(like_id).get().exists
                follow_id = f"{user['id']}_{owner_id}"
                owner_is_followed_by_me = db.collection(models.FOLLOWS).document(follow_id).get().exists
    except Exception:
        pass

    return _map_out(
        m,
        owner=owner,
        is_liked_by_me=is_liked_by_me,
        owner_is_followed_by_me=owner_is_followed_by_me,
    )


@router.get("/{map_id}/visitors")
def get_map_visitors(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get lecturers who have visited this map (from history)."""
    try:
        docs = (
            db.collection(models.MAP_HISTORY)
            .where(filter=FieldFilter("mapId", "==", map_id))
            .where(filter=FieldFilter("action", "==", "viewed"))
            .order_by("createdAt", direction="DESCENDING")
            .limit(50)
            .get()
        )
        entries = [models.doc_to_dict(d) for d in docs]
    except Exception:
        # Fallback: composite index may not exist — query by mapId only
        # and filter in Python
        docs = (
            db.collection(models.MAP_HISTORY)
            .where(filter=FieldFilter("mapId", "==", map_id))
            .limit(200)
            .get()
        )
        entries = [
            models.doc_to_dict(d) for d in docs
            if models.doc_to_dict(d).get("action") == "viewed"
        ]
        entries.sort(key=lambda h: h.get("createdAt", ""), reverse=True)
        entries = entries[:50]

    visitors = {}
    for h in entries:
        uid = h.get("userId", "")
        if uid not in visitors:
            visitors[uid] = {
                "user_id": uid,
                "user_email": h.get("userEmail", ""),
                "user_name": h.get("userName", ""),
                "last_visited": h.get("createdAt", ""),
                "visit_count": 0,
            }
        visitors[uid]["visit_count"] += 1
    return list(visitors.values())


@router.patch("/{map_id}", response_model=schemas.MapOut)
def update_map(map_id: str, req: schemas.MapUpdate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc_ref = db.collection(models.MAPS).document(map_id)
    doc = doc_ref.get()
    m = models.doc_to_dict(doc)
    if not m:
        raise HTTPException(status_code=404, detail="Map not found")
    # Only owner / collaborators can mutate a map.
    owner_email = (m.get("ownerEmail") or "").lower()
    viewer_email = (user.get("email") or "").lower()
    is_owner = m.get("ownerId") == user["id"]
    is_collab = viewer_email and viewer_email in [c.lower() for c in (m.get("collaborators") or [])]
    if not (is_owner or is_collab):
        raise HTTPException(status_code=403, detail="Not authorized to edit this map")

    updates = req.model_dump(exclude_unset=True)
    # Validate + normalise visibility if present. Stamp publishedAt on first
    # transition to public so trending queries have a sort key.
    if "visibility" in updates:
        new_vis = (updates["visibility"] or "private").lower()
        if new_vis not in _VALID_VISIBILITIES:
            raise HTTPException(status_code=400, detail="Invalid visibility")
        updates["visibility"] = new_vis
        prev_vis = (m.get("visibility") or "private").lower()
        if new_vis == "public" and prev_vis != "public" and not m.get("publishedAt"):
            updates["published_at"] = datetime.now(timezone.utc)

    fs_updates = _to_firestore_fields(updates)
    # Renames for fields that don't flow through _MAP_FIELD_MAP.
    if "published_at" in fs_updates:
        fs_updates["publishedAt"] = fs_updates.pop("published_at")
    fs_updates["lastModified"] = datetime.now(timezone.utc)
    doc_ref.update(fs_updates)

    # Build a human-readable summary of what changed
    changed_parts = []
    if "title" in updates:
        changed_parts.append(f"title to \"{updates['title']}\"")
    if "graph_data" in updates:
        changed_parts.append("map content")
    if "nodes_text" in updates:
        changed_parts.append("node text")
    if "visibility" in updates:
        changed_parts.append(f"visibility to {updates['visibility']}")
    summary = "Updated " + ", ".join(changed_parts) if changed_parts else "Updated map"
    _log_map_history(db, map_id, user, "edited", summary)

    m.update(fs_updates)
    return _map_out(m)


@router.delete("/{map_id}")
def delete_map(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.MAPS).document(map_id).get()
    m = models.doc_to_dict(doc)
    if not m or m.get("ownerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Map not found")
    title = m.get("title", "Untitled")
    db.collection(models.MAPS).document(map_id).delete()
    audit_log(db, user["id"], "delete", "map", map_id)
    _log_map_history(db, map_id, user, "deleted", f"Deleted map \"{title}\"")
    return {"ok": True}


@router.post("/{map_id}/collaborators")
def add_collaborator(map_id: str, email: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.MAPS).document(map_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Map not found")
    db.collection(models.MAPS).document(map_id).update({"collaborators": ArrayUnion([email])})
    _log_map_history(db, map_id, user, "collaborator_added", f"Added collaborator {email}")

    # Notify the invited user if they have an account
    try:
        m = models.doc_to_dict(doc) or {}
        map_title = m.get("title", "a mind map")
        inviter = user.get("displayName", "A collaborator")
        target = (
            db.collection(models.USERS)
            .where(filter=FieldFilter("email", "==", email.lower()))
            .limit(1)
            .get()
        )
        for t in target:
            tdata = models.doc_to_dict(t) or {}
            create_notification(
                db,
                user_id=tdata["id"],
                title="You've been invited to collaborate",
                message=f"{inviter} added you to \"{map_title}\".",
                notification_type="collaboration",
                link=f"/view-map/{map_id}",
            )
            break
    except Exception:
        pass

    return {"ok": True}


@router.delete("/{map_id}/collaborators")
def remove_collaborator(map_id: str, email: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    db.collection(models.MAPS).document(map_id).update({"collaborators": ArrayRemove([email])})
    _log_map_history(db, map_id, user, "collaborator_removed", f"Removed collaborator {email}")
    return {"ok": True}


# ── History ──
@router.get("/{map_id}/history", response_model=list[schemas.MapHistoryOut])
def get_map_history(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db), limit: int = Query(50)):
    docs = (
        db.collection(models.MAP_HISTORY)
        .where(filter=FieldFilter("mapId", "==", map_id))
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
        .get()
    )
    results = []
    for d in docs:
        h = models.doc_to_dict(d)
        results.append(schemas.MapHistoryOut(
            id=h["id"],
            map_id=h.get("mapId", ""),
            user_id=h.get("userId", ""),
            user_email=h.get("userEmail", ""),
            user_name=h.get("userName", "Unknown"),
            action=h.get("action", ""),
            summary=h.get("summary", ""),
            created_at=h.get("createdAt", datetime.now(timezone.utc)),
        ))
    return results


# ── Presence ──
@router.post("/{map_id}/presence")
def update_presence(
    map_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update user presence on a map (heartbeat)."""
    presence_ref = db.collection(models.MAPS).document(map_id).collection("presence").document(user["id"])
    presence_ref.set({
        "userId": user["id"],
        "displayName": user.get("displayName", ""),
        "photoURL": user.get("photoURL", ""),
        "lockedNodeId": body.get("locked_node_id"),
        "cursorPosition": body.get("cursor_position"),
        "lastSeen": datetime.now(timezone.utc),
    })
    return {"ok": True}


@router.get("/{map_id}/presence")
def get_presence(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get active collaborators on a map (seen within last 30s)."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=30)
    docs = (
        db.collection(models.MAPS).document(map_id)
        .collection("presence")
        .where(filter=FieldFilter("lastSeen", ">=", cutoff))
        .get()
    )
    return [models.doc_to_dict(d) for d in docs if d.id != user["id"]]


# ── Annotations ──
@router.get("/{map_id}/annotations")
def get_annotations(map_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = db.collection(models.MAPS).document(map_id).collection("annotations").get()
    return [models.doc_to_dict(d) for d in docs]


@router.post("/{map_id}/annotations")
def create_annotation(
    map_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    ann_id = models.gen_id()
    data = {
        "authorId": user["id"],
        "authorName": user.get("displayName", ""),
        "type": body.get("type", "note"),  # "note" or "drawing"
        "content": body.get("content", ""),
        "position": body.get("position", {"x": 0, "y": 0}),
        "color": body.get("color", "#ef4444"),
        "createdAt": datetime.now(timezone.utc),
    }
    if body.get("path"):
        data["path"] = body["path"]
    db.collection(models.MAPS).document(map_id).collection("annotations").document(ann_id).set(data)
    data["id"] = ann_id
    return data


@router.patch("/{map_id}/annotations/{ann_id}")
def update_annotation(
    map_id: str,
    ann_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update annotation position or content (for dragging sticky notes)."""
    ref = db.collection(models.MAPS).document(map_id).collection("annotations").document(ann_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Annotation not found")
    updates = {}
    if "position" in body:
        updates["position"] = body["position"]
    if "content" in body:
        updates["content"] = body["content"]
    if "size" in body:
        updates["size"] = body["size"]
    if updates:
        ref.update(updates)
    return {"ok": True}


@router.delete("/{map_id}/annotations/{ann_id}")
def delete_annotation(map_id: str, ann_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    db.collection(models.MAPS).document(map_id).collection("annotations").document(ann_id).delete()
    return {"ok": True}


# ── Map Node Image Upload ──
MAP_IMAGE_DIR = os.path.join("uploads", "map-images")


@router.post("/{map_id}/upload-image")
async def upload_map_image(
    map_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Upload an image for use inside a mind map node."""
    doc = db.collection(models.MAPS).document(map_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Map not found")
    os.makedirs(MAP_IMAGE_DIR, exist_ok=True)
    ext = file.filename.split(".")[-1] if file.filename else "png"
    allowed = {"png", "jpg", "jpeg", "gif", "webp", "svg"}
    if ext.lower() not in allowed:
        raise HTTPException(status_code=400, detail=f"File type .{ext} not allowed")
    filename = f"{map_id}_{uuid.uuid4().hex[:8]}.{ext}"
    path = os.path.join(MAP_IMAGE_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        content = await file.read()
        await f.write(content)
    image_url = f"/uploads/map-images/{filename}"
    return {"ok": True, "image_url": image_url}
