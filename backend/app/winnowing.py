"""Winnowing document fingerprinting (the MOSS algorithm).

This is the lexical, evidence-producing half of plagiarism detection. Unlike
TF-IDF cosine (a bag-of-words signal) or embeddings (a semantic signal),
winnowing identifies the *exact overlapping passages* between two documents and
is robust to reordering and small edits — the foundation lecturers need to
justify an academic-integrity decision.

Reference: Schleimer, Wilkerson & Aiken, "Winnowing: Local Algorithms for
Document Fingerprinting" (SIGMOD 2003).

Pure standard library — no third-party dependencies.

Pipeline:
  1. tokenize   — split into words, normalise (lowercase, strip punctuation),
                  keep a map back to the original character offsets so we can
                  highlight the source text later.
  2. k-grams    — every run of K consecutive normalised tokens, hashed with a
                  stable checksum (zlib.crc32 — stable across processes, unlike
                  the salted built-in ``hash``).
  3. winnow     — slide a window of W hashes and keep the minimum in each
                  window. This yields a compact, position-anchored fingerprint
                  set with the guarantee that any shared substring of length
                  >= K + W - 1 is detected.
  4. compare    — fingerprint-set overlap gives the similarity score; a
                  full shared-k-gram pass (cheap at assignment scale) gives the
                  merged matched passages used for evidence highlighting.
"""

from __future__ import annotations

import re
import zlib
from dataclasses import dataclass

# K = k-gram size (tokens). W = winnowing window (hashes).
# Together they guarantee detection of any shared run of >= K + W - 1 tokens.
DEFAULT_K = 5
DEFAULT_W = 4

_WORD_RE = re.compile(r"\w+", re.UNICODE)


@dataclass
class Token:
    norm: str   # normalised (lowercase) word
    start: int  # char offset of the original word in the source text
    end: int


def _tokenize(text: str) -> list[Token]:
    """Split text into normalised word tokens, preserving original offsets."""
    tokens: list[Token] = []
    for m in _WORD_RE.finditer(text):
        word = m.group(0).lower()
        if word:
            tokens.append(Token(norm=word, start=m.start(), end=m.end()))
    return tokens


def _kgram_hash(tokens: list[Token], i: int, k: int) -> int:
    """Stable checksum of the k-gram starting at token index ``i``."""
    gram = " ".join(t.norm for t in tokens[i : i + k])
    return zlib.crc32(gram.encode("utf-8"))


def _all_kgrams(tokens: list[Token], k: int) -> list[tuple[int, int, int]]:
    """Return (hash, char_start, char_end) for every k-gram in token order."""
    n = len(tokens)
    if n < k:
        return []
    out: list[tuple[int, int, int]] = []
    for i in range(n - k + 1):
        h = _kgram_hash(tokens, i, k)
        out.append((h, tokens[i].start, tokens[i + k - 1].end))
    return out


def _winnow(kgrams: list[tuple[int, int, int]], w: int) -> set[int]:
    """Select fingerprint hashes via winnowing (min hash per window of w).

    Returns the set of selected hashes. On ties we keep the rightmost minimum,
    per the original algorithm, which maximises fingerprint stability.
    """
    if not kgrams:
        return set()
    if len(kgrams) <= w:
        return {g[0] for g in kgrams}

    selected: set[int] = set()
    min_idx = 0
    for i in range(len(kgrams) - w + 1):
        window = kgrams[i : i + w]
        # rightmost minimum within the window
        local_min = 0
        for j in range(1, w):
            if window[j][0] <= window[local_min][0]:
                local_min = j
        abs_idx = i + local_min
        if abs_idx != min_idx or i == 0:
            selected.add(kgrams[abs_idx][0])
            min_idx = abs_idx
    return selected


def fingerprint(text: str, k: int = DEFAULT_K, w: int = DEFAULT_W) -> set[int]:
    """Compute the winnowing fingerprint set for a document."""
    tokens = _tokenize(text)
    return _winnow(_all_kgrams(tokens, k), w)


