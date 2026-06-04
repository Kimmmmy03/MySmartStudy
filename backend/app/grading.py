"""Deterministic grading engine — the trustworthy half of AI grading.

The LLM is used only as a *per-criterion rater* (see gag_service); this module
turns its judgements into a defensible grade:

  * the rubric is enforced — each criterion score is clamped to its max_points
    and the total is computed deterministically from the rubric weights, so the
    model can never "invent" a total that doesn't follow from its own scores;
  * confidence is *measured*, not self-reported — we score each submission
    several times (self-consistency) and derive confidence from the agreement
    between samples, flagging low-agreement cases for mandatory human review;
  * validity is *measurable* — quadratic weighted kappa (QWK), mean absolute
    error and exact/adjacent agreement quantify how well the AI matches the
    lecturer's own grades over time.

Pure standard library — no third-party dependencies.

References: Automated Essay Scoring literature (QWK is the field-standard
human-agreement metric, e.g. the ASAP corpus and ETS e-rater) and the
LLM-as-a-judge methodology (rubric decomposition + self-consistency).
"""

from __future__ import annotations

import os
import statistics

# When an assignment has no rubric we still decompose grading into dimensions
# rather than emitting an ungrounded holistic 0-100 number.
DEFAULT_CRITERIA: list[dict] = [
    {"name": "Understanding", "description": "Grasp of the underlying concepts.", "max_points": 25},
    {"name": "Correctness", "description": "Accuracy and validity of the content.", "max_points": 25},
    {"name": "Completeness", "description": "Coverage of what the task asked for.", "max_points": 25},
    {"name": "Clarity", "description": "Organisation, structure and communication.", "max_points": 25},
]


def _max_points(c: dict) -> float:
    """Read a criterion's max points, tolerating both stored key spellings."""
    v = c.get("max_points", c.get("maxPoints", 10))
    try:
        return float(v)
    except (TypeError, ValueError):
        return 10.0


def normalize_criteria(rubric: list[dict] | None) -> list[dict]:
    """Return usable criteria — the rubric's, or a sensible default rubric."""
    if not rubric:
        return [dict(c) for c in DEFAULT_CRITERIA]
    out = []
    for c in rubric:
        name = (c.get("name") or "").strip()
        if not name:
            continue
        out.append({
            "name": name,
            "description": c.get("description", ""),
            "max_points": _max_points(c),
        })
    return out or [dict(c) for c in DEFAULT_CRITERIA]


def compute_total(criterion_scores: dict[str, float], criteria: list[dict]) -> dict:
    """Deterministically compute the percentage from clamped per-criterion scores.

    Returns {earned, possible, percentage, clamped_scores}.
    """
    earned = 0.0
    possible = 0.0
    clamped: dict[str, float] = {}
    for c in criteria:
        name = c["name"]
        mp = c["max_points"]
        possible += mp
        raw = criterion_scores.get(name)
        if raw is None:
            # case-insensitive fallback match
            for k, v in criterion_scores.items():
                if k.strip().lower() == name.strip().lower():
                    raw = v
                    break
        try:
            score = float(raw) if raw is not None else 0.0
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(score, mp))  # clamp to [0, max_points]
        clamped[name] = round(score, 2)
        earned += score
    pct = (earned / possible * 100.0) if possible > 0 else 0.0
    return {
        "earned": round(earned, 2),
        "possible": round(possible, 2),
        "percentage": round(pct, 1),
        "clamped_scores": clamped,
    }


def _criterion_score_from_sample(sample: dict, name: str) -> float | None:
    """Pull a criterion's score out of one grader sample (case-insensitive)."""
    for c in sample.get("criteria", []) or []:
        if (c.get("name") or "").strip().lower() == name.strip().lower():
            try:
                return float(c.get("score"))
            except (TypeError, ValueError):
                return None
    return None


