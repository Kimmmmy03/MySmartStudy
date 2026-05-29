"""External academic-source lookup.

OpenAlex (https://api.openalex.org) is the only external source enabled — it
covers journal articles, books, book chapters, conference papers, and reports
in one free API with no key required. Wikipedia and general web search are
intentionally excluded; results must be peer-reviewed academic works.

A small in-process LRU cache (1-hour TTL) reduces repeated lookups for the
same query, and the polite-pool `mailto` query param keeps us in OpenAlex's
recommended access tier."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests

logger = logging.getLogger(__name__)

OPENALEX_API = "https://api.openalex.org/works"
# Polite-pool email — anything resolvable works; OpenAlex never emails it.
OPENALEX_MAILTO = os.environ.get("OPENALEX_MAILTO", "mysmartstudy@example.com")

# Recency cutoff: papers must be published within the last RECENCY_YEARS years.
RECENCY_YEARS = int(os.environ.get("EXTERNAL_LOOKUP_RECENCY_YEARS", "6"))

# Work types we consider "official academic sources" — excludes datasets,
# software, theses, etc. that aren't journals/books/articles.
ALLOWED_TYPES = ["journal-article", "book", "book-chapter", "review-article", "proceedings-article", "report"]


# ── Simple time-based cache ──────────────────────────────────────────────
_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL_SECONDS = 60 * 60  # 1 hour


def _cache_get(key: str) -> Optional[list[dict]]:
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.time() > expires_at:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: list[dict]) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL_SECONDS, value)
    # Trim if oversized — keep recent 256 entries.
    if len(_CACHE) > 256:
        oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:64]
        for k, _ in oldest:
            _CACHE.pop(k, None)


# ── Source-shape helpers ─────────────────────────────────────────────────

def _format_authors(authorships: list[dict]) -> str:
    """First author + 'et al.' once we hit 3+ authors (matches the chat citation style)."""
    names = [
        (a.get("author") or {}).get("display_name", "").strip()
        for a in (authorships or [])
        if (a.get("author") or {}).get("display_name")
    ]
    if not names:
        return "Unknown author"
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return f"{names[0]} et al."


def _kind_label(work_type: str) -> str:
    """Human-friendly label for the source-tier badge in the UI."""
    return {
        "journal-article": "journal",
        "review-article": "journal",
        "book": "book",
        "book-chapter": "book",
        "proceedings-article": "conference",
        "report": "report",
    }.get(work_type, "article")


def _best_url(work: dict) -> str:
    """Prefer open-access PDF, then OA landing page, then DOI URL, then the work id."""
    oa = (work.get("open_access") or {})
    if oa.get("oa_url"):
        return oa["oa_url"]
    primary = (work.get("primary_location") or {})
    if primary.get("landing_page_url"):
        return primary["landing_page_url"]
    if work.get("doi"):
        doi = work["doi"]
        return doi if doi.startswith("http") else f"https://doi.org/{doi.lstrip('/')}"
    return work.get("id") or ""


def _normalize_work(work: dict) -> dict:
    """Convert an OpenAlex work into our internal source shape."""
    primary = (work.get("primary_location") or {})
    src = primary.get("source") or {}
    venue = src.get("display_name", "")
    return {
        "tier": "online",
        "kind": _kind_label(work.get("type", "")),
        "title": work.get("display_name") or "Untitled",
        "authors": _format_authors(work.get("authorships", [])),
        "year": work.get("publication_year"),
        "venue": venue,
        "doi": work.get("doi"),
        "url": _best_url(work),
        "abstract": _reconstruct_abstract(work.get("abstract_inverted_index")),
    }


def _reconstruct_abstract(inverted: Optional[dict]) -> str:
    """OpenAlex returns abstracts as an inverted index {word: [positions]}.
    Reverse it back to plain text. Returns '' if missing."""
    if not inverted:
        return ""
    pairs: list[tuple[int, str]] = []
    for word, positions in inverted.items():
        for p in positions:
            pairs.append((p, word))
    pairs.sort()
    return " ".join(w for _, w in pairs)[:1200]


# ── OpenAlex search ──────────────────────────────────────────────────────

def _from_date_cutoff() -> str:
    """ISO date for 'today minus RECENCY_YEARS years' — passed as OpenAlex's
    from_publication_date filter so only recent works are returned."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=365 * RECENCY_YEARS)
    return cutoff.date().isoformat()


