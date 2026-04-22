from fastapi import APIRouter, Depends
from .. import models
from ..firestore import get_db
from ..auth import get_current_user
from datetime import datetime, timedelta, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/stats", tags=["Stats"])


@router.get("/study-activity")
def get_study_activity(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Return 30-day daily map edit counts."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Get all maps for this user
    map_docs = (
        db.collection(models.MAPS)
        .where(filter=FieldFilter("ownerId", "==", user["id"]))
        .get()
    )

    # Get activity feed for map edits
    activity_docs = (
        db.collection(models.ACTIVITY_FEED)
        .where(filter=FieldFilter("userId", "==", user["id"]))
        .where(filter=FieldFilter("createdAt", ">=", thirty_days_ago))
        .order_by("createdAt")
        .get()
    )

    # Count per day
    day_counts: dict[str, int] = {}
    for i in range(30):
        d = (now - timedelta(days=29 - i)).strftime("%Y-%m-%d")
        day_counts[d] = 0

    for doc in activity_docs:
        a = doc.to_dict()
        dt = a.get("createdAt")
        if dt:
            if hasattr(dt, "strftime"):
                key = dt.strftime("%Y-%m-%d")
            else:
                key = str(dt)[:10]
            if key in day_counts:
                day_counts[key] += 1

    return [{"date": k, "count": v} for k, v in day_counts.items()]


@router.get("/monthly-comparison")
def get_monthly_comparison(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Compare map creation counts between current and previous month."""
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    first_of_prev = (first_of_month - timedelta(days=1)).replace(day=1)

    maps = db.collection(models.MAPS).where(filter=FieldFilter("ownerId", "==", user["id"])).get()

    current = 0
    previous = 0
    for d in maps:
        m = d.to_dict()
        lm = m.get("lastModified")
        if lm and hasattr(lm, "month"):
            if lm >= first_of_month:
                current += 1
            elif lm >= first_of_prev:
                previous += 1

    return {
        "current_month": {"label": now.strftime("%b %Y"), "count": current},
        "previous_month": {"label": first_of_prev.strftime("%b %Y"), "count": previous},
    }


@router.get("/map-type-distribution")
def get_map_type_distribution(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Count maps by graph_format."""
    maps = db.collection(models.MAPS).where(filter=FieldFilter("ownerId", "==", user["id"])).get()

    dist: dict[str, int] = {}
    for d in maps:
        m = d.to_dict()
        fmt = m.get("graphFormat", "reactflow")
        dist[fmt] = dist.get(fmt, 0) + 1

    return [{"type": k, "count": v} for k, v in dist.items()]