def aggregate_samples(samples: list[dict], criteria: list[dict]) -> dict:
    """Aggregate N grader samples into one calibrated recommendation.

    * per-criterion score = median across samples (clamped to max_points)
    * total = deterministic weighted percentage of those medians
    * confidence = measured from the spread of per-sample totals
    * needs_review = True when agreement is low (high spread / low confidence)
    * evidence/justification taken from the sample whose total is closest to
      the median total (the representative sample)
    """
    criteria = normalize_criteria(criteria)
    flag_conf = float(os.getenv("GRADING_REVIEW_CONFIDENCE_FLAG", "0.6"))
    spread_div = float(os.getenv("GRADING_CONFIDENCE_SPREAD_DIV", "20"))

    samples = [s for s in samples if isinstance(s, dict)]
    if not samples:
        return {
            "recommended_grade": 0.0, "criterion_scores": {}, "criteria_detail": [],
            "justification": "", "confidence": 0.0, "score_spread": 0.0,
            "needs_review": True, "samples": 0,
        }

    # Per-criterion median score across samples.
    median_scores: dict[str, float] = {}
    for c in criteria:
        vals = [v for s in samples if (v := _criterion_score_from_sample(s, c["name"])) is not None]
        median_scores[c["name"]] = statistics.median(vals) if vals else 0.0

    agg = compute_total(median_scores, criteria)
    median_total = agg["percentage"]

    # Per-sample totals (using each sample's own criterion scores) → spread.
    sample_totals: list[float] = []
    for s in samples:
        sc = {c["name"]: (_criterion_score_from_sample(s, c["name"]) or 0.0) for c in criteria}
        sample_totals.append(compute_total(sc, criteria)["percentage"])

    spread = statistics.pstdev(sample_totals) if len(sample_totals) > 1 else 0.0
    confidence = round(max(0.0, min(1.0, 1.0 - spread / spread_div)), 2)
    needs_review = confidence < flag_conf or spread > spread_div / 2

    # Representative sample = closest total to the median total.
    rep = min(samples, key=lambda s: abs(
        compute_total(
            {c["name"]: (_criterion_score_from_sample(s, c["name"]) or 0.0) for c in criteria},
            criteria,
        )["percentage"] - median_total
    ))
    rep_by_name = {(c.get("name") or "").strip().lower(): c for c in rep.get("criteria", []) or []}

    criteria_detail = []
    for c in criteria:
        rc = rep_by_name.get(c["name"].strip().lower(), {})
        criteria_detail.append({
            "name": c["name"],
            "max_points": c["max_points"],
            "score": agg["clamped_scores"].get(c["name"], 0.0),
            "evidence": rc.get("evidence", ""),
            "justification": rc.get("justification", ""),
        })

    return {
        "recommended_grade": median_total,
        "criterion_scores": agg["clamped_scores"],
        "criteria_detail": criteria_detail,
        "earned": agg["earned"],
        "possible": agg["possible"],
        "justification": rep.get("justification", ""),
        "comparative_analysis": rep.get("comparative_analysis", ""),
        "improvement_suggestions": rep.get("improvement_suggestions", []),
        "confidence": confidence,
        "score_spread": round(spread, 2),
        "needs_review": needs_review,
        "samples": len(samples),
    }


# ── Validity metrics (AI-vs-human agreement) ──

def _to_bucket(score: float, n_buckets: int, max_score: float = 100.0) -> int:
    """Map a 0..max_score grade onto an ordinal bucket for kappa."""
    if max_score <= 0:
        return 0
    b = int(score / max_score * n_buckets)
    return max(0, min(n_buckets - 1, b))


def quadratic_weighted_kappa(human: list[float], ai: list[float], n_buckets: int = 10) -> float | None:
    """Quadratic Weighted Kappa between human and AI grades (the AES standard).

    Returns a value in [-1, 1] (1 = perfect agreement, 0 = chance), or None when
    there are too few pairs or no variance to estimate agreement.
    """
    if len(human) != len(ai) or len(human) < 2:
        return None
    h = [_to_bucket(x, n_buckets) for x in human]
    a = [_to_bucket(x, n_buckets) for x in ai]
    N = n_buckets

    O = [[0] * N for _ in range(N)]
    for hi, ai_ in zip(h, a):
        O[hi][ai_] += 1

    hist_h = [h.count(i) for i in range(N)]
    hist_a = [a.count(i) for i in range(N)]
    n = len(h)

    num = 0.0
    den = 0.0
    for i in range(N):
        for j in range(N):
            w = ((i - j) ** 2) / ((N - 1) ** 2)
            e = hist_h[i] * hist_a[j] / n
            num += w * O[i][j]
            den += w * e
    if den == 0:
        return None
    return round(1.0 - num / den, 3)


def grade_agreement(human: list[float], ai: list[float], adjacent_band: float = 10.0) -> dict:
    """Mean absolute error and exact / adjacent agreement rates between grades."""
    if not human or len(human) != len(ai):
        return {"pairs": 0, "mae": None, "exact_rate": None, "adjacent_rate": None}
    diffs = [abs(x - y) for x, y in zip(human, ai)]
    n = len(diffs)
    return {
        "pairs": n,
        "mae": round(sum(diffs) / n, 2),
        "exact_rate": round(sum(1 for d in diffs if d == 0) / n, 3),
        "adjacent_rate": round(sum(1 for d in diffs if d <= adjacent_band) / n, 3),
    }
