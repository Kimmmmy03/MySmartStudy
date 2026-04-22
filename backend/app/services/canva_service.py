"""Canva link → PDF helper.

Uses headless Chromium (via Playwright) to render a Canva design page and
print it to PDF. Works for:
- Public "anyone with the link" share URLs (no auth needed)
- Private links — if you export your canva.com session cookies to
  `backend/secrets/canva_cookies.json` (Playwright storage_state format) or
  set env var `CANVA_COOKIES_FILE`, the helper will load them and access
  designs owned by that account.

Results are cached on disk so repeated generations are cheap.
Requires `playwright install chromium`.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / "uploads" / "canva-cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

_DEFAULT_COOKIES = Path(__file__).resolve().parents[2] / "secrets" / "canva_cookies.json"
_CANVA_HOSTS = ("canva.com",)


def is_canva_url(url: str | None) -> bool:
    if not url:
        return False
    return any(h in url.lower() for h in _CANVA_HOSTS)


def _cache_path(url: str) -> Path:
    key = hashlib.sha256(url.strip().encode()).hexdigest()[:24]
    return CACHE_DIR / f"{key}.pdf"


def _normalise_view_url(url: str) -> str:
    """Prefer the `/view` page — it renders without the editor chrome."""
    url = url.strip()
    if "/design/" in url and "/view" not in url:
        url = re.sub(r"(/design/[^/]+/[^/?#]+).*", r"\1/view", url)
    return url


def _cookies_storage_state() -> str | None:
    path = os.getenv("CANVA_COOKIES_FILE")
    if path and Path(path).exists():
        return path
    if _DEFAULT_COOKIES.exists():
        return str(_DEFAULT_COOKIES)
    return None


async def _scroll_all_slides(page) -> None:
    """Scroll through the Canva view to force every slide to render."""
    try:
        await page.evaluate(
            """
            async () => {
              const sleep = (ms) => new Promise(r => setTimeout(r, ms));
              const total = document.documentElement.scrollHeight;
              const step = Math.max(400, window.innerHeight - 100);
              for (let y = 0; y < total + step; y += step) {
                window.scrollTo(0, y);
                await sleep(250);
              }
              window.scrollTo(0, 0);
              await sleep(400);
            }
            """
        )
    except Exception:
        pass


async def canva_to_pdf(url: str, force: bool = False) -> Path | None:
    """Render a Canva link to PDF and return the path.

    Returns None if Playwright is unavailable or rendering fails.
    """
    if not is_canva_url(url):
        return None

    target = _normalise_view_url(url)
    out = _cache_path(target)
    if out.exists() and not force and out.stat().st_size > 0:
        return out

    try:
        from playwright.async_api import async_playwright
    except Exception:
        return None

    storage_state = _cookies_storage_state()

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            ctx_kwargs = {"viewport": {"width": 1440, "height": 900}}
            if storage_state:
                ctx_kwargs["storage_state"] = storage_state
            ctx = await browser.new_context(**ctx_kwargs)
            page = await ctx.new_page()
            await page.goto(target, wait_until="networkidle", timeout=60000)
            # Canva slides lazy-render — give them time and scroll through.
            await asyncio.sleep(2.5)
            await _scroll_all_slides(page)
            await asyncio.sleep(1.0)
            await page.pdf(
                path=str(out),
                format="A4",
                landscape=True,
                print_background=True,
                margin={"top": "6mm", "bottom": "6mm", "left": "6mm", "right": "6mm"},
            )
            await ctx.close()
            await browser.close()
    except Exception:
        if out.exists() and out.stat().st_size == 0:
            try:
                os.remove(out)
            except OSError:
                pass
        return None

    return out if out.exists() and out.stat().st_size > 0 else None
