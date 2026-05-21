from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel, Field
from firebase_admin import auth as firebase_auth
from .. import models, schemas
from ..firestore import get_db
from ..auth import require_admin, get_current_user
from ..storage import save_upload
from ..audit import audit_log
from ..services.email_service import send_notification_email
from datetime import datetime, timezone
import os, uuid, logging
from typing import Literal
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


# ── AI Master Switch (global on/off + per-feature kill list) ───────────────

class AISettingsUpdate(BaseModel):
    ai_enabled: bool | None = None
    disabled_features: list[str] | None = None


def _read_ai_settings(db) -> dict:
    """Read aiConfig/global and return the gate-relevant fields."""
    from ..ai_service import AI_FEATURES

    snap = db.collection(models.AI_CONFIG).document("global").get()
    if snap.exists:
        cfg = snap.to_dict() or {}
        ai_enabled = bool(cfg.get("aiEnabled", True))
        raw = cfg.get("disabledFeatures")
        disabled = [f for f in raw if isinstance(f, str)] if isinstance(raw, list) else []
        updated_at = cfg.get("aiSettingsUpdatedAt") or cfg.get("updatedAt")
        updated_by = cfg.get("aiSettingsUpdatedBy") or cfg.get("updatedBy", "")
    else:
        ai_enabled = True
        disabled = []
        updated_at = None
        updated_by = ""
    return {
        "ai_enabled": ai_enabled,
        "disabled_features": disabled,
        "all_features": list(AI_FEATURES),
        "updated_at": updated_at,
        "updated_by": updated_by,
    }


@router.get("/ai-settings")
def get_ai_settings(user: dict = Depends(require_admin), db=Depends(get_db)):
    """Return the global AI master switch + per-feature kill list."""
    return _read_ai_settings(db)


