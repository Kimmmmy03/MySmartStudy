"""
Chart generation for the RAGAS evaluation report (FYP academic standard).

Produces three figures as PNG files for embedding in the DOCX report:
  Figure 1 - grouped bar chart: before vs after, per metric
  Figure 2 - radar chart: quality profile, before vs after
  Figure 3 - histogram: distribution of per-sample mean scores

All charts use a restrained academic style (no chartjunk, light gridlines,
greyscale + one accent colour) suitable for a Final Year Project report.
"""

import os
import json
import math

import matplotlib
matplotlib.use("Agg")  # headless — no display needed
import matplotlib.pyplot as plt

# Academic palette: muted grey for "before", navy accent for "after".
COL_BEFORE = "#9AA5B1"
COL_AFTER = "#1B2A80"
GRID = "#D9DEE5"

METRIC_ORDER = [
    "faithfulness", "answer_relevancy", "context_precision",
    "context_recall", "answer_correctness",
]
METRIC_LABEL = {
    "faithfulness": "Faithfulness",
    "answer_relevancy": "Answer\nRelevancy",
    "context_precision": "Context\nPrecision",
    "context_recall": "Context\nRecall",
    "answer_correctness": "Answer\nCorrectness",
}


def _style_axes(ax):
    ax.set_axisbelow(True)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color("#6B7280")


def chart_before_after(before: dict, after: dict, path: str):
    """Figure 1 - grouped bar chart of the five metrics, before vs after."""
    labels = [METRIC_LABEL[m] for m in METRIC_ORDER]
    bvals = [before.get(m, 0) for m in METRIC_ORDER]
    avals = [after.get(m, 0) for m in METRIC_ORDER]
    x = range(len(METRIC_ORDER))
    w = 0.38

    fig, ax = plt.subplots(figsize=(8.2, 4.6))
    b1 = ax.bar([i - w / 2 for i in x], bvals, w,
                label="Before (50-sample)", color=COL_BEFORE)
    b2 = ax.bar([i + w / 2 for i in x], avals, w,
                label="After (50-sample)", color=COL_AFTER)
    for bars in (b1, b2):
        for rect in bars:
            h = rect.get_height()
            ax.annotate(f"{h:.2f}", xy=(rect.get_x() + rect.get_width() / 2, h),
                        xytext=(0, 3), textcoords="offset points",
                        ha="center", fontsize=8, color="#374151")
    ax.set_ylim(0, 1.08)
    ax.set_ylabel("Score (0 - 1)", fontsize=10)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_title("RAGAS Metrics: Before vs After Round 2 Improvements",
                 fontsize=11, fontweight="bold", pad=12)
    ax.legend(frameon=False, fontsize=9, loc="lower right")
    _style_axes(ax)
    fig.tight_layout()
    fig.savefig(path, dpi=200)
    plt.close(fig)


def chart_radar(before: dict, after: dict, path: str):
    """Figure 2 - radar chart showing the quality profile before vs after."""
    labels = [METRIC_LABEL[m].replace("\n", " ") for m in METRIC_ORDER]
    n = len(METRIC_ORDER)
    angles = [i / n * 2 * math.pi for i in range(n)]
    angles += angles[:1]

    bvals = [before.get(m, 0) for m in METRIC_ORDER]
    bvals += bvals[:1]
    avals = [after.get(m, 0) for m in METRIC_ORDER]
    avals += avals[:1]

    fig, ax = plt.subplots(figsize=(6.4, 6.0),
                           subplot_kw={"projection": "polar"})
    ax.set_theta_offset(math.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
    ax.set_yticklabels(["0.2", "0.4", "0.6", "0.8", "1.0"], fontsize=8,
                       color="#6B7280")
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, fontsize=9)
    ax.grid(color=GRID, linewidth=0.8)

    ax.plot(angles, bvals, color=COL_BEFORE, linewidth=1.8,
            label="Before (50-sample)")
    ax.fill(angles, bvals, color=COL_BEFORE, alpha=0.15)
    ax.plot(angles, avals, color=COL_AFTER, linewidth=2.2,
            label="After (50-sample)")
    ax.fill(angles, avals, color=COL_AFTER, alpha=0.20)

    ax.set_title("RAGAS Quality Profile", fontsize=11, fontweight="bold",
                 pad=22)
    ax.legend(frameon=False, fontsize=9, loc="upper right",
              bbox_to_anchor=(1.20, 1.10))
    fig.tight_layout()
    fig.savefig(path, dpi=200)
    plt.close(fig)


def chart_distribution(per_sample: list, path: str):
    """Figure 3 - histogram of per-sample mean scores across the test set."""
    means = []
    for s in per_sample:
        vals = [v for k, v in s.items()
                if k not in ("course", "question", "num_contexts")
                and isinstance(v, (int, float))]
        if vals:
            means.append(sum(vals) / len(vals))
    if not means:
        return False

    fig, ax = plt.subplots(figsize=(8.2, 4.2))
    ax.hist(means, bins=10, range=(0, 1), color=COL_AFTER,
            edgecolor="white", linewidth=1.0)
    overall = sum(means) / len(means)
    ax.axvline(overall, color="#B11B1B", linewidth=1.8, linestyle="--",
               label=f"Overall mean = {overall:.2f}")
    ax.set_xlim(0, 1)
    ax.set_xlabel("Per-sample mean score (0 - 1)", fontsize=10)
    ax.set_ylabel("Number of samples", fontsize=10)
    ax.set_title(f"Distribution of Per-Sample Mean Scores (n = {len(means)})",
                 fontsize=11, fontweight="bold", pad=12)
    ax.legend(frameon=False, fontsize=9)
    _style_axes(ax)
    fig.tight_layout()
    fig.savefig(path, dpi=200)
    plt.close(fig)
    return True


def generate_all(results_path: str, before: dict, out_dir: str) -> dict:
    """Generate all three figures. Returns {fig_key: png_path} for embeds."""
    os.makedirs(out_dir, exist_ok=True)
    data = json.load(open(results_path, encoding="utf-8"))
    after = data.get("aggregate_scores", {})
    per_sample = data.get("per_sample", [])

    out = {}
    p1 = os.path.join(out_dir, "fig1_before_after.png")
    chart_before_after(before, after, p1)
    out["before_after"] = p1

    p2 = os.path.join(out_dir, "fig2_radar.png")
    chart_radar(before, after, p2)
    out["radar"] = p2

    p3 = os.path.join(out_dir, "fig3_distribution.png")
    if chart_distribution(per_sample, p3):
        out["distribution"] = p3

    return out


if __name__ == "__main__":
    HERE = os.path.dirname(os.path.abspath(__file__))
    PREV50 = {
        "faithfulness": 0.9853, "answer_relevancy": 0.6307,
        "context_precision": 0.7191, "context_recall": 0.7600,
        "answer_correctness": 0.7101,
    }
    figs = generate_all(
        os.path.join(HERE, "results", "ragas_results.json"),
        PREV50, os.path.join(HERE, "charts"),
    )
    for k, v in figs.items():
        print(f"  {k}: {v}")
