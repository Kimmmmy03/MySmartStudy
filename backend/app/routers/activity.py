from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1 import Increment

router = APIRouter(prefix="/api/activity", tags=["Activity"])

# Heartbeat cadence expected from clients (seconds). If the gap between pings
# exceeds IDLE_GAP_SECONDS we assume the user was idle/backgrounded and only
# credit 1 minute for this ping (not the full gap).
HEARTBEAT_INTERVAL_SECONDS = 60
IDLE_GAP_SECONDS = 5 * 60  # 5 min tolerance

# Known feature keys (for normalisation; unknown keys are still accepted).
KNOWN_FEATURES = {
    "dashboard", "courses", "course_detail", "assignments", "quizzes",
    "maps", "mindmap_editor", "gradebook", "messages", "planner",
    "calendar", "achievements", "profile", "attendance", "peer_review",
    "groups", "companion", "study_materials", "study_plan", "plagiarism",
    "mindmap_buddy", "images", "admin", "other",
}


class HeartbeatRequest(BaseModel):
    feature: str = "other"
    platform: str = "web"  # "web" or "mobile"


@router.post("/heartbeat")
def heartbeat(
    req: HeartbeatRequest,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Record one minute of user activity on a given feature.

    Clients should ping this endpoint every ~60 seconds while the app is
    foregrounded. Backend accumulates per-user-per-day minutes and a rolling
    lifetime aggregate used by the admin analytics pages.
    """
    feature = (req.feature or "other").strip().lower()[:40] or "other"
    platform = (req.platform or "web").strip().lower()
    if platform not in ("web", "mobile"):
        platform = "web"

    now = datetime.now(timezone.utc)
    date_key = now.strftime("%Y-%m-%d")
    uid = user["id"]

    # ── Daily session doc: userSessions/{uid}_{date} ───────────────────────
    daily_ref = db.collection(models.USER_SESSIONS).document(f"{uid}_{date_key}")
    prev = daily_ref.get()
    minutes_to_add = 1
    if prev.exists:
        prev_data = prev.to_dict() or {}
        last_ping_raw = prev_data.get("lastPingAt")
        if last_ping_raw:
            try:
                last_ping = datetime.fromisoformat(last_ping_raw)
                gap = (now - last_ping).total_seconds()
                if gap > IDLE_GAP_SECONDS:
                    minutes_to_add = 1  # idle → credit only this ping
                else:
                    minutes_to_add = max(1, round(gap / 60))
            except Exception:
                minutes_to_add = 1

    # Firestore set(merge=True) treats dotted keys as LITERAL field names (not
    # nested paths — that's update() semantics). Use a nested dict so the
    # features / platforms maps actually accumulate.
    daily_ref.set({
        "userId": uid,
        "date": date_key,
        "minutesActive": Increment(minutes_to_add),
        "lastPingAt": now.isoformat(),
        "firstPingAt": prev.to_dict().get("firstPingAt", now.isoformat()) if prev.exists else now.isoformat(),
        "features": {feature: Increment(minutes_to_add)},
        "platforms": {platform: Increment(minutes_to_add)},
    }, merge=True)

    # ── Lifetime aggregate: userActivityAggregate/{uid} ────────────────────
    agg_ref = db.collection(models.USER_ACTIVITY_AGGREGATE).document(uid)
    agg_snap = agg_ref.get()
    agg_ref.set({
        "userId": uid,
        "totalMinutes": Increment(minutes_to_add),
        "features": {feature: Increment(minutes_to_add)},
        "platforms": {platform: Increment(minutes_to_add)},
        "lastSeenAt": now.isoformat(),
        "firstSeenAt": agg_snap.to_dict().get("firstSeenAt", now.isoformat()) if agg_snap.exists else now.isoformat(),
    }, merge=True)

    return {"ok": True, "minutes_added": minutes_to_add}


def log_activity(
    db,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str = "",
    title: str = "",
) -> None:
    """Write an activity feed entry to Firestore."""
    aid = models.gen_id()
    db.collection(models.ACTIVITY_FEED).document(aid).set({
        "userId": user_id,
        "action": action,
        "resourceType": resource_type,
        "resourceId": resource_id,
        "title": title,
        "createdAt": datetime.now(timezone.utc),
    })


@router.get("/")
def get_activity(
    limit: int = Query(20, le=50),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    docs = (
        db.collection(models.ACTIVITY_FEED)
        .where(filter=FieldFilter("userId", "==", user["id"]))
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
        .get()
    )
    return [models.doc_to_dict(d) for d in docs]


# ── Reflections ──
@router.post("/reflections", response_model=schemas.ReflectionOut, status_code=201)
def create_reflection(
    req: schemas.ReflectionCreate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    rid = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "ownerId": user["id"],
        "confidence": req.confidence,
        "notes": req.notes,
        "weekLabel": req.week_label or now.strftime("Week %U, %Y"),
        "createdAt": now,
    }
    db.collection(models.REFLECTIONS).document(rid).set(data)
    return schemas.ReflectionOut(
        id=rid, owner_id=user["id"], confidence=req.confidence,
        notes=req.notes, week_label=data["weekLabel"], created_at=now,
    )


@router.get("/reflections", response_model=list[schemas.ReflectionOut])
def get_reflections(
    limit: int = Query(10, le=50),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    docs = (
        db.collection(models.REFLECTIONS)
        .where(filter=FieldFilter("ownerId", "==", user["id"]))
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
        .get()
    )
    result = []
    for d in docs:
        r = models.doc_to_dict(d)
        result.append(schemas.ReflectionOut(
            id=r["id"], owner_id=r.get("ownerId", ""),
            confidence=r.get("confidence", 3), notes=r.get("notes", ""),
            week_label=r.get("weekLabel", ""), created_at=r.get("createdAt", datetime.now(timezone.utc)),
        ))
    return result