def _search_sync(query: str, top_k: int) -> list[dict]:
    """Blocking OpenAlex request. Wrapped in to_thread by the async caller."""
    params = {
        "search": query,
        "filter": f"from_publication_date:{_from_date_cutoff()},type:{'|'.join(ALLOWED_TYPES)}",
        "per-page": min(top_k, 25),
        "mailto": OPENALEX_MAILTO,
        # `host_venue` is deprecated by OpenAlex; venue comes from
        # primary_location.source instead (handled in _normalize_work).
        "select": "id,doi,display_name,publication_year,type,authorships,primary_location,open_access,abstract_inverted_index",
    }
    try:
        resp = requests.get(OPENALEX_API, params=params, timeout=8)
        if resp.status_code != 200:
            logger.warning("OpenAlex %s for query '%s': %s", resp.status_code, query[:80], resp.text[:200])
            return []
        results = resp.json().get("results", []) or []
        return [_normalize_work(w) for w in results]
    except requests.RequestException as e:
        logger.warning("OpenAlex request failed for '%s': %s", query[:80], e)
        return []


async def lookup_openalex(query: str, top_k: int = 5) -> list[dict]:
    """Find peer-reviewed academic works for `query`, restricted to the last
    `RECENCY_YEARS` years. Returns at most `top_k` normalized sources.

    Never raises — returns [] on any failure so callers can fall back cleanly."""
    if not query or not query.strip():
        return []
    cache_key = f"q={query.strip().lower()}|k={top_k}|y={RECENCY_YEARS}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    results = await asyncio.to_thread(_search_sync, query.strip(), top_k)
    _cache_set(cache_key, results)
    return results


async def verify_citation(title: str) -> Optional[dict]:
    """Lookup a single work by title to confirm it actually exists in OpenAlex
    AND was published in the last RECENCY_YEARS years. Used to verify
    Gemini-tier citations and flag hallucinations / stale references.

    Returns the normalized work if a confident, recent match is found, else None."""
    if not title or len(title.strip()) < 8:
        return None
    hits = await lookup_openalex(title.strip(), top_k=1)
    if not hits:
        return None
    candidate = hits[0]
    # Recency guard: lookup_openalex already filters by publication date but
    # we double-check here so any caller that ever bypasses the search filter
    # still gets a year-bounded result.
    year = candidate.get("year")
    cutoff_year = datetime.now(timezone.utc).year - RECENCY_YEARS
    if isinstance(year, int) and year < cutoff_year:
        return None
    # Loose title-overlap check — exact equality is too strict, but if the
    # candidate's title shares <40% of the query's tokens we treat it as a miss.
    q_tokens = set(t.lower() for t in title.split() if len(t) > 2)
    c_tokens = set(t.lower() for t in (candidate["title"] or "").split() if len(t) > 2)
    if not q_tokens:
        return None
    overlap = len(q_tokens & c_tokens) / max(len(q_tokens), 1)
    return candidate if overlap >= 0.4 else None


def format_online_context(sources: list[dict]) -> str:
    """Build a prompt-ready context block from OpenAlex sources, citing each."""
    if not sources:
        return ""
    lines = ["RETRIEVED ACADEMIC SOURCES (use to ground your answer, cite as [Source N]):"]
    for i, s in enumerate(sources, 1):
        head = f"[Source {i}] {s['authors']} ({s.get('year', 'n.d.')}). {s['title']}."
        if s.get("venue"):
            head += f" {s['venue']}."
        lines.append(head)
        if s.get("abstract"):
            lines.append(s["abstract"][:800])
        lines.append("")
    return "\n".join(lines)
