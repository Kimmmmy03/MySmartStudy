"""
Google Sites Import Router — scrape a Google Site using DOM-aware extraction
and use Gemini AI to intelligently structure it into a MySmartStudy course
with modules, items, groups, and assignments.

Features a learning system that improves with each import.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from urllib.parse import urlparse
from .. import models
from ..firestore import get_db
from ..auth import require_lecturer
from ..audit import audit_log
from ..ai_service import generate_json
from datetime import datetime, timezone
import asyncio
import json as json_mod
import hashlib
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import", tags=["Import"])


# ── Schemas ──

class ImportPreviewRequest(BaseModel):
    url: str
    max_pages: int = 80


class ImportRequest(BaseModel):
    url: str
    max_pages: int = 80


# ── Gemini prompt ──

SITE_ANALYSIS_PROMPT = """You are an expert at analyzing educational websites and organizing them into structured course content for a Learning Management System (LMS).

I have scraped a Google Site using DOM-aware extraction. The data below includes ALL text content, ALL embedded resources (extracted from data-code/jsname wrappers), ALL external links, and ALL images with their links.

{learning_context}

{course_kb_context}

SITE TITLE: {site_title}
SITE URL: {site_url}
TOTAL PAGES SCRAPED: {page_count}
EXTRACTION STATS: {stats}

NAVIGATION TREE (shows full site structure with hierarchy levels):
{nav_text}

PAGE DATA:
{pages_text}

ALL EMBEDDED RESOURCES EXTRACTED (from data-code/jsname wrappers — Canva, Padlet, YouTube, Google Docs, etc.):
{resources_text}

Based on this data, create a structured course import. Analyze:
1. Course name and code (from site title, URL, or page content)
2. Semester information
3. Student groups/cohorts (PK1, PK2, PAKK1, Group A, Section 1, Kumpulan — look at nav structure)
4. Modules/topics organized by the navigation hierarchy
5. Assignments and assessments (pentaksiran, assessment, rubric)
6. Attendance/kehadiran pages with Google Forms
7. ALL resources: Canva designs, Padlet boards, Google Slides/Docs/Forms/Sheets, YouTube videos, PDFs, any external links
8. Text content from each page

Return this EXACT JSON structure:
{{
  "course": {{
    "course_name": "<extracted course name>",
    "course_code": "<course code like EDUP3103, or IMPORTED>",
    "semester": "<semester number or 1>",
    "description": "<brief description>"
  }},
  "groups": [
    {{ "name": "<group name like PK 1, PAKK 1, Group A>", "description": "" }}
  ],
  "modules": [
    {{
      "title": "<module/topic name>",
      "description": "<brief description from page text content>",
      "order": 0,
      "items": [
        {{
          "title": "<resource title — be descriptive>",
          "type": "<canva|padlet|google_slides|google_doc|google_form|google_sheets|youtube|drive_file|drive_folder|pdf|video|form|link|content|image>",
          "url": "<the actual resource URL (Canva, Padlet, Google Docs, YouTube, etc.)>",
          "embed_url": "<embeddable iframe URL for preview, or empty string>",
          "file_type": "<slides|document|pdf|video|form|link|spreadsheet|canva|padlet|null>",
          "description": "<text content or description — especially important for content-type items>",
          "group_name": "<group name if this item is group-specific, null otherwise>",
          "drive_id": "<Google Drive/YouTube ID if applicable, empty string otherwise>"
        }}
      ]
    }}
  ],
  "assignments": [
    {{
      "type": "assignment",
      "title": "<assignment title>",
      "description": "<description from page text>",
      "url": "<URL to assignment doc/rubric>"
    }}
  ],
  "attendance_sessions": [
    {{
      "title": "<session title>",
      "form_url": "<Google Form URL>"
    }}
  ],
  "warnings": ["<any warnings>"]
}}

CRITICAL RULES:
- Include EVERY resource found — every Canva design, every Padlet board, every embed, every external link
- Use the navigation tree hierarchy to organize modules logically
- If pages are organized by groups (e.g. PK 1, PK 2, PAKK 1 sub-pages), set group_name on items
- For embeddable resources, generate proper embed_url:
  * Google Slides: https://docs.google.com/presentation/d/ID/embed?start=false&loop=false
  * Google Docs: https://docs.google.com/document/d/ID/pub?embedded=true
  * Google Sheets: https://docs.google.com/spreadsheets/d/ID/pubhtml?widget=true
  * Google Forms: https://docs.google.com/forms/d/ID/viewform?embedded=true
  * Google Drive files: https://drive.google.com/file/d/ID/preview
  * YouTube: https://www.youtube.com/embed/VIDEO_ID
  * Canva: use the /view?embed URL directly
  * Padlet: use the padlet.com URL directly
