"""
Transformer — converts raw scraped Google Site data into MySmartStudy
course structure (course, modules, items, assignments, groups).
"""
import re
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


# ── Known cohort patterns (for Malaysian education sites) ──
COHORT_PATTERNS = [
    r"\bPK\s*1\b", r"\bPK\s*2\b", r"\bPK\s*3\b",
    r"\bPAKK\s*1\b", r"\bPAKK\s*2\b", r"\bPAKK\s*3\b",
    r"\bGroup\s*[A-Z0-9]+\b", r"\bKumpulan\s*[A-Z0-9]+\b",
    r"\bSection\s*[A-Z0-9]+\b", r"\bCohort\s*[A-Z0-9]+\b",
]


def transform_site_data(scraped: dict) -> dict:
    """
    Transform raw scraped site data into MySmartStudy import payload.

    Returns:
    {
        "course": { course fields },
        "groups": [ { name, description } ],
        "modules": [
            {
                "title": ...,
                "description": ...,
                "order": ...,
                "items": [
                    { "title", "type", "url", "file_type", "group_name" }
                ]
            }
        ],
        "assignments": [ { title, description, ... } ],
        "attendance_sessions": [ { title, date } ],
        "warnings": [ ... ]
    }
    """
    result = {
        "course": {},
        "groups": [],
        "modules": [],
        "assignments": [],
        "attendance_sessions": [],
        "warnings": [],
    }

    pages = scraped.get("pages", [])
    nav = scraped.get("navigation", [])
    homepage_cards = scraped.get("homepage_cards", [])

    # ── 1. Extract course info ──
    result["course"] = _extract_course_info(scraped)

    # ── 2. Detect cohort groups ──
    groups = _detect_groups(pages, nav)
    result["groups"] = [{"name": g, "description": ""} for g in groups]

    # ── 3. Build module structure ──
    modules = _build_modules(pages, nav, groups)
    result["modules"] = modules

    # ── 4. Extract assignments ──
    assignments = _extract_assignments(pages)
    result["assignments"] = assignments

    # ── 5. Extract attendance sessions ──
    attendance = _extract_attendance(pages)
    result["attendance_sessions"] = attendance

    return result


def _extract_course_info(scraped: dict) -> dict:
    """Extract course name, code, semester from site data."""
    title = scraped.get("site_title", "")
    url = scraped.get("site_url", "")

    # Try to extract course code from URL or title
    code_match = re.search(r"[A-Z]{3,5}\s*\d{4}", title)
    if not code_match:
        code_match = re.search(r"[a-z]{3,5}[-_]?\d{4}", url, re.IGNORECASE)

    course_code = code_match.group(0).upper().replace("-", "").replace("_", "") if code_match else "IMPORTED"

    # Try to extract semester
    sem_match = re.search(r"[Ss]emester\s*(\w+)", title)
    semester = sem_match.group(1) if sem_match else "1"

    # Clean up title for course name
    course_name = title
    # Remove long institutional suffixes
    for cut in ["PISMP", "IPG", "Institut", "Program"]:
        idx = course_name.upper().find(cut)
        if idx > 10:
            course_name = course_name[:idx].strip(" -–—")

    if not course_name or len(course_name) < 3:
        course_name = title[:100] if title else f"Imported Course ({course_code})"

    return {
        "course_name": course_name.strip(),
        "course_code": course_code,
        "semester": semester,
        "description": f"Imported from Google Sites: {url}",
    }


def _detect_groups(pages: list[dict], nav: list[dict]) -> list[str]:
    """Detect cohort/group names from page paths and navigation."""
    group_names: set[str] = set()

    # Scan page paths and titles
    all_text = []
    for p in pages:
        all_text.append(p.get("path", ""))
        all_text.append(p.get("title", ""))
        for bc in p.get("breadcrumb", []):
            all_text.append(bc)

    # Scan nav
    def scan_nav(items):
        for item in items:
            all_text.append(item.get("title", ""))
            scan_nav(item.get("children", []))
    scan_nav(nav)

    combined = " ".join(all_text)

    for pattern in COHORT_PATTERNS:
        matches = re.findall(pattern, combined, re.IGNORECASE)
        for m in matches:
            # Normalize: "PK 1" -> "PK 1", "pk-1" -> "PK 1"
            normalized = re.sub(r"[-_]", " ", m).upper().strip()
            normalized = re.sub(r"\s+", " ", normalized)
            group_names.add(normalized)

    return sorted(group_names)