@router.patch("/ai-settings")
def update_ai_settings(
    req: AISettingsUpdate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Patch the global AI gate. Pass either field — both are optional."""
    from ..ai_service import AI_FEATURES, invalidate_ai_gate_cache

    if req.ai_enabled is None and req.disabled_features is None:
        raise HTTPException(400, "Provide ai_enabled and/or disabled_features")

    valid = set(AI_FEATURES)
    updates: dict = {
        "aiSettingsUpdatedAt": datetime.now(timezone.utc).isoformat(),
        "aiSettingsUpdatedBy": user["id"],
    }
    if req.ai_enabled is not None:
        updates["aiEnabled"] = bool(req.ai_enabled)
    if req.disabled_features is not None:
        # Defensive: drop unknown feature keys so a stale client can't poison the doc.
        clean = [f for f in req.disabled_features if f in valid]
        updates["disabledFeatures"] = clean

    db.collection(models.AI_CONFIG).document("global").set(updates, merge=True)
    invalidate_ai_gate_cache()

    audit_log(
        db,
        user_id=user["id"],
        action="update",
        resource_type="ai_settings",
        resource_id="global",
        details=(
            f"ai_enabled={updates.get('aiEnabled', '<unchanged>')}, "
            f"disabled_features={updates.get('disabledFeatures', '<unchanged>')}"
        ),
    )
    return _read_ai_settings(db)


# ── Usage Analytics (time spent + feature usage) ───────────────────────────

def _minutes_to_label(m: int) -> str:
    if m < 60:
        return f"{m}m"
    h = m // 60
    r = m % 60
    return f"{h}h {r}m" if r else f"{h}h"


@router.get("/top-users")
def get_top_users(
    limit: int = Query(500, le=5000),
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Return the top N users ranked by total time spent on the system.

    Each record includes user info, lifetime minutes, per-feature breakdown,
    and most/least used features. Consumed by the admin usage-analytics page
    and the PDF export.
    """
    try:
        agg_docs = (
            db.collection(models.USER_ACTIVITY_AGGREGATE)
            .order_by("totalMinutes", direction="DESCENDING")
            .limit(limit)
            .get()
        )
    except Exception:
        # Missing index / empty collection → return empty result gracefully
        agg_docs = []

    results = []
    grand_total_minutes = 0
    global_features: dict[str, int] = {}

    for d in agg_docs:
        data = d.to_dict() or {}
        uid = data.get("userId", d.id)
        total = int(data.get("totalMinutes", 0) or 0)
        features = {k: int(v or 0) for k, v in (data.get("features") or {}).items()}
        platforms = {k: int(v or 0) for k, v in (data.get("platforms") or {}).items()}

        # Enrich with user info — includes academic context (class / year /
        # semester / department) so the analytics table can group by cohort.
        user_info = {}
        try:
            u_doc = db.collection(models.USERS).document(uid).get()
            if u_doc.exists:
                u = u_doc.to_dict() or {}
                user_info = {
                    "displayName": u.get("displayName", ""),
                    "email": u.get("email", ""),
                    "photoURL": u.get("photoURL", ""),
                    "role": u.get("role", ""),
                    "className": u.get("className", "") or "",
                    "year": u.get("year"),
                    "semester": u.get("semester"),
                    "department": u.get("department", "") or "",
                }
        except Exception:
            pass

        # Most / least used (ignore features with 0)
        non_zero = [(k, v) for k, v in features.items() if v > 0]
        non_zero.sort(key=lambda x: x[1], reverse=True)
        most_used = non_zero[0][0] if non_zero else ""
        least_used = non_zero[-1][0] if non_zero else ""

        grand_total_minutes += total
        for k, v in features.items():
            global_features[k] = global_features.get(k, 0) + v

        results.append({
            "userId": uid,
            "user": user_info,
            "totalMinutes": total,
            "totalLabel": _minutes_to_label(total),
            "features": features,
            "platforms": platforms,
            "mostUsedFeature": most_used,
            "leastUsedFeature": least_used,
            "firstSeenAt": data.get("firstSeenAt"),
            "lastSeenAt": data.get("lastSeenAt"),
        })

    # Global feature summary
    top_feature = max(global_features.items(), key=lambda kv: kv[1], default=("", 0))
    summary = {
        "totalUsers": len(results),
        "grandTotalMinutes": grand_total_minutes,
        "grandTotalLabel": _minutes_to_label(grand_total_minutes),
        "globalFeatures": global_features,
        "topFeature": top_feature[0],
        "topFeatureMinutes": top_feature[1],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }

    return {"users": results, "summary": summary}


@router.get("/users/{uid}/analytics")
def get_user_analytics(
    uid: str,
    days: int = Query(30, ge=1, le=180),
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Per-user usage analytics: lifetime feature breakdown + last N days of daily sessions."""
    user_doc = db.collection(models.USERS).document(uid).get()
    if not user_doc.exists:
        raise HTTPException(404, "User not found")
    u = user_doc.to_dict() or {}

    # Lifetime aggregate
    agg_snap = db.collection(models.USER_ACTIVITY_AGGREGATE).document(uid).get()
    agg = agg_snap.to_dict() if agg_snap.exists else {}
    total = int(agg.get("totalMinutes", 0) or 0) if agg else 0
    features = {k: int(v or 0) for k, v in ((agg or {}).get("features") or {}).items()}
    platforms = {k: int(v or 0) for k, v in ((agg or {}).get("platforms") or {}).items()}

    # Daily breakdown for the last N days (read docs directly by ID)
    today = datetime.now(timezone.utc).date()
    daily = []
    for i in range(days):
        d = today.fromordinal(today.toordinal() - i)
        date_key = d.strftime("%Y-%m-%d")
        snap = db.collection(models.USER_SESSIONS).document(f"{uid}_{date_key}").get()
        if snap.exists:
            dd = snap.to_dict() or {}
            daily.append({
                "date": date_key,
                "minutes": int(dd.get("minutesActive", 0) or 0),
                "features": {k: int(v or 0) for k, v in (dd.get("features") or {}).items()},
            })
        else:
            daily.append({"date": date_key, "minutes": 0, "features": {}})
    daily.reverse()  # oldest → newest

    # Most / least used
    non_zero = [(k, v) for k, v in features.items() if v > 0]
    non_zero.sort(key=lambda x: x[1], reverse=True)

    return {
        "user": {
            "id": uid,
            "displayName": u.get("displayName", ""),
            "email": u.get("email", ""),
            "photoURL": u.get("photoURL", ""),
            "role": u.get("role", ""),
            "className": u.get("className", "") or "",
            "year": u.get("year"),
            "semester": u.get("semester"),
            "department": u.get("department", "") or "",
        },
        "totalMinutes": total,
        "totalLabel": _minutes_to_label(total),
        "features": features,
        "platforms": platforms,
        "mostUsedFeatures": [{"feature": k, "minutes": v} for k, v in non_zero[:5]],
        "leastUsedFeatures": [{"feature": k, "minutes": v} for k, v in non_zero[-5:][::-1]] if len(non_zero) >= 5 else [],
        "daily": daily,
        "firstSeenAt": agg.get("firstSeenAt") if agg else None,
        "lastSeenAt": agg.get("lastSeenAt") if agg else None,
    }


# ── Admin Broadcast Announcements (SMTP email fanout) ───────────────────────

class BroadcastAnnouncementRequest(BaseModel):
    audience: Literal["all", "students", "lecturers", "specific"]
    user_ids: list[str] = Field(default_factory=list)  # required when audience == "specific"
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10_000)


def _resolve_broadcast_recipients(db, audience: str, user_ids: list[str]) -> list[dict]:
    """Return [{id, email, displayName}] for the chosen audience.

    Filters out users without an email address. For "specific", missing IDs
    are silently dropped (we don't want one bad ID to fail the whole send).
    """
    out: list[dict] = []
    if audience == "specific":
        for uid in user_ids:
            doc = db.collection(models.USERS).document(uid).get()
            if not doc.exists:
                continue
            u = doc.to_dict() or {}
            email = (u.get("email") or "").strip()
            if not email:
                continue
            out.append({"id": uid, "email": email, "displayName": u.get("displayName", "")})
        return out

    query = db.collection(models.USERS)
    if audience == "students":
        query = query.where(filter=FieldFilter("role", "==", "student"))
    elif audience == "lecturers":
        query = query.where(filter=FieldFilter("role", "==", "lecturer"))
    # "all" → no role filter

    for d in query.get():
        u = d.to_dict() or {}
        email = (u.get("email") or "").strip()
        if not email:
            continue
        out.append({"id": d.id, "email": email, "displayName": u.get("displayName", "")})
    return out


@router.post("/announcements", status_code=201)
def broadcast_announcement(
    req: BroadcastAnnouncementRequest,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Email a broadcast announcement to the chosen audience and persist a record.

    Each recipient gets a fire-and-forget SMTP email via send_notification_email
    (spawns a daemon thread per recipient — safe even if SMTP is unconfigured).
    """
    if req.audience == "specific" and not req.user_ids:
        raise HTTPException(400, "Select at least one user for a specific broadcast")

    recipients = _resolve_broadcast_recipients(db, req.audience, req.user_ids)
    if not recipients:
        raise HTTPException(400, "No recipients with valid email addresses found")

    for r in recipients:
        send_notification_email(
            to_email=r["email"],
            display_name=r["displayName"],
            title=req.subject,
            message=req.body,
            cta_label="Open MySmartStudy",
        )

    record_id = models.gen_id()
    now = datetime.now(timezone.utc)
    record = {
        "audience": req.audience,
        "subject": req.subject,
        "body": req.body,
        "recipientCount": len(recipients),
        "recipientIds": [r["id"] for r in recipients] if req.audience == "specific" else [],
        "sentBy": user["id"],
        "sentByName": user.get("displayName", ""),
        "sentByEmail": user.get("email", ""),
        "createdAt": now,
    }
    db.collection(models.ADMIN_ANNOUNCEMENTS).document(record_id).set(record)

    audit_log(
        db,
        user_id=user["id"],
        action="broadcast",
        resource_type="announcement",
        resource_id=record_id,
        details=f"Sent to {len(recipients)} recipient(s) via {req.audience}",
    )

    record["id"] = record_id
    return record


@router.get("/announcements")
def list_broadcast_announcements(
    limit: int = Query(30, le=100),
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Recent admin broadcast emails, newest first."""
    try:
        docs = (
            db.collection(models.ADMIN_ANNOUNCEMENTS)
            .order_by("createdAt", direction="DESCENDING")
            .limit(limit)
            .get()
        )
    except Exception:
        # No index yet → fall back to unsorted
        docs = db.collection(models.ADMIN_ANNOUNCEMENTS).limit(limit).get()
    return [models.doc_to_dict(d) for d in docs]


# ── Email Settings (global SMTP master switch + per-type allow-list) ──

class EmailSettingsUpdate(BaseModel):
    smtp_enabled: bool | None = None
    allowed_types: list[str] | None = None


@router.get("/email-settings")
def get_email_settings(user: dict = Depends(require_admin), db=Depends(get_db)):
    """Return the global SMTP gate config used by create_notification()."""
    from .notifications import EMAIL_NOTIFICATION_TYPES

    snap = db.collection(models.EMAIL_SETTINGS).document("global").get()
    if snap.exists:
        cfg = snap.to_dict() or {}
        smtp_enabled = bool(cfg.get("smtpEnabled", True))
        allowed = cfg.get("allowedTypes")
        if not isinstance(allowed, list):
            allowed = list(EMAIL_NOTIFICATION_TYPES)
        updated_at = cfg.get("updatedAt")
        updated_by = cfg.get("updatedBy", "")
    else:
        smtp_enabled = True
        allowed = list(EMAIL_NOTIFICATION_TYPES)
        updated_at = None
        updated_by = ""

    return {
        "smtp_enabled": smtp_enabled,
        "allowed_types": allowed,
        "all_types": list(EMAIL_NOTIFICATION_TYPES),
        "updated_at": updated_at,
        "updated_by": updated_by,
    }


@router.patch("/email-settings")
def update_email_settings(
    req: EmailSettingsUpdate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Patch the global SMTP gate. Pass either field — both are optional."""
    from .notifications import EMAIL_NOTIFICATION_TYPES

    if req.smtp_enabled is None and req.allowed_types is None:
        raise HTTPException(400, "Provide smtp_enabled and/or allowed_types")

    valid = set(EMAIL_NOTIFICATION_TYPES)
    updates: dict = {
        "updatedAt": datetime.now(timezone.utc),
        "updatedBy": user["id"],
    }
    if req.smtp_enabled is not None:
        updates["smtpEnabled"] = bool(req.smtp_enabled)
    if req.allowed_types is not None:
        # Defensive: drop unknown types so a stale client can't poison the doc.
        clean = [t for t in req.allowed_types if t in valid]
        updates["allowedTypes"] = clean

    db.collection(models.EMAIL_SETTINGS).document("global").set(updates, merge=True)

    audit_log(
        db,
        user_id=user["id"],
        action="update",
        resource_type="email_settings",
        resource_id="global",
        details=(
            f"smtp_enabled={updates.get('smtpEnabled', '<unchanged>')}, "
            f"allowed_types={updates.get('allowedTypes', '<unchanged>')}"
        ),
    )

    return get_email_settings(user=user, db=db)