- NEVER use Google Sites page URLs (sites.google.com) as item URLs
- For content-type items (page text with no external URL): set url to "" and put the actual text in description
- Preserve ALL text content from pages — put it in the module description or as content items
- When the same topic appears under multiple groups (PK 1, PK 2, PAKK 1), create items for EACH group with appropriate group_name
- Module order should follow the navigation tree order
- COURSE CODE MATCHING: Use the IPG Course Knowledge Base above to match course codes.
  * Look for course codes in the site title, URL, and page content (format: 2-4 letters + 4 digits, e.g. EDUP3103)
  * If a code is found in the KB, use the EXACT code and title from the KB
  * If a code is found but NOT in the KB, still use it as course_code and extract the title from the site
  * Common IPG prefixes: EDUP (Education), BMMB (Bahasa Melayu), TSLB (TESL), PIMK (Pendidikan Islam), MTES (Math), SCES (Science), PJMS (Physical Ed), PKES (Special Ed), PAKK (Early Childhood), BNKK (Counseling), SJHK (History), PSVK (Visual Arts), MZAK (Music), RBTK (Design & Tech)"""


async def _scrape_and_analyze(url: str, max_pages: int) -> dict:
    """Scrape site with DOM-aware extraction and use Gemini to analyze."""
    from ..site_importer.scraper import (
        scrape_google_site, get_learning_context, get_course_kb_context,
        extract_course_code_from_text, add_course_to_kb, lookup_course_code,
    )

    # Step 1: Scrape all pages with DOM knowledge
    scraped = await scrape_google_site(url, max_pages=max_pages)

    pages = scraped.get("pages", [])
    if not pages:
        raise HTTPException(status_code=400, detail="Could not fetch any pages from this URL")

    # Step 2: Build rich context for Gemini
    pages_text_parts = []
    all_resources = []

    for i, page in enumerate(pages):
        page_section = f"\n{'='*60}\n"
        page_section += f"PAGE {i+1}: {page.get('title', 'Untitled')}\n"
        page_section += f"DO NOT use as item URL: {page.get('url', '')}\n"
        page_section += f"Path: {page.get('path', '')}\n"
        page_section += f"Breadcrumb: {' > '.join(page.get('breadcrumb', []))}\n"

        # Full text content from CDt4Ke blocks
        text_blocks = page.get("text_blocks", [])
        if text_blocks:
            page_section += f"\nTEXT CONTENT ({len(text_blocks)} blocks):\n"
            for tb in text_blocks:
                page_section += f"  [{tb.get('tag', 'p')}] {tb.get('text', '')}\n"

        # All body text
        body = page.get("body_text", "")
        if body and not text_blocks:
            page_section += f"\nBody Text:\n{body[:5000]}\n"

        # Resources (embeds + external links)
        resources = page.get("resources", [])
        if resources:
            page_section += f"\nRESOURCES ({len(resources)} found):\n"
            for res in resources:
                rtype = res.get("type", "link")
                title = res.get("title", "")
                rurl = res.get("url", "")
                embed = res.get("embed_url", "")
                source = res.get("source", "")
                line = f"  [{rtype}] {title} — {rurl}"
                if embed and embed != rurl:
                    line += f" [EMBED: {embed}]"
                if source:
                    line += f" ({source})"
                if res.get("drive_id"):
                    line += f" (ID: {res['drive_id']})"
                page_section += line + "\n"
                all_resources.append({
                    **res,
                    "source_page": page.get("path", ""),
                    "source_title": page.get("title", ""),
                })

        # Images
        images = page.get("images", [])
        if images:
            linked_imgs = [img for img in images if img.get("link_href")]
            if linked_imgs:
                page_section += f"\nIMAGES WITH LINKS ({len(linked_imgs)}):\n"
                for img in linked_imgs:
                    page_section += f"  Image '{img.get('alt', '')}' -> {img['link_href']}\n"

        pages_text_parts.append(page_section)

    # Navigation tree text
    nav_items = scraped.get("navigation", [])
    nav_text = "\n".join(
        f"{'  ' * n.get('level', 1)}[L{n.get('level', 1)}] {n.get('title', '')} -> {n.get('url', '')}"
        for n in nav_items
    ) or "(no navigation extracted)"

    # All resources summary
    resources_text = "\n".join(
        f"  [{r.get('type')}] {r.get('title', '')} — {r.get('url', '')} "
        f"(from: {r.get('source_title', '')} | {r.get('source', '')})"
        for r in all_resources
    ) or "(no resources found)"

    # Stats
    stats = (
        f"{len(pages)} pages, "
        f"{scraped.get('total_embeds_found', 0)} embeds, "
        f"{scraped.get('total_text_blocks', 0)} text blocks, "
        f"{scraped.get('total_images', 0)} images, "
        f"{scraped.get('total_external_links', 0)} external links, "
        f"{len(all_resources)} total resources"
    )

    # Learning context from past imports
    learning_context = get_learning_context()

    # Course knowledge base context
    course_kb_context = get_course_kb_context()

    # Build pages text with generous limit
    pages_text = "\n".join(pages_text_parts)
    if len(pages_text) > 80000:
        pages_text = pages_text[:80000] + "\n\n... (truncated)"

    prompt = SITE_ANALYSIS_PROMPT.format(
        site_title=scraped.get("site_title", "Unknown"),
        site_url=url,
        page_count=len(pages),
        pages_text=pages_text,
        resources_text=resources_text[:10000],
        nav_text=nav_text[:3000],
        stats=stats,
        learning_context=learning_context,
        course_kb_context=course_kb_context,
    )

    # Step 3: Ask Gemini to analyze
    logger.info(f"Sending {len(pages)} pages ({len(all_resources)} resources) to Gemini")
    try:
        analyzed = await generate_json(prompt, temperature=0.2)
    except Exception as e:
        logger.exception("Gemini analysis failed")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {str(e)}")

    # Ensure required keys exist
    if "course" not in analyzed:
        analyzed["course"] = {
            "course_name": scraped.get("site_title", "Imported Course"),
            "course_code": "IMPORTED",
            "semester": "1",
            "description": f"Imported from: {url}",
        }
    for key in ("groups", "modules", "assignments", "attendance_sessions", "warnings"):
        if key not in analyzed:
            analyzed[key] = []

    # Post-process: validate and enrich course code using knowledge base
    course_info = analyzed["course"]
    gemini_code = course_info.get("course_code", "IMPORTED")

    # Try to match the code Gemini extracted
    kb_match = lookup_course_code(gemini_code) if gemini_code != "IMPORTED" else None

    if kb_match and kb_match["title"]:
        # Found in KB — use the official title
        course_info["course_code"] = kb_match["code"]
        if not course_info.get("course_name") or course_info["course_name"] == "Imported Course":
            course_info["course_name"] = kb_match["title"]
        logger.info(f"Course code matched from KB: {kb_match['code']} = {kb_match['title']}")
    elif gemini_code and gemini_code != "IMPORTED":
        # Not in KB — try to extract from site title/URL as fallback
        site_text = f"{scraped.get('site_title', '')} {url}"
        fallback = extract_course_code_from_text(site_text)
        if fallback and fallback["title"]:
            course_info["course_code"] = fallback["code"]
            if not course_info.get("course_name") or course_info["course_name"] == "Imported Course":
                course_info["course_name"] = fallback["title"]
        else:
            # New course code not in KB — add it to KB for future imports
            course_name = course_info.get("course_name", "")
            if course_name and course_name != "Imported Course":
                added = add_course_to_kb(gemini_code, course_name)
                if added:
                    analyzed.setdefault("warnings", []).append(
                        f"New course '{gemini_code}: {course_name}' added to knowledge base"
                    )
                    logger.info(f"New course added to KB: {gemini_code} = {course_name}")

    return {
        "scraped": scraped,
        "analyzed": analyzed,
    }


@router.post("/google-site/preview")
async def preview_google_site(
    req: ImportPreviewRequest,
    user: dict = Depends(require_lecturer),
):
    """Scrape a Google Site and return a preview of what would be imported."""
    if not req.url or "sites.google.com" not in req.url:
        raise HTTPException(status_code=400, detail="Please provide a valid Google Sites URL")

    try:
        result = await _scrape_and_analyze(req.url, req.max_pages)
        analyzed = result["analyzed"]
        scraped = result["scraped"]

        modules = analyzed.get("modules", [])
        return {
            "ok": True,
            "preview": {
                "course": analyzed["course"],
                "groups": analyzed.get("groups", []),
                "modules_count": len(modules),
                "modules": [
                    {
                        "title": m.get("title", "Untitled Module"),
                        "description": (m.get("description") or "")[:300],
                        "items_count": len(m.get("items", [])),
                        "items_preview": [
                            {
                                "title": i.get("title", ""),
                                "type": i.get("type", "link"),
                                "url": i.get("url", ""),
                                "embed_url": i.get("embed_url", ""),
                                "file_type": i.get("file_type"),
                                "description": (i.get("description") or "")[:300],
                                "group_name": i.get("group_name"),
                            }
                            for i in m.get("items", [])
                        ],
                    }
                    for m in modules
                ],
                "assignments_count": len(analyzed.get("assignments", [])),
                "assignments": analyzed.get("assignments", [])[:20],
                "attendance_sessions_count": len(analyzed.get("attendance_sessions", [])),
                "total_items": sum(len(m.get("items", [])) for m in modules),
                "pages_scraped": len(scraped.get("pages", [])),
                "homepage_cards": scraped.get("homepage_cards", [])[:12],
                "warnings": analyzed.get("warnings", []),
                "extraction_stats": {
                    "embeds_found": scraped.get("total_embeds_found", 0),
                    "text_blocks": scraped.get("total_text_blocks", 0),
                    "images": scraped.get("total_images", 0),
                    "external_links": scraped.get("total_external_links", 0),
                },
            },
            "raw_data": analyzed,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to preview Google Site: {req.url}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze site: {type(e).__name__}: {str(e)}")


# ── Structure cache for speed ──
from pathlib import Path as _Path
_CACHE_DIR = _Path(__file__).resolve().parent.parent / "site_importer_learning" / "cache"


def _get_structure_hash(scraped: dict) -> str:
    """Hash the site's nav tree + resource URLs to detect if structure changed."""
    nav_urls = sorted(n.get("url", "") for n in scraped.get("navigation", []))
    resource_urls = sorted(
        r.get("url", "")
        for p in scraped.get("pages", [])
        for r in p.get("resources", [])
    )
    raw = "|".join(nav_urls) + "||" + "|".join(resource_urls)
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached_analysis(structure_hash: str) -> dict | None:
    """Check if we have a cached Gemini analysis for this site structure."""
    cache_file = _CACHE_DIR / f"{structure_hash}.json"
    if cache_file.exists():
        try:
            data = json_mod.loads(cache_file.read_text(encoding="utf-8"))
            logger.info(f"Cache HIT for structure {structure_hash}")
            return data
        except Exception:
            pass
    return None


