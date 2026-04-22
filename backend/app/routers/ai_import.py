"""AI-powered Google Sites to course content import — lecturer only."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.firestore import db
from app.auth import require_lecturer
from app import models
from app.ai_service import generate_json, get_knowledge_base, FAST_MODEL, set_tracking_context, safe_truncate
from datetime import datetime, timezone, timedelta
import hashlib

router = APIRouter(prefix="/api/ai/import", tags=["AI Import"])

_IMPORT_TTL_HOURS = 24


def _import_cache_get(cache_key: str) -> dict | None:
    doc = db.collection(models.AI_IMPORT_CACHE).document(cache_key).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    created = datetime.fromisoformat(data.get("createdAt", "2000-01-01"))
    if datetime.now(timezone.utc) - created > timedelta(hours=_IMPORT_TTL_HOURS):
        return None
    return data.get("result")


def _import_cache_set(cache_key: str, url: str, result: dict) -> None:
    try:
        db.collection(models.AI_IMPORT_CACHE).document(cache_key).set({
            "url": url,
            "result": result,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


class GoogleSitesRequest(BaseModel):
    url: str
    course_id: str


class ModuleItem(BaseModel):
    title: str
    type: str = "link"
    url: str = ""


class Module(BaseModel):
    title: str
    description: str = ""
    items: list[ModuleItem] = []


class ImportEditedRequest(BaseModel):
    course_id: str
    modules: list[Module]


def _scrape_google_sites(url: str) -> str:
    """Scrape text content from a Google Sites page."""
    import requests
    from bs4 import BeautifulSoup

    try:
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; MySmartStudy/1.0)"
        })
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(400, f"Could not fetch the URL: {str(e)}")

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove scripts, styles, nav
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    # Extract structured content as plain text (strips any remaining HTML/injection)
    parts = []
    for el in soup.find_all(["h1", "h2", "h3", "h4", "p", "li", "a", "td"]):
        # Re-parse individual element text to strip nested HTML tags
        text = BeautifulSoup(el.decode_contents(), "html.parser").get_text(separator=" ", strip=True)
        if not text:
            continue
        tag = el.name
        href = el.get("href", "") if el.name == "a" else ""
        if href:
            parts.append(f"[{tag}] {text} (link: {href})")
        else:
            parts.append(f"[{tag}] {text}")

    return "\n".join(parts[:500])  # Limit to prevent token overflow


@router.post("/google-sites/preview")
async def preview_import(req: GoogleSitesRequest, user=Depends(require_lecturer)):
    """Scrape and preview what modules/items would be created."""
    set_tracking_context(user["id"], "import")
    # Verify course ownership
    course_doc = db.collection(models.COURSES).document(req.course_id).get()
    if not course_doc.exists:
        raise HTTPException(404, "Course not found")
    if course_doc.to_dict().get("lecturerId") != user["id"]:
        raise HTTPException(403, "Not your course")

    cache_key = hashlib.sha256(f"preview|{req.url}|{req.course_id}".encode()).hexdigest()[:32]
    cached = _import_cache_get(cache_key)
    if cached:
        cached["_cached"] = True
        return cached

    scraped = _scrape_google_sites(req.url)
    if len(scraped.strip()) < 50:
        raise HTTPException(400, "Could not extract meaningful content from this URL")

    prompt = f"""Organise this scraped web page content into course modules with resource items.
Each module represents a topic or week. Each item is a resource (link, document, video, etc.).

SCRAPED CONTENT:
\"\"\"
{safe_truncate(scraped)}
\"\"\"

Return JSON:
{{
  "modules": [
    {{
      "title": "<module title>",
      "description": "<brief description>",
      "items": [
        {{
          "title": "<item title>",
          "type": "link" | "pdf" | "video" | "document",
          "url": "<URL if available, empty string otherwise>"
        }}
      ]
    }}
  ]
}}"""

    try:
        result = await generate_json(prompt, system_instruction=get_knowledge_base("course_import"), model_name=FAST_MODEL)
    except Exception as e:
        raise HTTPException(502, f"AI organisation failed: {str(e)}")

    _import_cache_set(cache_key, req.url, result)
    result["_cached"] = False
    return result


@router.post("/google-sites")
async def import_from_google_sites(req: GoogleSitesRequest, user=Depends(require_lecturer)):
    """Scrape, organise, and create modules/items in the course."""
    set_tracking_context(user["id"], "import")
    # Verify course
    course_doc = db.collection(models.COURSES).document(req.course_id).get()
    if not course_doc.exists:
        raise HTTPException(404, "Course not found")
    if course_doc.to_dict().get("lecturerId") != user["id"]:
        raise HTTPException(403, "Not your course")

    scraped = _scrape_google_sites(req.url)
    if len(scraped.strip()) < 50:
        raise HTTPException(400, "Could not extract meaningful content from this URL")

    prompt = f"""Organise this scraped web page content into course modules with resource items.

