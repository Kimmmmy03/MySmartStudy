from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from ..sanitize import clean_text
from ..storage import save_upload
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/users", tags=["Users"])

# snake_case API field → camelCase Firestore field
_USER_FIELD_MAP = {
    "display_name": "displayName",
    "class_name": "className",
    "photo_url": "photoURL",
    "cover_photo_url": "coverPhotoURL",
    "notification_prefs": "notificationPrefs",
    # bio keeps snake_case since Firestore doesn't care, but the field name is
    # the same in both casings.
}

_PREFS_FIELD_MAP = {
    "new_follower": "newFollower",
    "map_like": "mapLike",
    "map_comment": "mapComment",
    "followed_user_posts": "followedUserPosts",
}


def _prefs_out(raw: dict | None) -> schemas.NotificationPrefs:
    raw = raw or {}
    return schemas.NotificationPrefs(
        new_follower=raw.get("newFollower", True),
        map_like=raw.get("mapLike", True),
        map_comment=raw.get("mapComment", True),
        followed_user_posts=raw.get("followedUserPosts", False),
    )


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
        bio=user.get("bio", "") or "",
        cover_photo_url=user.get("coverPhotoURL", "") or "",
        follower_count=int(user.get("followerCount", 0) or 0),
        following_count=int(user.get("followingCount", 0) or 0),
        notification_prefs=_prefs_out(user.get("notificationPrefs")),
        created_at=user.get("createdAt", datetime.now(timezone.utc)),
    )


def _to_firestore_fields(updates: dict) -> dict:
    """Convert snake_case update keys to camelCase Firestore keys.

    Also maps nested notification_prefs (snake) → notificationPrefs (camel).
    """
    out: dict = {}
    for k, v in updates.items():
        if k == "notification_prefs" and isinstance(v, dict):
            out["notificationPrefs"] = {_PREFS_FIELD_MAP.get(pk, pk): pv for pk, pv in v.items()}
        else:
            out[_USER_FIELD_MAP.get(k, k)] = v
    return out


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(req: schemas.UserUpdate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    updates = req.model_dump(exclude_unset=True)
    # Sanitize free-text profile fields (stored-XSS defence) + cap bio length.
    for _f in ("display_name", "bio", "department", "className"):
        if _f in updates and updates[_f] is not None:
            updates[_f] = clean_text(str(updates[_f]))
    if "bio" in updates and updates["bio"] is not None:
        updates["bio"] = str(updates["bio"])[:280]
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


@router.post("/me/cover-photo")
async def upload_cover_photo(file: UploadFile = File(...), user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Upload the banner image shown behind the avatar on the public profile."""
    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"{user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    content = await file.read()
    # 5MB soft cap — cover photos are banner-scale, no point allowing huge files.
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Cover photo must be under 5MB")
    cover_url = save_upload(
        content,
        subdir="covers",
        filename=filename,
        content_type=file.content_type or "image/png",
    )
    db.collection(models.USERS).document(user["id"]).update({"coverPhotoURL": cover_url})
    return {"cover_photo_url": cover_url}


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db=Depends(get_db)):
    doc = db.collection(models.USERS).document(user_id).get()
    u = models.doc_to_dict(doc)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_out(u)
