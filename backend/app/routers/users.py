from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from ..storage import save_upload
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/users", tags=["Users"])

# snake_case API field → camelCase Firestore field
_USER_FIELD_MAP = {
    "display_name": "displayName",
    "class_name": "className",
    "photo_url": "photoURL",
}


def _user_to_out(user: dict) -> schemas.UserOut:
    return schemas.UserOut(
        id=user["id"],
        email=user.get("email", ""),
        display_name=user.get("displayName", ""),
        role=user.get("role", "student"),
        class_name=user.get("className", ""),
        photo_url=user.get("photoURL", ""),
        year=user.get("year"),
        semester=user.get("semester"),
        department=user.get("department"),
        points=user.get("points", 0),
        streak=user.get("streak", 0),
        badges=user.get("badges", []),
        created_at=user.get("createdAt", datetime.now(timezone.utc)),
    )


def _to_firestore_fields(updates: dict) -> dict:
    """Convert snake_case update keys to camelCase Firestore keys."""
    return {_USER_FIELD_MAP.get(k, k): v for k, v in updates.items()}


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(req: schemas.UserUpdate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    updates = req.model_dump(exclude_unset=True)
    if updates:
        fs_updates = _to_firestore_fields(updates)
        db.collection(models.USERS).document(user["id"]).update(fs_updates)
        user.update(fs_updates)
    return _user_to_out(user)


@router.post("/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user), db=Depends(get_db)):
    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"{user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    content = await file.read()
    photo_url = save_upload(
        content,
        subdir="avatars",
        filename=filename,
        content_type=file.content_type or "image/png",
    )
    db.collection(models.USERS).document(user["id"]).update({"photoURL": photo_url})
    return {"photo_url": photo_url}


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db=Depends(get_db)):
    doc = db.collection(models.USERS).document(user_id).get()
    u = models.doc_to_dict(doc)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_out(u)