def _merge_spans(
    raw: list[tuple[int, int, int, int]],
    gap: int,
) -> list[tuple[int, int, int, int]]:
    """Merge contiguous matched k-grams into larger passages.

    Each input tuple is (a_start, a_end, b_start, b_end). We sort by the A
    offset and merge entries that are adjacent (within ``gap`` chars) in *both*
    documents — copied text is contiguous in both, so this reconstructs whole
    copied passages while keeping coincidental scattered matches separate.
    """
    if not raw:
        return []
    raw.sort(key=lambda x: (x[0], x[2]))
    merged: list[list[int]] = [list(raw[0])]
    for a_s, a_e, b_s, b_e in raw[1:]:
        cur = merged[-1]
        if a_s <= cur[1] + gap and 0 <= (b_s - cur[3]) <= gap + (a_s - cur[1]) + 5:
            cur[1] = max(cur[1], a_e)
            cur[3] = max(cur[3], b_e)
        else:
            merged.append([a_s, a_e, b_s, b_e])
    return [(m[0], m[1], m[2], m[3]) for m in merged]


def compare(
    text_a: str,
    text_b: str,
    k: int = DEFAULT_K,
    w: int = DEFAULT_W,
    max_spans: int = 8,
    min_span_chars: int = 25,
) -> dict:
    """Compare two documents.

    Returns a dict with:
      - ``containment``: |A ∩ B| / min(|A|, |B|) over winnowed fingerprints —
        the symmetric "how much of the smaller doc is shared" score (0–1).
      - ``jaccard``: |A ∩ B| / |A ∪ B| over winnowed fingerprints (0–1).
      - ``matched_spans``: up to ``max_spans`` overlapping passages, each
        ``{text, a_start, a_end, b_start, b_end}`` for side-by-side highlight.
      - ``matched_char_count``: total chars covered by matched spans in A.
    """
    tokens_a = _tokenize(text_a)
    tokens_b = _tokenize(text_b)

    fp_a = _winnow(_all_kgrams(tokens_a, k), w)
    fp_b = _winnow(_all_kgrams(tokens_b, k), w)

    if not fp_a or not fp_b:
        return {
            "containment": 0.0,
            "jaccard": 0.0,
            "matched_spans": [],
            "matched_char_count": 0,
        }

    inter = fp_a & fp_b
    union = fp_a | fp_b
    containment = len(inter) / min(len(fp_a), len(fp_b))
    jaccard = len(inter) / len(union) if union else 0.0

    # ── Build evidence spans from the FULL shared k-gram set ──
    # Winnowing fingerprints drive the score; for highlighting we want every
    # shared region, so we index B's k-grams by hash and walk A's k-grams.
    b_index: dict[int, list[tuple[int, int]]] = {}
    for h, b_s, b_e in _all_kgrams(tokens_b, k):
        b_index.setdefault(h, []).append((b_s, b_e))

    raw_matches: list[tuple[int, int, int, int]] = []
    for h, a_s, a_e in _all_kgrams(tokens_a, k):
        bucket = b_index.get(h)
        if bucket:
            b_s, b_e = bucket[0]  # first occurrence is enough for a passage anchor
            raw_matches.append((a_s, a_e, b_s, b_e))

    merged = _merge_spans(raw_matches, gap=40)

    spans = []
    for a_s, a_e, b_s, b_e in merged:
        if a_e - a_s < min_span_chars:
            continue
        spans.append({
            "text": text_a[a_s:a_e],
            "a_start": a_s,
            "a_end": a_e,
            "b_start": b_s,
            "b_end": b_e,
        })
    # Drop spans whose A-range is mostly covered by an already-kept longer
    # span, so we don't show the same passage multiple times.
    spans.sort(key=lambda s: s["a_end"] - s["a_start"], reverse=True)
    kept: list[dict] = []
    for s in spans:
        redundant = False
        for big in kept:
            overlap = min(s["a_end"], big["a_end"]) - max(s["a_start"], big["a_start"])
            if overlap > 0.7 * (s["a_end"] - s["a_start"]):
                redundant = True
                break
        if not redundant:
            kept.append(s)
    spans = kept[:max_spans]

    matched_chars = sum(s["a_end"] - s["a_start"] for s in spans)

    return {
        "containment": round(containment, 4),
        "jaccard": round(jaccard, 4),
        "matched_spans": spans,
        "matched_char_count": matched_chars,
    }
