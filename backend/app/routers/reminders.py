from fastapi import APIRouter, Depends, HTTPException, Query
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])

# snake_case API field → camelCase Firestore field
_REM_FIELD_MAP = {
    "is_completed": "isCompleted",
}


def _reminder_out(r: dict) -> schemas.ReminderOut:
    return schemas.ReminderOut(
        id=r["id"],
        owner_id=r.get("ownerId", ""),
        date=r.get("date", ""),
        title=r.get("title", ""),
        type=r.get("type", "Assignment"),
        priority=r.get("priority", "normal"),
        is_completed=r.get("isCompleted", False),
    )


def _to_firestore_fields(updates: dict) -> dict:
    return {_REM_FIELD_MAP.get(k, k): v for k, v in updates.items()}


@router.get("/", response_model=list[schemas.ReminderOut])
def get_reminders(date: str = Query(...), user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.REMINDERS)
        .where(filter=FieldFilter("ownerId", "==", user["id"]))
        .where(filter=FieldFilter("date", "==", date))
        .get()
    )
    return [_reminder_out(models.doc_to_dict(d)) for d in docs]


@router.post("/", response_model=schemas.ReminderOut, status_code=201)
def create_reminder(req: schemas.ReminderCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    rid = models.gen_id()
    data = {
        "ownerId": user["id"],
        "date": req.date,
        "title": req.title,
        "type": req.type,
        "priority": req.priority,
        "isCompleted": False,
    }
    db.collection(models.REMINDERS).document(rid).set(data)
    data["id"] = rid
    return _reminder_out(data)


@router.patch("/{rid}", response_model=schemas.ReminderOut)
def update_reminder(rid: str, req: schemas.ReminderUpdate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc_ref = db.collection(models.REMINDERS).document(rid)
    doc = doc_ref.get()
    r = models.doc_to_dict(doc)
    if not r or r.get("ownerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Reminder not found")
    updates = req.model_dump(exclude_unset=True)
    if updates:
        fs_updates = _to_firestore_fields(updates)
        doc_ref.update(fs_updates)
        r.update(fs_updates)
    return _reminder_out(r)


@router.delete("/{rid}")
def delete_reminder(rid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.REMINDERS).document(rid).get()
    r = models.doc_to_dict(doc)
    if not r or r.get("ownerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.collection(models.REMINDERS).document(rid).delete()
    return {"ok": True}
