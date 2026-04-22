"""
Google Sites Scraper v3 — Purpose-built for Google Sites (new) HTML structure.

Uses data-url/data-level attributes for navigation, data-code/jsname for embeds,
CDt4Ke class for text content, and CENy8b class for images.

Extracts EVERYTHING: navigation tree, text, embeds (Canva, Padlet, YouTube,
Google Docs/Slides/Forms/Sheets/Drive), images with links, external URLs.
"""
import re
import html as html_lib
import json
import logging
import os
from datetime import datetime
from urllib.parse import urlparse, unquote, urljoin
from typing import Optional
from pathlib import Path
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
})

# ── Learning system paths ──
_LEARNING_DIR = Path(__file__).resolve().parent.parent / "site_importer_learning"
_PATTERNS_FILE = _LEARNING_DIR / "patterns.json"
_HISTORY_FILE = _LEARNING_DIR / "import_history.json"
_COURSE_KB_FILE = _LEARNING_DIR / "course_knowledge_base.json"


def _load_learned_patterns() -> dict:
    """Load previously learned extraction patterns."""
    if _PATTERNS_FILE.exists():
        try:
            return json.loads(_PATTERNS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "embed_selectors": [
            {"attr": "jsname", "value": "jkaScf", "note": "Google Sites embed wrapper"},
        ],
        "text_classes": ["CDt4Ke"],
        "image_classes": ["CENy8b"],
        "nav_attrs": ["data-url"],
        "known_embed_types": {
            "canva.com": "canva",
            "padlet.com": "padlet",
            "docs.google.com/presentation": "google_slides",
            "docs.google.com/document": "google_doc",
            "docs.google.com/spreadsheets": "google_sheets",
            "docs.google.com/forms": "google_form",
            "drive.google.com/file": "drive_file",
            "drive.google.com/drive/folders": "drive_folder",
            "youtube.com": "youtube",
            "youtu.be": "youtube",
            "kahoot.it": "kahoot",
            "kahoot.com": "kahoot",
            "quizizz.com": "quizizz",
            "mentimeter.com": "mentimeter",
            "flipgrid.com": "flipgrid",
            "flip.com": "flipgrid",
            "jamboard.google.com": "jamboard",
        },
        "site_patterns": {},
        "total_imports": 0,
    }


def _save_learned_patterns(patterns: dict):
    """Persist learned patterns for future imports."""
    _LEARNING_DIR.mkdir(parents=True, exist_ok=True)
    _PATTERNS_FILE.write_text(json.dumps(patterns, indent=2, ensure_ascii=False), encoding="utf-8")