def _identify_page_group(page: dict, groups: list[str]) -> Optional[str]:
    """Check if a page belongs to a specific cohort group."""
    path = page.get("path", "").lower()
    breadcrumb = " ".join(page.get("breadcrumb", [])).lower()
    title = page.get("title", "").lower()
    search_text = f"{path} {breadcrumb} {title}"

    for group in groups:
        # e.g. "PK 1" -> matches "pk-1", "pk 1", "pk1"
        pattern = group.replace(" ", r"[-_ ]?")
        if re.search(pattern, search_text, re.IGNORECASE):
            return group
    return None


def _identify_module_name(page: dict) -> Optional[str]:
    """Determine which module a page belongs to (e.g. 'Pembelajaran Bermakna 1')."""
    path = page.get("path", "").lower()
    breadcrumb = page.get("breadcrumb", [])

    # Check for "pembelajaran-bermakna-N" in path
    m = re.search(r"pembelajaran[-_ ]bermakna[-_ ](\d+)", path)
    if m:
        return f"Pembelajaran Bermakna {m.group(1)}"

    # Check breadcrumb
    for bc in breadcrumb:
        m = re.search(r"Pembelajaran\s+Bermakna\s+(\d+)", bc, re.IGNORECASE)
        if m:
            return f"Pembelajaran Bermakna {m.group(1)}"

    # Check for known section patterns
    for keyword, module in [
        ("pentaksiran", "Pentaksiran Berterusan"),
        ("assessment", "Pentaksiran Berterusan"),
        ("refleksi", "Refleksi"),
        ("reflection", "Refleksi"),
        ("maklumat-pelajar", "Maklumat Pelajar & Kehadiran"),
        ("kehadiran", "Maklumat Pelajar & Kehadiran"),
        ("attendance", "Maklumat Pelajar & Kehadiran"),
        ("mk-rancangan", "Maklumat Kursus"),
        ("hpk", "Maklumat Kursus"),
        ("merungkai", "Maklumat Kursus"),
        ("metadata", "Metadata"),
    ]:
        if keyword in path:
            return module

    return None


def _extract_topic_number(page: dict) -> Optional[int]:
    """Extract topic number from a page path/title."""
    path = page.get("path", "")
    title = page.get("title", "")
    search = f"{path} {title}"
    m = re.search(r"[Tt]opik[-_ ]?(\d+)", search)
    if m:
        return int(m.group(1))
    m = re.search(r"[Tt]opic[-_ ]?(\d+)", search)
    if m:
        return int(m.group(1))
    return None


