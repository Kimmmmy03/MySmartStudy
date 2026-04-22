"""AI image generation for mind map nodes.

Credit-saving measures:
  • 1 generation per user per calendar day (UTC).  Quota stored in Firestore aiImageQuotas.
  • Prompt-level deduplication: same (prompt, style) within 7 days returns the cached URL.
  • Quota/cache status exposed on GET /images/quota so frontends can gate the button.
"""

import asyncio
import hashlib
import os
import re
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.ai_service import generate_text, _get_client, set_tracking_context
from app.firestore import db
from app import models

router = APIRouter(prefix="/api/ai/images", tags=["AI Images"])

# Style presets that the frontend can send
STYLE_PRESETS: dict[str, str] = {
    "cartoon":   "in a fun cartoon illustration style, colorful and kid-friendly",
    "realistic": "as a photorealistic image with natural lighting",
    "sketch":    "as a hand-drawn pencil sketch, black and white with shading",
    "watercolor":"as a soft watercolor painting with gentle colors",
    "flat":      "as a flat design vector illustration with bold colors and clean lines",
    "3d":        "as a 3D rendered object with soft lighting and depth",
    "pixel":     "in pixel art style with retro 8-bit aesthetics",
    "abstract":  "as an abstract artistic interpretation with geometric shapes and vivid colors",
}

# Maximum images a single user may generate per calendar day (UTC)
IMAGE_DAILY_LIMIT = 3


# ── Helpers ──────────────────────────────────────────────────────────────────

def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _quota_doc_id(user_id: str, date: str) -> str:
    return f"{user_id}_{date}"


def _prompt_hash(prompt: str, style: str) -> str:
    key = f"{prompt.strip().lower()}|{style.strip().lower()}"
    return hashlib.sha256(key.encode()).hexdigest()[:32]


def _get_quota(user_id: str, date: str) -> int:
    """Return how many images the user has generated today (UTC)."""
    doc = db.collection(models.AI_IMAGE_QUOTAS).document(
        _quota_doc_id(user_id, date)
    ).get()
    if doc.exists:
        return doc.to_dict().get("count", 0)
    return 0


def _increment_quota(user_id: str, date: str) -> int:
    """Atomically increment the daily counter and return the new count.

    Uses Firestore ``Increment`` so concurrent requests never produce a
    stale read-then-write race.
    """
    from google.cloud.firestore_v1 import Increment

    doc_ref = db.collection(models.AI_IMAGE_QUOTAS).document(
        _quota_doc_id(user_id, date)
    )
    doc_ref.set({
        "userId": user_id,
        "date": date,
        "count": Increment(1),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }, merge=True)
    # Read-back to get the authoritative new count
    snap = doc_ref.get()
    return snap.to_dict().get("count", 1) if snap.exists else 1


def _check_prompt_cache(prompt_hash: str) -> dict | None:
    """Return a cached image record if the same prompt was generated within 7 days."""
    docs = (
        db.collection(models.AI_IMAGE_CACHE)
        .where("promptHash", "==", prompt_hash)
        .limit(1)
        .get()
    )
    if not docs:
        return None
    d = docs[0].to_dict()
    # Treat cache as valid for 7 days
    generated_at = d.get("generatedAt", "")
    if generated_at:
        try:
            age_days = (
                datetime.now(timezone.utc)
                - datetime.fromisoformat(generated_at)
            ).days
            if age_days <= 7:
                return d
        except Exception:
            pass
    return None


def _save_prompt_cache(prompt_hash: str, image_url: str, elaborated_prompt: str, user_id: str):
    db.collection(models.AI_IMAGE_CACHE).document(prompt_hash).set({
        "promptHash": prompt_hash,
        "imageUrl": image_url,
        "elaboratedPrompt": elaborated_prompt,
        "userId": user_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    })


# ── Elaboration cache (cache expanded prompts independently of image result) ──

def _get_elaboration_cache(prompt_hash: str) -> str | None:
    """Return a cached elaborated prompt if within 30 days, else None."""
    doc = db.collection(models.AI_ELABORATION_CACHE).document(prompt_hash).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    try:
        created = datetime.fromisoformat(data.get("createdAt", "2000-01-01"))
        if datetime.now(timezone.utc) - created <= timedelta(days=30):
            return data.get("elaboratedPrompt")
    except Exception:
        pass
    return None