def _save_import_history(site_url: str, stats: dict):
    """Record import stats for learning."""
    _LEARNING_DIR.mkdir(parents=True, exist_ok=True)
    history = []
    if _HISTORY_FILE.exists():
        try:
            history = json.loads(_HISTORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    history.append({"url": site_url, "stats": stats})
    # Keep last 50 imports
    if len(history) > 50:
        history = history[-50:]
    _HISTORY_FILE.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Fetch helper ──

def _fetch_page(url: str, timeout: int = 15) -> Optional[BeautifulSoup]:
    """Fetch a URL and return parsed soup, or None on failure."""
    try:
        resp = _SESSION.get(url, timeout=timeout)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


# ── URL helpers ──

def _unwrap_google_redirect(href: str) -> str:
    """Unwrap google.com/url?q=... redirect URLs."""
    if "google.com/url?" in href:
        m = re.search(r"[?&]q=([^&]+)", href)
        if m:
            return unquote(m.group(1))
    return href


def _detect_drive_file_type(url: str) -> str:
    """Try a HEAD request on the Drive file to detect its MIME type.
    Falls back to 'drive_file' if we can't determine it."""
    drive_id = _extract_drive_file_id(url)
    if not drive_id:
        return "drive_file"
    try:
        import requests
        resp = requests.head(
            f"https://drive.google.com/uc?export=download&id={drive_id}",
            allow_redirects=True,
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        ctype = resp.headers.get("Content-Type", "").lower()
        if "pdf" in ctype:
            return "pdf"
        if "video" in ctype:
            return "video"
        if "image" in ctype:
            return "image"
        if "presentation" in ctype or "powerpoint" in ctype:
            return "slides"
        if "spreadsheet" in ctype or "excel" in ctype:
            return "spreadsheet"
        if "document" in ctype or "msword" in ctype:
            return "document"
        if "audio" in ctype:
            return "video"
    except Exception:
        pass
    return "drive_file"


def _classify_url(url: str, known_types: dict | None = None) -> Optional[dict]:
    """Classify a URL into a typed resource dict using known patterns."""
    if not url or not url.startswith("http"):
        return None
    url_lower = url.lower()

    # Check known patterns first (including learned ones)
    if known_types:
        for pattern, rtype in known_types.items():
            if pattern in url_lower:
                return {"type": rtype, "url": url, "drive_id": _extract_any_id(url)}

    # Built-in classification
    if "docs.google.com/presentation" in url_lower:
        return {"type": "google_slides", "url": url, "drive_id": _extract_google_id(url)}
    if "docs.google.com/document" in url_lower:
        return {"type": "google_doc", "url": url, "drive_id": _extract_google_id(url)}
    if "docs.google.com/spreadsheets" in url_lower:
        return {"type": "google_sheets", "url": url, "drive_id": _extract_google_id(url)}
    if "docs.google.com/forms" in url_lower:
        return {"type": "google_form", "url": url, "drive_id": _extract_google_id(url)}
    if "drive.google.com/file" in url_lower:
        return {"type": _detect_drive_file_type(url), "url": url, "drive_id": _extract_drive_file_id(url)}
    if "drive.google.com/drive/folders" in url_lower:
        return {"type": "drive_folder", "url": url, "drive_id": _extract_google_id(url)}
    if "drive.google.com" in url_lower:
        return {"type": "google_drive", "url": url, "drive_id": _extract_drive_file_id(url) or _extract_google_id(url)}
    if "youtube.com/embed" in url_lower or "youtube.com/watch" in url_lower or "youtu.be" in url_lower:
        return {"type": "youtube", "url": url, "drive_id": _extract_youtube_id(url)}
    if "padlet.com" in url_lower:
        return {"type": "padlet", "url": url}
    if "canva.com" in url_lower:
        return {"type": "canva", "url": url}
    if "kahoot" in url_lower:
        return {"type": "kahoot", "url": url}
    if "quizizz.com" in url_lower:
        return {"type": "quizizz", "url": url}
    if "mentimeter.com" in url_lower:
        return {"type": "mentimeter", "url": url}
    if url_lower.endswith(".pdf"):
        return {"type": "pdf", "url": url}

    return None


def _make_embed_url(res: dict) -> str:
    """Generate an embeddable iframe URL for known resource types."""
    rtype = res.get("type", "")
    url = res.get("url", "")
    drive_id = res.get("drive_id", "")

    if rtype == "google_slides" and drive_id:
        return f"https://docs.google.com/presentation/d/{drive_id}/embed?start=false&loop=false"
    if rtype == "google_doc" and drive_id:
        return f"https://docs.google.com/document/d/{drive_id}/pub?embedded=true"
    if rtype == "google_sheets" and drive_id:
        return f"https://docs.google.com/spreadsheets/d/{drive_id}/pubhtml?widget=true"
    if rtype == "google_form" and drive_id:
        return f"https://docs.google.com/forms/d/{drive_id}/viewform?embedded=true"
    if rtype in ("drive_file", "google_drive") and drive_id:
        return f"https://drive.google.com/file/d/{drive_id}/preview"
    if drive_id and "drive.google.com" in url:
        return f"https://drive.google.com/file/d/{drive_id}/preview"
    if rtype == "youtube":
        yt_id = res.get("drive_id", "")
        if yt_id:
            return f"https://www.youtube.com/embed/{yt_id}"
    if rtype == "canva" and "/view" in url:
        return url  # Canva embed URLs work as-is
    if rtype == "padlet":
        return url  # Padlet URLs can be embedded

    return ""


def _extract_google_id(url: str) -> str:
    m = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
    if m: return m.group(1)
    m = re.search(r"/e/([a-zA-Z0-9_-]+)", url)
    if m: return m.group(1)
    return ""


def _extract_drive_file_id(url: str) -> str:
    m = re.search(r"/file/d/([a-zA-Z0-9_-]+)", url)
    return m.group(1) if m else ""


def _extract_youtube_id(url: str) -> str:
    m = re.search(r"(?:embed/|v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
    return m.group(1) if m else ""


def _extract_any_id(url: str) -> str:
    """Try to extract a Google resource ID from any URL."""
    return _extract_drive_file_id(url) or _extract_google_id(url) or _extract_youtube_id(url) or ""


def _normalize_url_for_dedup(url: str) -> str:
    """
    Normalize URL for deduplication. Same Canva design = same resource,
    regardless of embed vs utm_content query params.
    """
    # Canva: extract design ID to deduplicate
    m = re.search(r"canva\.com/design/([a-zA-Z0-9_-]+)", url)
    if m:
        return f"canva:{m.group(1)}"
    # Google resources: use the doc/file ID
    gid = _extract_any_id(url)
    if gid:
        return f"gid:{gid}"
    # YouTube: use video ID
    ytid = _extract_youtube_id(url)
    if ytid:
        return f"yt:{ytid}"
    # Default: strip query params
    return url.split("?")[0].split("#")[0].rstrip("/")


# ── Google Sites-specific extractors ──

def _extract_navigation_tree(soup: BeautifulSoup) -> list[dict]:
    """
    Extract the full navigation tree from data-url + data-level attributes.
    This gives us ALL pages in the site from a single page fetch.
    """
    nav_items = []
    for el in soup.find_all(attrs={"data-url": True}):
        url = el["data-url"]
        level = int(el.get("data-level", "1"))
        text = el.get_text(strip=True)
        nav_type = el.get("data-navtype", "1")
        # Skip metadata pages
        if nav_type == "4" or "metadata" in url.lower():
            continue
        nav_items.append({
            "url": url,
            "level": level,
            "title": text,
            "full_url": f"https://sites.google.com{url}",
        })
    return nav_items


def _extract_embeds(soup: BeautifulSoup, known_types: dict | None = None) -> list[dict]:
    """
    Extract ALL embedded content from Google Sites jsname="jkaScf" wrappers.

    Two types:
    - jscontroller="szRU7e": Custom HTML embed — actual content in data-code (HTML-encoded)
    - jscontroller="N0NZx": Whole-page embed — URL in data-url, description in aria-label

    Deduplicates using normalized keys (same Canva design ID = one resource).
    """
    embeds = []
    seen_keys = set()  # normalized dedup keys

    for el in soup.find_all(attrs={"jsname": "jkaScf"}):
        controller = el.get("jscontroller", "")
        data_url = el.get("data-url", "")
        data_code = el.get("data-code", "")
        label = el.get("aria-label", "")

        if controller == "N0NZx" and data_url:
            # Whole-page embed (Padlet, etc.)
            key = _normalize_url_for_dedup(data_url)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            res = _classify_url(data_url, known_types) or {"type": "link", "url": data_url}
            res["title"] = label.replace("Whole page embed, ", "").strip() if label else ""
            res["embed_url"] = _make_embed_url(res) or data_url
            res["source"] = "whole_page_embed"
            embeds.append(res)

        elif controller == "szRU7e" and data_code:
            # Custom HTML embed — decode and extract iframe src URLs
            decoded = html_lib.unescape(data_code)

            # Extract iframe src attributes
            iframe_srcs = re.findall(r'src=["\']([^"\'>\s]+)["\']', decoded)
            for src in iframe_srcs:
                key = _normalize_url_for_dedup(src)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                res = _classify_url(src, known_types) or {"type": "link", "url": src}
                # For Canva, prefer the embed URL variant
                if res.get("type") == "canva" and "?embed" not in src:
                    # Replace with embed version if this is the view URL
                    embed_src = re.sub(r'\?.*', '?embed', src)
                    res["url"] = src
                    res["embed_url"] = embed_src
                else:
                    res["embed_url"] = _make_embed_url(res) or src
                res["source"] = "custom_html_embed"
                embeds.append(res)

            # Also extract any URLs from the HTML that aren't in iframes
            all_urls = re.findall(r'https?://[^\s"\'<>\\)]+', decoded)
            for url in all_urls:
                clean_url = url.rstrip(",.")
                key = _normalize_url_for_dedup(clean_url)
                if key in seen_keys:
                    continue
                # Skip Google's embed wrapper URLs
                if "atari-embeds.googleusercontent.com" in clean_url:
                    continue
                if _classify_url(clean_url, known_types):
                    seen_keys.add(key)
                    res = _classify_url(clean_url, known_types)
                    if res:
                        res["embed_url"] = _make_embed_url(res) or clean_url
                        res["source"] = "custom_html_url"
                        embeds.append(res)

    return embeds


def _extract_text_content(soup: BeautifulSoup) -> list[dict]:
    """
    Extract ALL text from CDt4Ke elements (Google Sites text blocks).
    Returns structured text with tag type.
    """
    texts = []
    seen = set()

    for el in soup.find_all(class_="CDt4Ke"):
        text = el.get_text(strip=True)
        if not text or len(text) < 2 or text in seen:
            continue
        seen.add(text)

        # Determine heading level
        tag = el.name  # h1, h2, h3, p, etc.
        texts.append({"tag": tag, "text": text})

    return texts


def _extract_images(soup: BeautifulSoup) -> list[dict]:
    """Extract images from CENy8b class elements, including their link wrappers."""
    images = []
    for img in soup.find_all(class_="CENy8b"):
        src = img.get("src", "")
        if not src:
            continue
        alt = img.get("alt", "")
        # Check if image is wrapped in a link
        parent_a = img.find_parent("a")
        link_href = ""
        if parent_a and parent_a.get("href"):
            link_href = _unwrap_google_redirect(parent_a["href"])
        images.append({"src": src, "alt": alt, "link_href": link_href})
    return images


def _extract_external_links(soup: BeautifulSoup, site_prefix: str, known_types: dict | None = None) -> list[dict]:
    """Extract ALL external links from the page (not internal Google Sites links)."""
    links = []
    seen_keys = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Resolve relative
        if href.startswith("/"):
            href = f"https://sites.google.com{href}"
        href = _unwrap_google_redirect(href)

        if not href.startswith("http"):
            continue
        # Skip internal site links
        if site_prefix in href or "sites.google.com" in href:
            continue
        # Skip Google redirect pages
        if "google.com/url" in href:
            continue

        key = _normalize_url_for_dedup(href)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        text = a.get_text(strip=True)
        res = _classify_url(href, known_types)
        if res:
            res["title"] = text or res.get("title", "")
            res["embed_url"] = _make_embed_url(res)
            links.append(res)
        else:
            links.append({"type": "link", "url": href, "title": text or href})

    return links


# ── Main scraper ──

async def scrape_google_site(site_url: str, max_pages: int = 80, on_progress=None) -> dict:
    """
    Scrape a Google Site using Google Sites DOM knowledge.

    1. Fetch any page to get the FULL navigation tree (data-url + data-level)
    2. Visit each page and extract: text, embeds, images, external links
    3. Learn from each import to improve future extractions

    on_progress: optional async callback(event_dict) for streaming progress
    """
    patterns = _load_learned_patterns()
    known_types = patterns.get("known_embed_types", {})

    parsed = urlparse(site_url)
    # Build site prefix for filtering internal links
    path_parts = parsed.path.rstrip("/").split("/")
    site_prefix = "/".join(path_parts[:4]) if len(path_parts) >= 4 else parsed.path.rstrip("/")

    result = {
        "site_url": site_url,
        "site_title": "",
        "navigation": [],
        "pages": [],
        "homepage_cards": [],
        "total_embeds_found": 0,
        "total_text_blocks": 0,
        "total_images": 0,
        "total_external_links": 0,
    }

    async def _emit(evt: dict):
        if on_progress:
            try:
                await on_progress(evt)
            except Exception:
                pass

    # Step 1: Fetch the first page to get nav tree + site title
    logger.info(f"Fetching site root: {site_url}")
    await _emit({"step": "fetch", "detail": "Connecting to Google Sites..."})
    root_soup = _fetch_page(site_url)
    if not root_soup:
        return result

    # Extract site title
    title_el = root_soup.find("title")
    if title_el:
        result["site_title"] = title_el.get_text(strip=True)
    h1 = root_soup.find("h1")
    if h1:
        h1_text = h1.get_text(strip=True)
        if h1_text and len(h1_text) < 200:
            result["site_title"] = h1_text

    # Extract FULL navigation tree from data-url attributes
    nav_tree = _extract_navigation_tree(root_soup)
    result["navigation"] = [
        {"title": n["title"], "url": n["full_url"], "level": n["level"]}
        for n in nav_tree
    ]
    logger.info(f"Found {len(nav_tree)} pages in navigation tree")
    await _emit({"step": "fetch", "detail": f"Found {len(nav_tree)} pages in site", "pages_found": len(nav_tree), "site_title": result["site_title"]})

    # Build list of all pages to visit
    visited: set[str] = set()
    pages_to_visit = [site_url]

    # Add all nav tree URLs
    for nav in nav_tree:
        full_url = nav["full_url"]
        if full_url not in pages_to_visit:
            pages_to_visit.append(full_url)

    # Step 2: Visit each page
    pages_crawled = 0
    for url in pages_to_visit:
        if pages_crawled >= max_pages:
            break

        normalised = url.split("?")[0].split("#")[0].rstrip("/")
        if normalised in visited:
            continue
        visited.add(normalised)

        total_to_scrape = min(len(pages_to_visit), max_pages)
        page_slug = unquote(url.split("/")[-1]) or "home"
        logger.info(f"Scraping ({pages_crawled + 1}/{total_to_scrape}): {url}")
        await _emit({
            "step": "extract",
            "detail": f"Scraping page {pages_crawled + 1}/{total_to_scrape}: {page_slug}",
            "page_current": pages_crawled + 1,
            "page_total": total_to_scrape,
            "embeds_so_far": result["total_embeds_found"],
            "text_blocks_so_far": result["total_text_blocks"],
            "resources_so_far": sum(len(p.get("resources", [])) for p in result["pages"]),
        })

        # Use root_soup for first page, fetch others
        if pages_crawled == 0 and root_soup:
            soup = root_soup
        else:
            soup = _fetch_page(url)
            if not soup:
                continue

        page_path = urlparse(url).path

        # Find nav item for this page to get title
        page_title = ""
        for nav in nav_tree:
            if nav["full_url"].rstrip("/") == normalised:
                page_title = nav["title"]
                break
        if not page_title:
            h1_el = soup.find("h1")
            if h1_el:
                page_title = h1_el.get_text(strip=True)
            if not page_title:
                t = soup.find("title")
                if t:
                    page_title = t.get_text(strip=True)

        # Build breadcrumb from path
        breadcrumb = [p for p in page_path.split("/") if p and p not in ("sites",)]

        # Extract ALL content from this page
        text_blocks = _extract_text_content(soup)
        embeds = _extract_embeds(soup, known_types)
        images = _extract_images(soup)
        external_links = _extract_external_links(soup, site_prefix, known_types)

        # Combine body text
        body_text = "\n".join(
            f"[{t['tag']}] {t['text']}" for t in text_blocks
        )

        # Build resources list (embeds + external links, deduplicated)
        resources = []
        seen_resource_urls = set()

        for embed in embeds:
            eurl = embed.get("url", "")
            if eurl and eurl not in seen_resource_urls:
                seen_resource_urls.add(eurl)
                resources.append(embed)

        for link in external_links:
            lurl = link.get("url", "")
            if lurl and lurl not in seen_resource_urls:
                seen_resource_urls.add(lurl)
                resources.append(link)

        # Also check images that link to external resources
        for img in images:
            link_href = img.get("link_href", "")
            if link_href and link_href.startswith("http") and link_href not in seen_resource_urls:
                if "sites.google.com" not in link_href:
                    seen_resource_urls.add(link_href)
                    res = _classify_url(link_href, known_types) or {"type": "link", "url": link_href}
                    res["title"] = img.get("alt", "") or "Image link"
                    res["embed_url"] = _make_embed_url(res) if _classify_url(link_href, known_types) else ""
                    res["source"] = "image_link"
                    resources.append(res)

        page_data = {
            "url": url,
            "path": page_path,
            "title": page_title,
            "breadcrumb": breadcrumb,
            "body_text": body_text,
            "text_blocks": text_blocks,
            "resources": resources,
            "images": images,
            "external_links": external_links,
        }

        result["pages"].append(page_data)
        result["total_embeds_found"] += len(embeds)
        result["total_text_blocks"] += len(text_blocks)
        result["total_images"] += len(images)
        result["total_external_links"] += len(external_links)

        # Homepage cards (images inside links on first page)
        if pages_crawled == 0:
            for img in images:
                if img.get("link_href"):
                    result["homepage_cards"].append({
                        "title": img.get("alt", ""),
                        "image_url": img["src"],
                        "link": img["link_href"],
                    })

        pages_crawled += 1

    total_resources = sum(len(p.get("resources", [])) for p in result["pages"])
    await _emit({
        "step": "extract_done",
        "detail": f"Extracted {total_resources} resources from {pages_crawled} pages",
        "pages_crawled": pages_crawled,
        "total_embeds": result["total_embeds_found"],
        "total_text_blocks": result["total_text_blocks"],
        "total_resources": total_resources,
    })

    # Step 3: Learn from this scrape
    stats = {
        "pages_crawled": pages_crawled,
        "total_embeds": result["total_embeds_found"],
        "total_text_blocks": result["total_text_blocks"],
        "total_images": result["total_images"],
        "total_external_links": result["total_external_links"],
        "total_resources": sum(len(p.get("resources", [])) for p in result["pages"]),
    }

    # Discover new embed URL patterns from this import
    new_patterns_found = 0
    for page in result["pages"]:
        for res in page.get("resources", []):
            url = res.get("url", "")
            if url and res.get("type") == "link":
                # Try to learn the domain pattern
                try:
                    domain = urlparse(url).netloc
                    if domain and domain not in known_types:
                        # Store as a potential pattern for future imports
                        site_patterns = patterns.setdefault("site_patterns", {})
                        domain_count = site_patterns.get(domain, 0) + 1
                        site_patterns[domain] = domain_count
                        new_patterns_found += 1
                except Exception:
                    pass

    patterns["total_imports"] = patterns.get("total_imports", 0) + 1
    _save_learned_patterns(patterns)
    _save_import_history(site_url, stats)

    if new_patterns_found > 0:
        logger.info(f"Learned {new_patterns_found} new URL patterns from this import")

    logger.info(
        f"Scraped {pages_crawled} pages: "
        f"{result['total_embeds_found']} embeds, "
        f"{result['total_text_blocks']} text blocks, "
        f"{result['total_images']} images, "
        f"{result['total_external_links']} ext links"
    )
    return result


# ── Course Knowledge Base ──

def _load_course_kb() -> dict:
    """Load the IPG course knowledge base."""
    if _COURSE_KB_FILE.exists():
        try:
            return json.loads(_COURSE_KB_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"courses": {}, "code_prefixes": {}}


def _save_course_kb(kb: dict):
    """Persist course knowledge base."""
    _LEARNING_DIR.mkdir(parents=True, exist_ok=True)
    kb["last_updated"] = datetime.now().strftime("%Y-%m-%d")
    _COURSE_KB_FILE.write_text(json.dumps(kb, indent=2, ensure_ascii=False), encoding="utf-8")


def lookup_course_code(code: str) -> dict | None:
    """
    Look up a course code in the knowledge base.
    Returns {"code": "EDUP3103", "title": "Psikologi Perkembangan..."} or None.
    """
    if not code:
        return None
    kb = _load_course_kb()
    courses = kb.get("courses", {})
    code_upper = code.upper().strip()
    if code_upper in courses:
        return {"code": code_upper, "title": courses[code_upper]}
    # Try fuzzy: strip trailing characters (sometimes codes have extra chars)
    for stored_code, title in courses.items():
        if code_upper.startswith(stored_code) or stored_code.startswith(code_upper):
            return {"code": stored_code, "title": title}
    return None


def extract_course_code_from_text(text: str) -> dict | None:
    """
    Scan text for IPG course codes (e.g. EDUP3103, TSLB3053).
    Returns the first match found in the knowledge base, or the raw code if not in KB.
    """
    if not text:
        return None
    # IPG course codes: 2-4 letter prefix + 4 digits (+ optional letter suffix)
    matches = re.findall(r'\b([A-Z]{2,4}\d{4}[a-z]?)\b', text, re.IGNORECASE)
    for match in matches:
        result = lookup_course_code(match)
        if result:
            return result
    # Return first match even if not in KB
    if matches:
        return {"code": matches[0].upper(), "title": None}
    return None


def add_course_to_kb(code: str, title: str) -> bool:
    """Add a new course to the knowledge base if not already present."""
    if not code or not title:
        return False
    kb = _load_course_kb()
    code_upper = code.upper().strip()
    if code_upper in kb.get("courses", {}):
        return False  # Already exists
    kb.setdefault("courses", {})[code_upper] = title
    # Auto-detect prefix category
    prefix = re.match(r'^[A-Z]+', code_upper)
    if prefix:
        prefix_str = prefix.group()
        if prefix_str not in kb.get("code_prefixes", {}):
            kb.setdefault("code_prefixes", {})[prefix_str] = f"New Category ({prefix_str})"
    _save_course_kb(kb)
    logger.info(f"Added new course to KB: {code_upper} = {title}")
    return True


def get_course_kb_context() -> str:
    """
    Generate a course knowledge base summary for the Gemini prompt.
    Includes all known course codes so Gemini can match them correctly.
    """
    kb = _load_course_kb()
    courses = kb.get("courses", {})
    prefixes = kb.get("code_prefixes", {})
    if not courses:
        return ""

    parts = [f"IPG COURSE KNOWLEDGE BASE ({len(courses)} courses):"]
    parts.append("Known course code prefixes and their departments:")
    for prefix, dept in sorted(prefixes.items()):
        parts.append(f"  {prefix}: {dept}")

    parts.append("\nCourse code -> title mapping (use EXACT codes when matching):")
    # Group by prefix for readability
    by_prefix: dict[str, list[tuple[str, str]]] = {}
    for code, title in sorted(courses.items()):
        prefix = re.match(r'^[A-Z]+', code)
        p = prefix.group() if prefix else "OTHER"
        by_prefix.setdefault(p, []).append((code, title))

    for prefix in sorted(by_prefix.keys()):
        items = by_prefix[prefix]
        parts.append(f"\n  [{prefix}]")
        for code, title in items:
            parts.append(f"    {code}: {title}")

    return "\n".join(parts)


def get_learning_context() -> str:
    """
    Generate a learning context string for the Gemini prompt.
    Includes insights from past imports so the AI gets smarter.
    """
    patterns = _load_learned_patterns()
    total = patterns.get("total_imports", 0)
    if total == 0:
        return ""

    parts = [f"LEARNING CONTEXT (from {total} previous imports):"]

    # Frequently seen domains that are external links
    site_patterns = patterns.get("site_patterns", {})
    if site_patterns:
        frequent = sorted(site_patterns.items(), key=lambda x: -x[1])[:10]
        parts.append("Frequently linked domains: " + ", ".join(f"{d} ({c}x)" for d, c in frequent))

    # Import history stats
    if _HISTORY_FILE.exists():
        try:
            history = json.loads(_HISTORY_FILE.read_text(encoding="utf-8"))
            if history:
                recent = history[-5:]
                avg_resources = sum(h["stats"].get("total_resources", 0) for h in recent) / len(recent)
                avg_pages = sum(h["stats"].get("pages_crawled", 0) for h in recent) / len(recent)
                parts.append(f"Average site: {avg_pages:.0f} pages, {avg_resources:.0f} resources")
        except Exception:
            pass

    return "\n".join(parts)


def scrape_google_site_sync(site_url: str, max_pages: int = 80) -> dict:
    """Synchronous wrapper."""
    import asyncio
    return asyncio.run(scrape_google_site(site_url, max_pages))