def _build_modules(pages: list[dict], nav: list[dict], groups: list[str]) -> list[dict]:
    """Build module hierarchy from pages."""
    modules_map: dict[str, dict] = {}  # module_name -> module dict
    module_order = 0

    # Pre-define known module ordering
    known_order = {
        "Maklumat Kursus": 0,
        "Pembelajaran Bermakna 1": 1,
        "Pembelajaran Bermakna 2": 2,
        "Pembelajaran Bermakna 3": 3,
        "Pentaksiran Berterusan": 4,
        "Refleksi": 5,
        "Maklumat Pelajar & Kehadiran": 6,
        "Metadata": 7,
    }

    for page in pages:
        module_name = _identify_module_name(page)
        if not module_name:
            continue

        group_name = _identify_page_group(page, groups)
        topic_num = _extract_topic_number(page)

        # Create module if new
        if module_name not in modules_map:
            order = known_order.get(module_name, 10 + module_order)
            module_order += 1
            modules_map[module_name] = {
                "title": module_name,
                "description": "",
                "order": order,
                "items": [],
            }

        module = modules_map[module_name]

        # Build item title
        if topic_num is not None:
            item_title = page.get("title", "") or f"Topik {topic_num}"
        else:
            item_title = page.get("title", "") or page.get("path", "").split("/")[-1]

        # Add module description from page if it's the landing page
        if topic_num is None and page.get("body_text"):
            body_preview = page["body_text"][:500]
            if len(module["description"]) < len(body_preview):
                module["description"] = body_preview

        # Add resources as module items
        for res in page.get("resources", []):
            item_type = _map_resource_type(res.get("type", ""))
            item = {
                "title": res.get("title") or item_title,
                "type": item_type,
                "url": res.get("url", ""),
                "file_type": _map_file_type(res.get("type", "")),
                "group_name": group_name,
                "source_page": page.get("path", ""),
                "drive_id": res.get("drive_id", ""),
                "topic_number": topic_num,
            }
            module["items"].append(item)

        # If page has no resources but has body content, add it as a content item
        if not page.get("resources") and page.get("body_text") and topic_num is not None:
            module["items"].append({
                "title": item_title,
                "type": "content",
                "url": page.get("url", ""),
                "file_type": "html",
                "group_name": group_name,
                "source_page": page.get("path", ""),
                "drive_id": "",
                "topic_number": topic_num,
                "body_html": page.get("body_html", ""),
            })

    # Sort modules and items
    modules = sorted(modules_map.values(), key=lambda m: m["order"])
    for mod in modules:
        mod["items"].sort(key=lambda i: (i.get("topic_number") or 999, i.get("title", "")))

    return modules


def _extract_assignments(pages: list[dict]) -> list[dict]:
    """Extract assignments from assessment-related pages."""
    assignments = []

    for page in pages:
        path = page.get("path", "").lower()
        if "pentaksiran" not in path and "assessment" not in path:
            continue

        # Look for PDF resources that are rubrics or task sheets
        for res in page.get("resources", []):
            title = res.get("title", "").lower()
            url = res.get("url", "")

            if "rubrik" in title or "rubric" in title:
                assignments.append({
                    "type": "rubric_attachment",
                    "title": res.get("title", "Assessment Rubric"),
                    "url": url,
                    "drive_id": res.get("drive_id", ""),
                })
            elif "pb " in title or "pentaksiran" in title or "assessment" in title:
                assignments.append({
                    "type": "assignment",
                    "title": res.get("title", "Continuous Assessment"),
                    "description": f"Imported from: {page.get('url', '')}",
                    "url": url,
                    "drive_id": res.get("drive_id", ""),
                })

    return assignments


def _extract_attendance(pages: list[dict]) -> list[dict]:
    """Extract attendance sessions from Google Forms found on attendance pages."""
    sessions = []

    for page in pages:
        path = page.get("path", "").lower()
        if "kehadiran" not in path and "attendance" not in path and "maklumat" not in path:
            continue

        for res in page.get("resources", []):
            if res.get("type") == "google_form":
                sessions.append({
                    "title": res.get("title", "Attendance"),
                    "form_url": res.get("url", ""),
                    "source_page": page.get("path", ""),
                })

    return sessions


def _map_resource_type(res_type: str) -> str:
    """Map scraped resource type to ModuleItem type."""
    mapping = {
        "google_slides": "slides",
        "google_doc": "document",
        "google_sheets": "spreadsheet",
        "google_form": "form",
        "google_drive": "link",
        "pdf": "pdf",
        "youtube": "video",
        "padlet": "link",
        "canva": "link",
        "embed": "link",
        "image": "image",
        "link": "link",
    }
    return mapping.get(res_type, "link")


def _map_file_type(res_type: str) -> Optional[str]:
    """Map scraped resource type to ModuleItem file_type."""
    mapping = {
        "google_slides": "slides",
        "google_doc": "document",
        "google_sheets": "spreadsheet",
        "google_form": "form",
        "pdf": "pdf",
        "youtube": "video",
        "padlet": "link",
        "canva": "link",
    }
    return mapping.get(res_type)