SCRAPED CONTENT:
\"\"\"
{safe_truncate(scraped)}
\"\"\"

Return JSON:
{{
  "modules": [
    {{
      "title": "<module title>",
      "description": "<brief description>",
      "items": [
        {{
          "title": "<item title>",
          "type": "link" | "pdf" | "video" | "document",
          "url": "<URL if available, empty string otherwise>"
        }}
      ]
    }}
  ]
}}"""

    try:
        result = await generate_json(prompt, system_instruction=get_knowledge_base("course_import"), model_name=FAST_MODEL)
    except Exception as e:
        raise HTTPException(502, f"AI organisation failed: {str(e)}")

    modules_created = 0
    items_created = 0
    now = datetime.now(timezone.utc).isoformat()

    for mod in result.get("modules", []):
        mod_id = models.gen_id()
        db.collection(models.COURSE_MODULES).document(mod_id).set({
            "courseId": req.course_id,
            "title": mod.get("title", "Imported Module"),
            "description": mod.get("description", ""),
            "createdAt": now,
        })
        modules_created += 1

        for item in mod.get("items", []):
            item_id = models.gen_id()
            db.collection(models.MODULE_ITEMS).document(item_id).set({
                "moduleId": mod_id,
                "title": item.get("title", "Imported Item"),
                "type": item.get("type", "link"),
                "url": item.get("url", ""),
                "createdAt": now,
            })
            items_created += 1

    return {
        "modules_created": modules_created,
        "items_created": items_created,
        "modules": result.get("modules", []),
    }


@router.post("/google-sites/import-edited")
async def import_edited_modules(req: ImportEditedRequest, user=Depends(require_lecturer)):
    """Import pre-edited modules (from the preview step) into a course."""
    course_doc = db.collection(models.COURSES).document(req.course_id).get()
    if not course_doc.exists:
        raise HTTPException(404, "Course not found")
    if course_doc.to_dict().get("lecturerId") != user["id"]:
        raise HTTPException(403, "Not your course")

    modules_created = 0
    items_created = 0
    now = datetime.now(timezone.utc).isoformat()

    for mod in req.modules:
        mod_id = models.gen_id()
        db.collection(models.COURSE_MODULES).document(mod_id).set({
            "courseId": req.course_id,
            "title": mod.title,
            "description": mod.description,
            "createdAt": now,
        })
        modules_created += 1

        for item in mod.items:
            item_id = models.gen_id()
            db.collection(models.MODULE_ITEMS).document(item_id).set({
                "moduleId": mod_id,
                "title": item.title,
                "type": item.type,
                "url": item.url,
                "createdAt": now,
            })
            items_created += 1

    return {
        "modules_created": modules_created,
        "items_created": items_created,
    }


class GoogleSitesPreviewOnly(BaseModel):
    url: str


@router.post("/google-sites/scrape")
async def scrape_google_sites(req: GoogleSitesPreviewOnly, user=Depends(require_lecturer)):
    """Scrape and organise content from a Google Sites URL (no course_id required).
    Used during class creation to preview before creating the course."""
    set_tracking_context(user["id"], "import")
    cache_key = hashlib.sha256(f"scrape|{req.url}".encode()).hexdigest()[:32]
    cached = _import_cache_get(cache_key)
    if cached:
        cached["_cached"] = True
        return cached

    scraped = _scrape_google_sites(req.url)
    if len(scraped.strip()) < 50:
        raise HTTPException(400, "Could not extract meaningful content from this URL")

    prompt = f"""Organise this scraped web page content into course modules with resource items.
Each module represents a topic or week. Each item is a resource (link, document, video, etc.).

Also try to extract the course name and course code from the content if available.

SCRAPED CONTENT:
\"\"\"
{safe_truncate(scraped)}
\"\"\"

Return JSON:
{{
  "course_name": "<extracted course name or empty string>",
  "course_code": "<extracted course code or empty string>",
  "modules": [
    {{
      "title": "<module title>",
      "description": "<brief description>",
      "items": [
        {{
          "title": "<item title>",
          "type": "link" | "pdf" | "video" | "document",
          "url": "<URL if available, empty string otherwise>"
        }}
      ]
    }}
  ]
}}"""

    try:
        result = await generate_json(prompt, system_instruction=get_knowledge_base("course_import"), model_name=FAST_MODEL)
    except Exception as e:
        raise HTTPException(502, f"AI organisation failed: {str(e)}")

    _import_cache_set(cache_key, req.url, result)
    result["_cached"] = False
    return result