def _save_analysis_cache(structure_hash: str, analyzed: dict):
    """Cache the Gemini analysis result for this site structure."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = _CACHE_DIR / f"{structure_hash}.json"
    try:
        cache_file.write_text(json_mod.dumps(analyzed, default=str, ensure_ascii=False), encoding="utf-8")
        logger.info(f"Cached analysis for structure {structure_hash}")
    except Exception as e:
        logger.warning(f"Failed to cache analysis: {e}")


@router.post("/google-site/preview-stream")
async def preview_google_site_stream(
    req: ImportPreviewRequest,
    user: dict = Depends(require_lecturer),
):
    """SSE streaming version of preview — sends real-time progress events."""
    if not req.url or "sites.google.com" not in req.url:
        raise HTTPException(status_code=400, detail="Please provide a valid Google Sites URL")

    async def event_stream():
        def sse(data: dict) -> str:
            return f"data: {json_mod.dumps(data, default=str)}\n\n"

        try:
            from ..site_importer.scraper import (
                scrape_google_site, get_learning_context, get_course_kb_context,
                extract_course_code_from_text, add_course_to_kb, lookup_course_code,
            )

            progress_queue: asyncio.Queue = asyncio.Queue()

            async def on_progress(evt: dict):
                await progress_queue.put(evt)

            # Start scraping in a task so we can stream progress
            scrape_task = asyncio.create_task(
                scrape_google_site(req.url, max_pages=req.max_pages, on_progress=on_progress)
            )

            # Stream scraping progress
            while not scrape_task.done():
                try:
                    evt = await asyncio.wait_for(progress_queue.get(), timeout=0.5)
                    yield sse({"type": "progress", **evt})
                except asyncio.TimeoutError:
                    pass

            # Drain remaining progress events
            while not progress_queue.empty():
                evt = progress_queue.get_nowait()
                yield sse({"type": "progress", **evt})

            scraped = scrape_task.result()
            pages = scraped.get("pages", [])
            if not pages:
                yield sse({"type": "error", "detail": "Could not fetch any pages from this URL"})
                return

            # Check structure cache
            structure_hash = _get_structure_hash(scraped)
            cached = _get_cached_analysis(structure_hash)

            if cached:
                yield sse({"type": "progress", "step": "analyze", "detail": "Using cached analysis (same site structure detected)", "cached": True})
                analyzed = cached
            else:
                yield sse({"type": "progress", "step": "analyze", "detail": "Sending to Gemini AI for analysis..."})

                # Build prompt context (same as _scrape_and_analyze)
                pages_text_parts = []
                all_resources = []
                for i, page in enumerate(pages):
                    page_section = f"\n{'='*60}\n"
                    page_section += f"PAGE {i+1}: {page.get('title', 'Untitled')}\n"
                    page_section += f"DO NOT use as item URL: {page.get('url', '')}\n"
                    page_section += f"Path: {page.get('path', '')}\n"
                    page_section += f"Breadcrumb: {' > '.join(page.get('breadcrumb', []))}\n"
                    text_blocks = page.get("text_blocks", [])
                    if text_blocks:
                        page_section += f"\nTEXT CONTENT ({len(text_blocks)} blocks):\n"
                        for tb in text_blocks:
                            page_section += f"  [{tb.get('tag', 'p')}] {tb.get('text', '')}\n"
                    body = page.get("body_text", "")
                    if body and not text_blocks:
                        page_section += f"\nBody Text:\n{body[:5000]}\n"
                    resources = page.get("resources", [])
                    if resources:
                        page_section += f"\nRESOURCES ({len(resources)} found):\n"
                        for res in resources:
                            rtype = res.get("type", "link")
                            title = res.get("title", "")
                            rurl = res.get("url", "")
                            embed = res.get("embed_url", "")
                            source = res.get("source", "")
                            line = f"  [{rtype}] {title} — {rurl}"
                            if embed and embed != rurl:
                                line += f" [EMBED: {embed}]"
                            if source:
                                line += f" ({source})"
                            if res.get("drive_id"):
                                line += f" (ID: {res['drive_id']})"
                            page_section += line + "\n"
                            all_resources.append({**res, "source_page": page.get("path", ""), "source_title": page.get("title", "")})
                    images = page.get("images", [])
                    if images:
                        linked_imgs = [img for img in images if img.get("link_href")]
                        if linked_imgs:
                            page_section += f"\nIMAGES WITH LINKS ({len(linked_imgs)}):\n"
                            for img in linked_imgs:
                                page_section += f"  Image '{img.get('alt', '')}' -> {img['link_href']}\n"
                    pages_text_parts.append(page_section)

                nav_items = scraped.get("navigation", [])
                nav_text = "\n".join(
                    f"{'  ' * n.get('level', 1)}[L{n.get('level', 1)}] {n.get('title', '')} -> {n.get('url', '')}"
                    for n in nav_items
                ) or "(no navigation extracted)"
                resources_text = "\n".join(
                    f"  [{r.get('type')}] {r.get('title', '')} — {r.get('url', '')} "
                    f"(from: {r.get('source_title', '')} | {r.get('source', '')})"
                    for r in all_resources
                ) or "(no resources found)"
                stats = (
                    f"{len(pages)} pages, "
                    f"{scraped.get('total_embeds_found', 0)} embeds, "
                    f"{scraped.get('total_text_blocks', 0)} text blocks, "
                    f"{scraped.get('total_images', 0)} images, "
                    f"{scraped.get('total_external_links', 0)} external links, "
                    f"{len(all_resources)} total resources"
                )
                learning_context = get_learning_context()
                course_kb_context = get_course_kb_context()
                pages_text = "\n".join(pages_text_parts)
                if len(pages_text) > 80000:
                    pages_text = pages_text[:80000] + "\n\n... (truncated)"

                prompt = SITE_ANALYSIS_PROMPT.format(
                    site_title=scraped.get("site_title", "Unknown"),
                    site_url=req.url,
                    page_count=len(pages),
                    pages_text=pages_text,
                    resources_text=resources_text[:10000],
                    nav_text=nav_text[:3000],
                    stats=stats,
                    learning_context=learning_context,
                    course_kb_context=course_kb_context,
                )

                yield sse({"type": "progress", "step": "analyze", "detail": f"Gemini analyzing {len(pages)} pages with {len(all_resources)} resources..."})

                try:
                    analyzed = await generate_json(prompt, temperature=0.2)
                except Exception as e:
                    yield sse({"type": "error", "detail": f"AI analysis failed: {str(e)}"})
                    return

                # Cache the result
                _save_analysis_cache(structure_hash, analyzed)

            # Post-process (same as _scrape_and_analyze)
            if "course" not in analyzed:
                analyzed["course"] = {
                    "course_name": scraped.get("site_title", "Imported Course"),
                    "course_code": "IMPORTED", "semester": "1",
                    "description": f"Imported from: {req.url}",
                }
            for key in ("groups", "modules", "assignments", "attendance_sessions", "warnings"):
                if key not in analyzed:
                    analyzed[key] = []

            course_info = analyzed["course"]
            gemini_code = course_info.get("course_code", "IMPORTED")
            kb_match = lookup_course_code(gemini_code) if gemini_code != "IMPORTED" else None
            if kb_match and kb_match["title"]:
                course_info["course_code"] = kb_match["code"]
                if not course_info.get("course_name") or course_info["course_name"] == "Imported Course":
                    course_info["course_name"] = kb_match["title"]
            elif gemini_code and gemini_code != "IMPORTED":
                site_text = f"{scraped.get('site_title', '')} {req.url}"
                fallback = extract_course_code_from_text(site_text)
                if fallback and fallback["title"]:
                    course_info["course_code"] = fallback["code"]
                    if not course_info.get("course_name") or course_info["course_name"] == "Imported Course":
                        course_info["course_name"] = fallback["title"]
                else:
                    course_name = course_info.get("course_name", "")
                    if course_name and course_name != "Imported Course":
                        add_course_to_kb(gemini_code, course_name)

            yield sse({"type": "progress", "step": "build", "detail": "Building course preview..."})

            # Build final result
            modules = analyzed.get("modules", [])
            final = {
                "ok": True,
                "preview": {
                    "course": analyzed["course"],
                    "groups": analyzed.get("groups", []),
                    "modules_count": len(modules),
                    "modules": [
                        {
                            "title": m.get("title", "Untitled Module"),
                            "description": (m.get("description") or "")[:300],
                            "items_count": len(m.get("items", [])),
                            "items_preview": [
                                {
                                    "title": i.get("title", ""),
                                    "type": i.get("type", "link"),
                                    "url": i.get("url", ""),
                                    "embed_url": i.get("embed_url", ""),
                                    "file_type": i.get("file_type"),
                                    "description": (i.get("description") or "")[:300],
                                    "group_name": i.get("group_name"),
                                }
                                for i in m.get("items", [])
                            ],
                        }
                        for m in modules
                    ],
                    "assignments_count": len(analyzed.get("assignments", [])),
                    "assignments": analyzed.get("assignments", [])[:20],
                    "attendance_sessions_count": len(analyzed.get("attendance_sessions", [])),
                    "total_items": sum(len(m.get("items", [])) for m in modules),
                    "pages_scraped": len(scraped.get("pages", [])),
                    "homepage_cards": scraped.get("homepage_cards", [])[:12],
                    "warnings": analyzed.get("warnings", []),
                    "extraction_stats": {
                        "embeds_found": scraped.get("total_embeds_found", 0),
                        "text_blocks": scraped.get("total_text_blocks", 0),
                        "images": scraped.get("total_images", 0),
                        "external_links": scraped.get("total_external_links", 0),
                    },
                },
                "raw_data": analyzed,
            }

            yield sse({"type": "complete", "result": final})

        except Exception as e:
            logger.exception(f"SSE preview failed: {req.url}")
            yield sse({"type": "error", "detail": str(e)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/google-site/execute")
async def execute_google_site_import(
    req: ImportRequest,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Scrape, analyze with AI, and import into MySmartStudy."""
    if not req.url or "sites.google.com" not in req.url:
        raise HTTPException(status_code=400, detail="Please provide a valid Google Sites URL")

    try:
        result = await _scrape_and_analyze(req.url, req.max_pages)
        analyzed = result["analyzed"]
        return await _create_from_analyzed(analyzed, req.url, user, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to import Google Site: {req.url}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/google-site/from-data")
async def import_from_preview_data(
    data: dict,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Import using previously analyzed data (from the preview step).

    If split_by_groups is true and groups exist, creates one course per group
    with only that group's items (plus shared/ungrouped items).
    """
    raw = data.get("raw_data")
    if not raw:
        raise HTTPException(status_code=400, detail="Missing raw_data from preview")

    split_by_groups = data.get("split_by_groups", False)
    selected_groups = data.get("selected_groups")  # optional list of group names

    try:
        groups = raw.get("groups", [])
        if split_by_groups and len(groups) > 0:
            return await _create_split_by_groups(raw, "preview", user, db, selected_groups)
        return await _create_from_analyzed(raw, "preview", user, db)
    except Exception as e:
        logger.exception("Import from preview data failed")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/google-site/feedback")
async def import_feedback(
    data: dict,
    user: dict = Depends(require_lecturer),
):
    """
    Accept feedback on an import to improve future extractions.
    The learning system uses this to adjust patterns.
    """
    from ..site_importer.scraper import _load_learned_patterns, _save_learned_patterns

    feedback_type = data.get("type", "")  # "missing_resource", "wrong_type", "new_pattern"
    url = data.get("url", "")
    correct_type = data.get("correct_type", "")

    patterns = _load_learned_patterns()

    if feedback_type == "new_pattern" and url and correct_type:
        # Learn a new URL pattern -> type mapping
        try:
            domain = urlparse(url).netloc
            if domain:
                patterns.setdefault("known_embed_types", {})[domain] = correct_type
                _save_learned_patterns(patterns)
                logger.info(f"Learned new pattern: {domain} -> {correct_type}")
                return {"ok": True, "message": f"Learned: {domain} = {correct_type}"}
        except Exception:
            pass

    return {"ok": True, "message": "Feedback recorded"}


@router.get("/course-kb")
async def get_course_knowledge_base(
    user: dict = Depends(require_lecturer),
):
    """Get the course knowledge base for viewing/searching."""
    from ..site_importer.scraper import _load_course_kb
    kb = _load_course_kb()
    return {
        "ok": True,
        "total_courses": len(kb.get("courses", {})),
        "courses": kb.get("courses", {}),
        "code_prefixes": kb.get("code_prefixes", {}),
        "last_updated": kb.get("last_updated", ""),
    }


@router.post("/course-kb/add")
async def add_course_to_knowledge_base(
    data: dict,
    user: dict = Depends(require_lecturer),
):
    """Add a new course code + title to the knowledge base."""
    from ..site_importer.scraper import add_course_to_kb, lookup_course_code

    code = data.get("code", "").strip().upper()
    title = data.get("title", "").strip()

    if not code or not title:
        raise HTTPException(status_code=400, detail="Both code and title are required")

    existing = lookup_course_code(code)
    if existing and existing["title"]:
        return {"ok": False, "message": f"Course {code} already exists: {existing['title']}"}

    added = add_course_to_kb(code, title)
    if added:
        return {"ok": True, "message": f"Added: {code} = {title}"}
    return {"ok": False, "message": "Course already exists"}


@router.get("/course-kb/lookup/{code}")
async def lookup_course(
    code: str,
    user: dict = Depends(require_lecturer),
):
    """Look up a course code in the knowledge base."""
    from ..site_importer.scraper import lookup_course_code
    result = lookup_course_code(code)
    if result and result["title"]:
        return {"ok": True, "found": True, **result}
    return {"ok": True, "found": False, "code": code.upper()}


async def _create_split_by_groups(
    analyzed: dict, source: str, user: dict, db,
    selected_groups: list[str] | None = None,
) -> dict:
    """Create separate courses for each group.

    Each course gets:
    - Items belonging to that group
    - Shared items (no group_name) are duplicated into every course
    - Assignments and attendance are duplicated into every course
    """
    groups = analyzed.get("groups", [])
    if selected_groups:
        groups = [g for g in groups if g.get("name") in selected_groups]

    if not groups:
        return await _create_from_analyzed(analyzed, source, user, db)

    course_data = analyzed["course"]
    base_name = course_data.get("course_name", "Imported Course")
    base_code = course_data.get("course_code", "IMPORTED")

    courses_created = []

    for group in groups:
        group_name = group.get("name", "")
        if not group_name:
            continue

        # Build a filtered copy of analyzed data for this group
        group_analyzed = {
            "course": {
                **course_data,
                "course_name": f"{base_name} ({group_name})",
                "description": f"{course_data.get('description', '')} — {group_name}".strip(" —"),
            },
            "groups": [],  # No sub-groups needed in split mode
            "modules": [],
            "assignments": analyzed.get("assignments", []),
            "attendance_sessions": analyzed.get("attendance_sessions", []),
            "warnings": [],
        }

        # Filter modules: include items for this group + shared items (no group_name)
        for mod in analyzed.get("modules", []):
            filtered_items = []
            for item in mod.get("items", []):
                item_group = item.get("group_name")
                if not item_group or item_group == group_name:
                    # Remove group_name from the item since it's now its own course
                    clean_item = {k: v for k, v in item.items() if k != "group_name"}
                    filtered_items.append(clean_item)

            if filtered_items:
                group_analyzed["modules"].append({
                    **{k: v for k, v in mod.items() if k != "items"},
                    "items": filtered_items,
                })

        result = await _create_from_analyzed(group_analyzed, source, user, db)
        courses_created.append(result)

    # Build combined response
    total_items = sum(r["summary"]["items_created"] for r in courses_created)
    total_modules = sum(r["summary"]["modules_created"] for r in courses_created)

    return {
        "ok": True,
        "course_id": courses_created[0]["course_id"] if courses_created else "",
        "join_code": courses_created[0]["join_code"] if courses_created else "",
        "split_courses": [
            {
                "course_id": r["course_id"],
                "join_code": r["join_code"],
                "course_name": r["summary"]["course_name"],
                "items_created": r["summary"]["items_created"],
                "modules_created": r["summary"]["modules_created"],
            }
            for r in courses_created
        ],
        "summary": {
            "course_name": base_name,
            "course_code": base_code,
            "groups_created": 0,
            "courses_created": len(courses_created),
            "modules_created": total_modules,
            "items_created": total_items,
            "assignments_created": courses_created[0]["summary"]["assignments_created"] if courses_created else 0,
            "attendance_sessions_created": courses_created[0]["summary"].get("attendance_sessions_created", 0) if courses_created else 0,
        },
        "warnings": analyzed.get("warnings", []),
    }


async def _create_from_analyzed(analyzed: dict, source: str, user: dict, db) -> dict:
    """Create course, groups, modules, items, assignments from analyzed data."""
    now = datetime.now(timezone.utc)
    course_data = analyzed["course"]

    # Create course
    course_id = models.gen_id()
    join_code = models.gen_code()

    db.collection(models.COURSES).document(course_id).set({
        "lecturerId": user["id"],
        "lecturerName": user.get("displayName", ""),
        "courseName": course_data.get("course_name", "Imported Course"),
        "courseCode": course_data.get("course_code", "IMPORTED"),
        "semester": course_data.get("semester", "1"),
        "description": course_data.get("description", ""),
        "joinCode": join_code,
        "enrolledStudents": [],
        "themeColor": "",
        "pattern": "",
        "createdAt": now,
        "importSource": source,
    })
    logger.info(f"Created course: {course_id}")

    # Create groups
    group_id_map: dict[str, str] = {}
    for group in analyzed.get("groups", []):
        gid = models.gen_id()
        name = group.get("name", "")
        if not name:
            continue
        group_id_map[name] = gid
        db.collection(models.COURSE_GROUPS).document(gid).set({
            "courseId": course_id,
            "name": name,
            "description": group.get("description", ""),
            "members": [],
            "createdAt": now,
        })

    # Create modules + items
    total_items = 0
    for mod in analyzed.get("modules", []):
        mid = models.gen_id()
        db.collection(models.COURSE_MODULES).document(mid).set({
            "courseId": course_id,
            "title": mod.get("title", "Imported Module"),
            "description": mod.get("description", ""),
            "order": mod.get("order", 0),
            "createdAt": now,
        })
        for item in mod.get("items", []):
            iid = models.gen_id()
            item_url = item.get("url", "")
            # Filter out Google Sites URLs
            if item_url and "sites.google.com" in item_url:
                item_url = ""

            embed_url = item.get("embed_url", "")
            if embed_url and "sites.google.com" in embed_url:
                embed_url = ""

            item_doc = {
                "moduleId": mid,
                "title": item.get("title", "Untitled"),
                "type": item.get("type", "link"),
                "url": item_url,
                "fileType": item.get("file_type"),
                "embedUrl": embed_url,
                "description": item.get("description", ""),
                "unlockDate": None,
                "createdAt": now,
            }
            gname = item.get("group_name")
            if gname and gname in group_id_map:
                item_doc["groupId"] = group_id_map[gname]
                item_doc["groupName"] = gname
            db.collection(models.MODULE_ITEMS).document(iid).set(item_doc)
            total_items += 1

    # Create assignments
    assignments_created = 0
    for asgn in analyzed.get("assignments", []):
        if asgn.get("type") == "rubric_attachment":
            continue
        aid = models.gen_id()
        db.collection(models.ASSIGNMENTS).document(aid).set({
            "lecturerId": user["id"],
            "courseId": course_id,
            "title": asgn.get("title", "Imported Assignment"),
            "description": asgn.get("description", ""),
            "deadline": "",
            "allowedMapTypes": [],
            "assignmentType": "assignment",
            "attachments": [{"name": asgn.get("title", ""), "url": asgn.get("url", ""), "type": "pdf"}] if asgn.get("url") else [],
            "createdAt": now,
        })
        assignments_created += 1

    # Create attendance sessions
    attendance_created = 0
    for session in analyzed.get("attendance_sessions", []):
        sid = models.gen_id()
        db.collection(models.ATTENDANCE).document(sid).set({
            "courseId": course_id,
            "title": session.get("title", "Attendance"),
            "date": now.isoformat(),
            "formUrl": session.get("form_url", ""),
            "createdAt": now,
        })
        attendance_created += 1

    audit_log(db, user["id"], "import", "course", course_id, f"Imported from Google Sites: {source}")

    return {
        "ok": True,
        "course_id": course_id,
        "join_code": join_code,
        "summary": {
            "course_name": course_data.get("course_name", ""),
            "course_code": course_data.get("course_code", ""),
            "groups_created": len(group_id_map),
            "modules_created": len(analyzed.get("modules", [])),
            "items_created": total_items,
            "assignments_created": assignments_created,
            "attendance_sessions_created": attendance_created,
        },
        "warnings": analyzed.get("warnings", []),
    }