def _set_elaboration_cache(prompt_hash: str, elaborated_prompt: str) -> None:
    try:
        db.collection(models.AI_ELABORATION_CACHE).document(prompt_hash).set({
            "elaboratedPrompt": elaborated_prompt,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


# ── Firebase Storage upload (with local disk fallback) ───────────────────────

def _upload_image(image_bytes: bytes, user_id: str, ext: str) -> str:
    """Upload image bytes to Firebase Storage if configured, else save to local disk.
    Returns a URL string."""
    bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "")
    filename = f"{uuid.uuid4().hex}.{ext}"

    if bucket_name:
        try:
            import firebase_admin.storage as fb_storage
            bucket = fb_storage.bucket(bucket_name)
            blob_path = f"ai-images/{user_id}/{filename}"
            blob = bucket.blob(blob_path)
            content_type = (
                "image/jpeg" if ext == "jpg"
                else "image/webp" if ext == "webp"
                else "image/svg+xml" if ext == "svg"
                else "image/png"
            )
            blob.upload_from_string(image_bytes, content_type=content_type)
            blob.make_public()
            return blob.public_url
        except Exception:
            pass  # Fall through to local disk

    # Local disk fallback
    user_dir = os.path.join("uploads", "ai-images", user_id)
    os.makedirs(user_dir, exist_ok=True)
    filepath = os.path.join(user_dir, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    return f"/uploads/ai-images/{user_id}/{filename}"


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/styles")
async def list_styles(user=Depends(get_current_user)):
    """Return available image style presets."""
    return [{"key": k, "label": k.capitalize(), "description": v}
            for k, v in STYLE_PRESETS.items()]


@router.get("/quota")
async def get_quota(user=Depends(get_current_user)):
    """Return how many images the user has generated today and the effective daily limit."""
    date = _today_utc()
    used = _get_quota(user["id"], date)
    # Respect per-user limit override set by admin
    effective_limit = IMAGE_DAILY_LIMIT
    try:
        settings_doc = db.collection(models.AI_USER_SETTINGS).document(user["id"]).get()
        if settings_doc.exists:
            override = settings_doc.to_dict().get("imageQuotaLimit")
            if override is not None:
                effective_limit = int(override)
    except Exception:
        pass
    return {
        "used": used,
        "limit": effective_limit,
        "remaining": max(0, effective_limit - used),
        "date": date,
        "can_generate": used < effective_limit,
    }


async def _elaborate_prompt(short_prompt: str, style_hint: str) -> str:
    """Use a Gemini text model to expand a short description into a rich image prompt."""
    elaboration_instruction = (
        "You are an expert image prompt engineer. Given a short description, "
        "expand it into a detailed, vivid image generation prompt. "
        "Include specific details about: the subject's appearance, colors, textures, "
        "lighting, composition, background/environment, mood, and perspective. "
        "Keep it under 200 words. Output ONLY the elaborated prompt, nothing else.\n\n"
        f"Style: {style_hint}\n"
        f"Short description: {short_prompt}"
    )
    try:
        elaborated = await generate_text(elaboration_instruction, temperature=0.7)
        elaborated = elaborated.strip().strip('"').strip("'").strip("`")
        if len(elaborated) > 30:
            return elaborated
    except Exception:
        pass
    return f"{short_prompt}, {style_hint}"


class ImageGenerateRequest(BaseModel):
    prompt: str
    style: str = ""
    map_id: str = ""


@router.post("/generate")
async def generate_image(
    req: ImageGenerateRequest,
    user=Depends(get_current_user),
):
    """Generate an image from a text prompt.

    Enforces:
    - 1 generation per user per day (UTC).
    - Prompt-level deduplication: identical (prompt, style) within 7 days re-uses
      the previously generated image without consuming quota or API credits.
    """
    if not req.prompt or len(req.prompt.strip()) < 3:
        raise HTTPException(400, "Prompt is too short")

    raw_prompt  = req.prompt.strip()
    style_key   = req.style if req.style in STYLE_PRESETS else ""
    style_hint  = STYLE_PRESETS.get(style_key, "as a detailed realistic image with natural lighting")
    phash       = _prompt_hash(raw_prompt, style_key)
    today       = _today_utc()
    user_id     = user["id"]
    set_tracking_context(user_id, "images")

    # ── Per-user quota override (admin can set custom daily limit) ────────────
    _user_limit = IMAGE_DAILY_LIMIT
    try:
        settings_doc = db.collection(models.AI_USER_SETTINGS).document(user_id).get()
        if settings_doc.exists:
            override = settings_doc.to_dict().get("imageQuotaLimit")
            if override is not None:
                _user_limit = int(override)
    except Exception:
        pass

    # ── 1. Prompt dedup check (free re-use within 7 days, no quota hit) ──────
    cached = _check_prompt_cache(phash)
    if cached:
        return {
            "image_url": cached["imageUrl"],
            "cached": True,
            "prompt_hash": phash,
        }

    # ── 2. Daily quota check ──────────────────────────────────────────────────
    used = _get_quota(user_id, today)
    if used >= _user_limit:
        raise HTTPException(
            429,
            detail={
                "error": "daily_limit_reached",
                "message": f"You have reached your daily image generation limit ({_user_limit}/day). Try again tomorrow.",
                "used": used,
                "limit": _user_limit,
                "date": today,
            },
        )

    # ── 3. Elaborate prompt (check cache first) ───────────────────────────────
    full_prompt = _get_elaboration_cache(phash)
    if not full_prompt:
        full_prompt = await _elaborate_prompt(raw_prompt, style_hint)
        _set_elaboration_cache(phash, full_prompt)

    ext = "png"
    image_bytes: bytes | None = None

    # ── 4a. Gemini 3.1 Flash Image ────────────────────────────────────────────
    try:
        from google.genai import types as _types
        client = _get_client()
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.0-flash-preview-image-generation",
            contents=f"Generate an image: {full_prompt}",
            config=_types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )
        if response.candidates:
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                    image_bytes = part.inline_data.data
                    mime = part.inline_data.mime_type
                    ext = "jpg" if "jpeg" in mime or "jpg" in mime else ("webp" if "webp" in mime else "png")
                    break
    except Exception:
        pass

    # ── 4b. Imagen 3 fallback ─────────────────────────────────────────────────
    if image_bytes is None:
        try:
            from google import genai as _genai
            client = _get_client()
            img_response = await asyncio.to_thread(
                client.models.generate_images,
                model="imagen-3.0-generate-002",
                prompt=full_prompt,
                config=_genai.types.GenerateImagesConfig(number_of_images=1),
            )
            if img_response.generated_images:
                image_bytes = img_response.generated_images[0].image.image_bytes
                ext = "png"
        except Exception:
            pass

    # ── 4c. SVG text fallback ─────────────────────────────────────────────────
    if image_bytes is None:
        svg_prompt = (
            f"Generate a detailed, high-quality SVG image (512x512) for: {full_prompt}. "
            "Use gradients, shadows, and rich details. Return ONLY the SVG code, nothing else."
        )
        try:
            svg_text = await generate_text(svg_prompt, temperature=0.5)
            svg_match = re.search(r"<svg[\s\S]*?</svg>", svg_text)
            if svg_match:
                image_bytes = svg_match.group(0).encode("utf-8")
                ext = "svg"
            else:
                raise HTTPException(502, "Could not generate image")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(502, f"Image generation failed: {str(e)}")

    if image_bytes is None:
        raise HTTPException(502, "All image generation strategies failed")

    # ── 5. Persist to Firebase Storage (or local disk fallback) ──────────────
    image_url = _upload_image(image_bytes, user_id, ext)

    # ── 6. Save to caches + increment quota ───────────────────────────────────
    _save_prompt_cache(phash, image_url, full_prompt, user_id)
    new_count = _increment_quota(user_id, today)

    return {
        "image_url": image_url,
        "cached": False,
        "prompt_hash": phash,
        "quota": {"used": new_count, "limit": _user_limit, "remaining": max(0, _user_limit - new_count)},
    }


@router.get("/my-images")
async def list_my_images(user=Depends(get_current_user)):
    """Return the current user's generated image history (most recent 20)."""
    docs = (
        db.collection(models.AI_IMAGE_CACHE)
        .where("userId", "==", user["id"])
        .order_by("generatedAt", direction="DESCENDING")
        .limit(20)
        .get()
    )
    results = []
    for doc in docs:
        d = doc.to_dict()
        results.append({
            "prompt_hash": d.get("promptHash"),
            "image_url": d.get("imageUrl"),
            "elaborated_prompt": d.get("elaboratedPrompt"),
            "generated_at": d.get("generatedAt"),
        })
    return results


@router.delete("/my-images/{prompt_hash}")
async def delete_my_image(prompt_hash: str, user=Depends(get_current_user)):
    """Delete a generated image from the user's history."""
    doc = db.collection(models.AI_IMAGE_CACHE).document(prompt_hash).get()
    if not doc.exists:
        raise HTTPException(404, "Image not found")
    if doc.to_dict().get("userId") != user["id"]:
        raise HTTPException(403, "Not your image")
    doc.reference.delete()
    return {"ok": True}
