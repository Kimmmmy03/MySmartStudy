import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from google.cloud.firestore_v1 import ArrayUnion, ArrayRemove
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer_or_admin, require_admin
from datetime import datetime, timezone

LOTTIE_UPLOAD_DIR = os.path.join("uploads", "lottie")
os.makedirs(LOTTIE_UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/api/badges", tags=["Badges"])


# ── Default (built-in) badge definitions ──
DEFAULT_BADGES = [
    {
        "id": "cartographer",
        "name": "Cartographer",
        "description": "Create your first mind map",
        "icon": "map",
        "color": "from-blue-500 to-cyan-400",
        "condition_type": "maps_created",
        "condition_value": 1,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "map_master",
        "name": "Map Master",
        "description": "Create 5 mind maps",
        "icon": "trophy",
        "color": "from-amber-500 to-yellow-400",
        "condition_type": "maps_created",
        "condition_value": 5,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "on_fire",
        "name": "On Fire",
        "description": "Maintain a 3-day streak",
        "icon": "flame",
        "color": "from-orange-500 to-red-400",
        "condition_type": "streak_days",
        "condition_value": 3,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "unstoppable",
        "name": "Unstoppable",
        "description": "Maintain a 7-day streak",
        "icon": "zap",
        "color": "from-purple-500 to-pink-400",
        "condition_type": "streak_days",
        "condition_value": 7,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "top_marks",
        "name": "Top Marks",
        "description": "Score 90%+ on any assignment or quiz",
        "icon": "star",
        "color": "from-yellow-400 to-amber-500",
        "condition_type": "quiz_score",
        "condition_value": 90,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "early_bird",
        "name": "Early Bird",
        "description": "Submit 24+ hours before deadline",
        "icon": "bird",
        "color": "from-sky-400 to-blue-500",
        "condition_type": "early_submissions",
        "condition_value": 1,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "quiz_whiz",
        "name": "Quiz Whiz",
        "description": "Complete 5 quizzes",
        "icon": "brain",
        "color": "from-pink-500 to-purple-500",
        "condition_type": "quizzes_completed",
        "condition_value": 5,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "helper",
        "name": "Helper",
        "description": "Write 3 peer reviews",
        "icon": "handshake",
        "color": "from-emerald-500 to-teal-400",
        "condition_type": "peer_reviews",
        "condition_value": 3,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "completionist",
        "name": "Completionist",
        "description": "Complete all activities in a course",
        "icon": "check-circle",
        "color": "from-indigo-500 to-blue-400",
        "condition_type": "course_completed",
        "condition_value": 1,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "explorer",
        "name": "Explorer",
        "description": "Join your first course",
        "icon": "compass",
        "color": "from-teal-500 to-emerald-400",
        "condition_type": "courses_joined",
        "condition_value": 1,
        "points_reward": 25,
        "is_default": True,
    },
    {
        "id": "team_player",
        "name": "Team Player",
        "description": "Collaborate on 3 mind maps",
        "icon": "users",
        "color": "from-violet-500 to-fuchsia-400",
        "condition_type": "collaborations",
        "condition_value": 3,
        "points_reward": 25,
        "is_default": True,
    },
]


# ── GET all badge definitions (default + custom) ──
@router.get("/definitions")
def list_badge_definitions(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Return all badge definitions: built-in defaults + custom ones from Firestore."""
    # Load lottie overrides for default badges (lottie_url, lottie_size, etc.)
    lottie_overrides: dict[str, dict] = {}
    try:
        for odoc in db.collection("badge_lottie_overrides").stream():
            od = odoc.to_dict()
            if od:
                lottie_overrides[odoc.id] = od
    except Exception:
        pass

    MERGEABLE_FIELDS = {"lottie_url", "lottie_size", "lottie_dpr", "color", "name", "description", "icon"}
    result = []
    for b in DEFAULT_BADGES:
        entry = dict(b)
        override = lottie_overrides.get(entry["id"], {})
        for field in MERGEABLE_FIELDS:
            if field in override:
                entry[field] = override[field]
        result.append(entry)

    # Fetch custom badge definitions from Firestore
    custom_docs = db.collection(models.BADGE_DEFINITIONS).stream()
    for doc in custom_docs:
        d = models.doc_to_dict(doc)
        if d:
            d["is_default"] = False
            result.append(d)

    return result


# ── CREATE custom badge definition (lecturer or admin) ──
@router.post("/definitions")
def create_badge_definition(
    req: schemas.BadgeDefinitionCreate,
    user: dict = Depends(require_lecturer_or_admin),
    db=Depends(get_db),
):
    bid = models.gen_id()
    data = {
        "name": req.name,
        "description": req.description,
        "icon": req.icon,
        "color": req.color,
        "condition_type": req.condition_type,
        "condition_value": req.condition_value,
        "course_id": req.course_id,
        "points_reward": req.points_reward,
        "created_by": user["id"],
        "created_by_name": user.get("displayName", user.get("email", "")),
        "created_at": datetime.now(timezone.utc),
        "is_default": False,
    }
    if req.lottie_size is not None:
        data["lottie_size"] = req.lottie_size
    if req.lottie_dpr is not None:
        data["lottie_dpr"] = req.lottie_dpr
    db.collection(models.BADGE_DEFINITIONS).document(bid).set(data)
    data["id"] = bid
    return data


# ── UPDATE badge definition (lecturer or admin) ──
@router.patch("/definitions/{badge_id}")
def update_badge_definition(
    badge_id: str,
    req: schemas.BadgeDefinitionUpdate,
    user: dict = Depends(require_lecturer_or_admin),
    db=Depends(get_db),
):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Check if this is a default badge
    is_default = any(b["id"] == badge_id for b in DEFAULT_BADGES)
    if is_default:
        # For default badges, store allowed overrides in badge_lottie_overrides collection
        # Only persist fields that can be customised per-default-badge
        ALLOWED_OVERRIDE_FIELDS = {"lottie_url", "lottie_size", "lottie_dpr", "color", "name", "description", "icon"}
        override_updates = {k: v for k, v in updates.items() if k in ALLOWED_OVERRIDE_FIELDS}
        if override_updates:
            override_ref = db.collection("badge_lottie_overrides").document(badge_id)
            override_doc = override_ref.get()
            existing = override_doc.to_dict() if override_doc.exists else {}
            existing.update(override_updates)
            existing["updated_at"] = datetime.now(timezone.utc)
            override_ref.set(existing)
        # Return merged default + overrides
        entry = dict(next(b for b in DEFAULT_BADGES if b["id"] == badge_id))
        override_ref = db.collection("badge_lottie_overrides").document(badge_id)
        override_doc = override_ref.get()
        if override_doc.exists:
            od = override_doc.to_dict() or {}
            for field in ALLOWED_OVERRIDE_FIELDS:
                if field in od:
                    entry[field] = od[field]
        entry["is_default"] = True
        return entry

    doc_ref = db.collection(models.BADGE_DEFINITIONS).document(badge_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Badge definition not found")

    doc_ref.update(updates)
    d = models.doc_to_dict(doc_ref.get())
    d["is_default"] = False
    return d


# ── DELETE custom badge definition (lecturer or admin) ──
@router.delete("/definitions/{badge_id}")
def delete_badge_definition(
    badge_id: str,
    user: dict = Depends(require_lecturer_or_admin),
    db=Depends(get_db),
):
    doc_ref = db.collection(models.BADGE_DEFINITIONS).document(badge_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Badge definition not found")
    doc_ref.delete()
    return {"ok": True}


# ── REVOKE badge (admin only) ──
@router.post("/revoke")
def revoke_badge(req: schemas.BadgeAction, user: dict = Depends(require_admin), db=Depends(get_db)):
    db.collection(models.USERS).document(req.student_id).update(
        {"badges": ArrayRemove([req.badge_id])}
    )
    return {"ok": True}


# ── Manual AWARD (kept for admin only) ──
@router.post("/award")
def award_badge(req: schemas.BadgeAction, user: dict = Depends(require_admin), db=Depends(get_db)):
    doc = db.collection(models.USERS).document(req.student_id).get()
    u = models.doc_to_dict(doc)
    if not u:
        raise HTTPException(status_code=404, detail="Student not found")
    if req.badge_id in u.get("badges", []):
        raise HTTPException(status_code=400, detail="Badge already awarded")
    db.collection(models.USERS).document(req.student_id).update(
        {"badges": ArrayUnion([req.badge_id])}
    )
    return {"ok": True}


# ── Check newly earned badges for current user ──
@router.get("/check")
def check_my_badges(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Run badge checks for the current user and return any newly awarded badges.
    Only students can earn badges — admins and lecturers are skipped."""
    if user.get("role") in ("admin", "lecturer"):
        return {"newly_awarded": []}
    from .auto_badges import check_and_award_badges
    newly_awarded = check_and_award_badges(db, user["id"]) or []
    return {"newly_awarded": newly_awarded}


# ── Upload Lottie file for a badge ──
@router.post("/definitions/{badge_id}/lottie")
async def upload_badge_lottie(
    badge_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_lecturer_or_admin),
    db=Depends(get_db),
):
    """Upload a .lottie file for a badge definition. Returns the URL."""
    if not file.filename or not file.filename.endswith(".lottie"):
        raise HTTPException(status_code=400, detail="Only .lottie files are accepted")

    # Verify badge exists (custom or default)
    is_default = any(b["id"] == badge_id for b in DEFAULT_BADGES)
    if not is_default:
        doc = db.collection(models.BADGE_DEFINITIONS).document(badge_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Badge definition not found")

    filename = f"{badge_id}_{uuid.uuid4().hex[:8]}.lottie"
    filepath = os.path.join(LOTTIE_UPLOAD_DIR, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    lottie_url = f"/uploads/lottie/{filename}"

    # Save to Firestore (for custom badges, update the doc; for default, store separately)
    if is_default:
        db.collection("badge_lottie_overrides").document(badge_id).set(
            {"lottie_url": lottie_url, "updated_at": datetime.now(timezone.utc)}
        )
    else:
        db.collection(models.BADGE_DEFINITIONS).document(badge_id).update(
            {"lottie_url": lottie_url}
        )

    return {"ok": True, "lottie_url": lottie_url}


# ── Get Lottie overrides for default badges ──
@router.get("/lottie-overrides")
def get_lottie_overrides(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Return lottie_url overrides for default badges."""
    docs = db.collection("badge_lottie_overrides").stream()
    result = {}
    for doc in docs:
        d = doc.to_dict()
        if d and "lottie_url" in d:
            result[doc.id] = d["lottie_url"]
    return result
