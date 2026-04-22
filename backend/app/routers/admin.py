from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from firebase_admin import auth as firebase_auth
from .. import models, schemas
from ..firestore import get_db
from ..auth import require_admin, get_current_user
from ..storage import save_upload
from datetime import datetime, timezone
import os, uuid, logging
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── Audit Logs ──
@router.get("/audit-logs")
def get_audit_logs(
    limit: int = Query(50, le=200),
    resource_type: str | None = Query(None),
    user_id: str | None = Query(None),
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    query = db.collection(models.AUDIT_LOGS)
    if resource_type:
        query = query.where(filter=FieldFilter("resourceType", "==", resource_type))
    if user_id:
        query = query.where(filter=FieldFilter("userId", "==", user_id))
    query = query.order_by("createdAt", direction="DESCENDING").limit(limit)
    docs = query.get()
    logs = [models.doc_to_dict(d) for d in docs]

    # Enrich logs with user name/email
    user_ids = list({log["userId"] for log in logs if log and log.get("userId")})
    user_map: dict[str, dict] = {}
    for uid in user_ids:
        try:
            udoc = db.collection(models.USERS).document(uid).get()
            if udoc.exists:
                ud = udoc.to_dict() or {}
                user_map[uid] = {
                    "userName": ud.get("displayName", ""),
                    "userEmail": ud.get("email", ""),
                    "userPhoto": ud.get("photoURL", ""),
                    "userRole": ud.get("role", ""),
                }
        except Exception:
            pass

    for log in logs:
        if log:
            uid = log.get("userId", "")
            info = user_map.get(uid, {})
            log["userName"] = info.get("userName", "")
            log["userEmail"] = info.get("userEmail", "")
            log["userPhoto"] = info.get("userPhoto", "")
            log["userRole"] = info.get("userRole", "")

    return logs


# ── User Management ──
@router.get("/users")
def list_users(
    role: str | None = Query(None),
    limit: int = Query(50, le=200),
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    query = db.collection(models.USERS)
    if role:
        query = query.where(filter=FieldFilter("role", "==", role))
    query = query.limit(limit)
    docs = query.get()
    results = []
    for d in docs:
        u = models.doc_to_dict(d)
        if u:
            results.append(schemas.UserOut(
                id=u["id"], email=u.get("email", ""),
                display_name=u.get("displayName", ""), role=u.get("role", "student"),
                class_name=u.get("className", ""), photo_url=u.get("photoURL", ""),
                year=u.get("year"), semester=u.get("semester"),
                department=u.get("department"),
                points=u.get("points", 0), streak=u.get("streak", 0),
                badges=u.get("badges", []),
                created_at=u.get("createdAt", datetime.now(timezone.utc)),
            ))
    return results


@router.patch("/users/{uid}/role")
def update_user_role(
    uid: str,
    role: str = Query(...),
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    doc = db.collection(models.USERS).document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    if role not in ("student", "lecturer", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    db.collection(models.USERS).document(uid).update({"role": role})
    return {"ok": True, "new_role": role}


@router.delete("/users/{uid}")
def delete_user(
    uid: str,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Permanently delete a user from Firestore and Firebase Auth.
    Admins cannot delete themselves."""
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    doc = db.collection(models.USERS).document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete Firestore user doc first (the source of truth the app reads from)
    db.collection(models.USERS).document(uid).delete()

    # Best-effort: delete Firebase Auth user so the email can be reused
    try:
        firebase_auth.delete_user(uid)
    except firebase_auth.UserNotFoundError:
        pass
    except Exception as e:
        logger.warning("Failed to delete Firebase Auth user %s: %s", uid, e)

    return {"ok": True, "uid": uid}


# ── Homepage Content Management ──

UPLOAD_DIR = os.path.join("uploads", "homepage")


@router.get("/homepage/content")
def get_homepage_content(user: dict = Depends(require_admin), db=Depends(get_db)):
    """Get all homepage content items (admin only for management)."""
    try:
        docs = db.collection(models.HOMEPAGE_CONTENT).order_by("order").get()
    except Exception:
        # If order_by fails (e.g. no index), fallback to unordered
        docs = db.collection(models.HOMEPAGE_CONTENT).get()
    result = []
    for d in docs:
        item = models.doc_to_dict(d)
        if item:
            result.append(item)
    return result


@router.post("/homepage/content")
def create_homepage_content(
    body: schemas.HomepageContentCreate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Create a new homepage content item (news/poster)."""
    doc_id = models.gen_id()
    now = datetime.now(timezone.utc).isoformat()
    # Get current max order
    existing = db.collection(models.HOMEPAGE_CONTENT).order_by("order", direction="DESCENDING").limit(1).get()
    max_order = 0
    for d in existing:
        max_order = d.to_dict().get("order", 0)
    data = {
        "type": body.type,
        "title": body.title,
        "content": body.content or "",
        "imageUrl": body.image_url or "",
        "order": body.order if body.order is not None else max_order + 1,
        "visible": True,
        "createdAt": now,
        "updatedAt": now,
    }
    db.collection(models.HOMEPAGE_CONTENT).document(doc_id).set(data)
    data["id"] = doc_id
    return data


@router.patch("/homepage/content/{item_id}")
def update_homepage_content(
    item_id: str,
    body: schemas.HomepageContentUpdate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Update a homepage content item."""
    doc = db.collection(models.HOMEPAGE_CONTENT).document(item_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Content not found")
    updates = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.content is not None:
        updates["content"] = body.content
    if body.image_url is not None:
        updates["imageUrl"] = body.image_url
    if body.order is not None:
        updates["order"] = body.order
    if body.visible is not None:
        updates["visible"] = body.visible
    if body.type is not None:
        updates["type"] = body.type
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    db.collection(models.HOMEPAGE_CONTENT).document(item_id).update(updates)
    return {"ok": True}


@router.delete("/homepage/content/{item_id}")
def delete_homepage_content(
    item_id: str,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Delete a homepage content item."""
    doc = db.collection(models.HOMEPAGE_CONTENT).document(item_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Content not found")
    db.collection(models.HOMEPAGE_CONTENT).document(item_id).delete()
    return {"ok": True}


@router.post("/homepage/upload")
def upload_homepage_image(
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
):
    """Upload a poster/news image for the homepage."""
    ext = os.path.splitext(file.filename or "img.png")[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    image_url = save_upload(
        file.file.read(),
        subdir="homepage",
        filename=filename,
        content_type=file.content_type or "image/png",
    )
    return {"ok": True, "image_url": image_url}


# ── AI Token Usage ──────────────────────────────────────────────────────────

AI_FEATURES = ["companion", "study_materials", "study_plan", "grading",
               "plagiarism", "mindmap_buddy", "import", "images"]


@router.get("/ai-usage")
def get_ai_usage(
    limit: int = Query(100, le=200),
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Return per-user AI token usage aggregates plus a cross-user feature summary."""
    usage_docs = (
        db.collection(models.AI_USAGE_SUMMARY)
        .order_by("total_tokens", direction="DESCENDING")
        .limit(limit)
        .get()
    )

    # Pre-fetch all user settings in one pass for quota overrides
    settings_map: dict = {}
    try:
        for sdoc in db.collection(models.AI_USER_SETTINGS).get():
            settings_map[sdoc.id] = sdoc.to_dict()
    except Exception:
        pass

    # Global default token limit
    global_token_limit = _DEFAULT_DAILY_TOKEN_LIMIT
    try:
        g = db.collection(models.AI_CONFIG).document("global").get()
        if g.exists:
            v = g.to_dict().get("dailyTokenLimit")
            if isinstance(v, int) and v >= 0:
                global_token_limit = v
    except Exception:
        pass

    # Pre-fetch today's daily usage for these users
    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily_map: dict = {}
    try:
        for ddoc in db.collection(models.AI_DAILY_USAGE).where(
            filter=FieldFilter("date", "==", today_key)
        ).get():
            daily_map[ddoc.to_dict().get("userId", "")] = ddoc.to_dict().get("total_tokens", 0) or 0
    except Exception:
        pass

    records = []
    summary_tokens: dict[str, int] = {f: 0 for f in AI_FEATURES}
    summary_calls: dict[str, int] = {f: 0 for f in AI_FEATURES}
    total_tokens = 0
    total_calls = 0

    for doc in usage_docs:
        d = doc.to_dict()
        uid = d.get("userId", doc.id)

        # Fetch basic user info
        user_info: dict = {}
        try:
            u_doc = db.collection(models.USERS).document(uid).get()
            if u_doc.exists:
                u = u_doc.to_dict()
                user_info = {
                    "displayName": u.get("displayName", ""),
                    "email": u.get("email", ""),
                    "photoURL": u.get("photoURL", ""),
                    "role": u.get("role", ""),
                }
        except Exception:
            pass

        # Per-feature breakdown
        features: dict = {}
        for feat in AI_FEATURES:
            ft = d.get(f"{feat}_tokens", 0) or 0
            fc = d.get(f"{feat}_calls", 0) or 0
            features[feat] = {"tokens": ft, "calls": fc}
            summary_tokens[feat] = summary_tokens.get(feat, 0) + ft
            summary_calls[feat] = summary_calls.get(feat, 0) + fc

        ut = d.get("total_tokens", 0) or 0
        uc = d.get("total_calls", 0) or 0
        total_tokens += ut
        total_calls += uc

        # Image quota + daily token limit overrides
        settings = settings_map.get(uid, {})
        image_quota = settings.get("imageQuotaLimit")
        token_limit_override = settings.get("dailyTokenLimit")

        records.append({
            "userId": uid,
            "user": user_info,
            "total_tokens": ut,
            "total_calls": uc,
            "features": features,
            "image_quota_limit": image_quota,
            "token_limit_override": token_limit_override,
            "tokens_today": daily_map.get(uid, 0),
            "updated_at": d.get("updatedAt"),
        })

    # Compute feature percentages relative to grand total
    feature_summary = {}
    for feat in AI_FEATURES:
        ft = summary_tokens[feat]
        feature_summary[feat] = {
            "tokens": ft,
            "calls": summary_calls[feat],
            "percentage": round((ft / total_tokens * 100) if total_tokens > 0 else 0, 1),
        }

    return {
        "usage": records,
        "summary": {
            "total_tokens": total_tokens,
            "total_calls": total_calls,
            "by_feature": feature_summary,
        },
        "global_token_limit": global_token_limit,
        "default_token_limit": _DEFAULT_DAILY_TOKEN_LIMIT,
    }


# ── Per-User Image Quota ────────────────────────────────────────────────────

class ImageQuotaRequest(BaseModel):
    limit: int | None  # None = reset to global default


@router.patch("/users/{uid}/image-quota")
def set_user_image_quota(
    uid: str,
    req: ImageQuotaRequest,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Override (or reset) the daily image generation limit for a specific user."""
    # Verify user exists
    user_doc = db.collection(models.USERS).document(uid).get()
    if not user_doc.exists:
        raise HTTPException(404, "User not found")

    if req.limit is not None and req.limit < 0:
        raise HTTPException(400, "limit must be 0 or greater")

    db.collection(models.AI_USER_SETTINGS).document(uid).set({
        "userId": uid,
        "imageQuotaLimit": req.limit,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "updatedBy": user["id"],
    }, merge=True)

    return {"ok": True, "uid": uid, "imageQuotaLimit": req.limit}


# ── AI Token Limit (global + per-user) ──────────────────────────────────────

# Default daily per-user token limit if aiConfig/global is not set.
# Keep in sync with ai_service.DEFAULT_DAILY_TOKEN_LIMIT.
_DEFAULT_DAILY_TOKEN_LIMIT = 50_000


class TokenLimitRequest(BaseModel):
    limit: int  # 0 = unlimited, >0 = daily cap; values <0 rejected


@router.get("/ai-token-limit")
def get_ai_token_limit(user: dict = Depends(require_admin), db=Depends(get_db)):
    """Return the current global daily token limit (or the default if unset)."""
    current = _DEFAULT_DAILY_TOKEN_LIMIT
    updated_at = None
    updated_by = None
    try:
        doc = db.collection(models.AI_CONFIG).document("global").get()
        if doc.exists:
            d = doc.to_dict()
            v = d.get("dailyTokenLimit")
            if isinstance(v, int) and v >= 0:
                current = v
            updated_at = d.get("updatedAt")
            updated_by = d.get("updatedBy")
    except Exception:
        pass
    return {
        "limit": current,
        "default": _DEFAULT_DAILY_TOKEN_LIMIT,
        "updated_at": updated_at,
        "updated_by": updated_by,
    }


@router.patch("/ai-token-limit")
def set_ai_token_limit(
    req: TokenLimitRequest,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Set the global daily token limit applied to all users without an override."""
    if req.limit < 0:
        raise HTTPException(400, "limit must be 0 or greater (0 = unlimited)")
    db.collection(models.AI_CONFIG).document("global").set({
        "dailyTokenLimit": req.limit,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "updatedBy": user["id"],
    }, merge=True)
    return {"ok": True, "limit": req.limit}


@router.patch("/users/{uid}/token-limit")
def set_user_token_limit(
    uid: str,
    req: ImageQuotaRequest,  # same shape: limit: int | None
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Override (or reset to global) the daily token limit for a specific user."""
    user_doc = db.collection(models.USERS).document(uid).get()
    if not user_doc.exists:
        raise HTTPException(404, "User not found")

    if req.limit is not None and req.limit < 0:
        raise HTTPException(400, "limit must be 0 or greater")

    db.collection(models.AI_USER_SETTINGS).document(uid).set({
        "userId": uid,
        "dailyTokenLimit": req.limit,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "updatedBy": user["id"],
    }, merge=True)

    return {"ok": True, "uid": uid, "dailyTokenLimit": req.limit}
