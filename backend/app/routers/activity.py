from fastapi import APIRouter, Depends, Query
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/activity", tags=["Activity"])


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
