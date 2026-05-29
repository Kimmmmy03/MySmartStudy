"""
RAGAS regression check — small (15-sample), fast (~3-4 min), pass/fail gated.

Designed to be run automatically after any change to rag_service.py or
related retrieval code: if the overall RAGAS mean drops by more than
THRESHOLD_DROP from the last recorded baseline, exit code 1 — so the change
can be flagged in a CI workflow before merging.

Reads the previous baseline from results/ragas_ci_baseline.json (if any) and
writes the current run there if the run passed.

Run:
    python ragas_ci_check.py             # measure + compare + exit non-zero on regression
    python ragas_ci_check.py --record    # record current run as the new baseline
"""

import os
import sys
import json
import asyncio
import datetime
import warnings

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, "..", "backend"))
RESULTS = os.path.join(HERE, "results")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env")

from app import rag_service, ai_service  # noqa: E402
ai_service._enforce_ai_gate = lambda *a, **k: None  # noqa: E731

# Reuse the harness internals — they already do the right thing.
sys.path.insert(0, os.path.join(BACKEND, "..", "testing"))
import test_ragas as ragas_mod  # noqa: E402

GEN_MODEL = "gemini-2.5-flash"
EMBED_MODEL = "models/gemini-embedding-001"
N_SAMPLES = 15
PER_COURSE = 3
THRESHOLD_DROP = 0.05  # if the mean falls by >0.05, fail the check

ragas_mod.N_SAMPLES = N_SAMPLES
ragas_mod.PER_COURSE = PER_COURSE

BASELINE_PATH = os.path.join(RESULTS, "ragas_ci_baseline.json")


def main():
    record = "--record" in sys.argv

    samples = ragas_mod.build_dataset()
    if not samples:
        print("FAIL: no samples could be built (no indexed content?)")
        sys.exit(2)
    result = ragas_mod.run_ragas(samples)
    df = result.to_pandas()
    metric_cols = [c for c in df.columns
                   if c not in ("user_input", "response",
                                "retrieved_contexts", "reference")]
    current = {c: round(float(df[c].mean()), 4) for c in metric_cols}
    current_mean = round(sum(current.values()) / len(current), 4)

    print("\n== Current RAGAS scores ==")
    for k, v in current.items():
        print(f"  {k:24} {v}")
    print(f"  {'mean':24} {current_mean}")

    baseline = None
    if os.path.exists(BASELINE_PATH):
        baseline = json.load(open(BASELINE_PATH, encoding="utf-8"))

    if baseline:
        baseline_scores = baseline.get("scores", {})
        baseline_mean = baseline.get("mean", 0)
        delta = round(current_mean - baseline_mean, 4)
        print(f"\n== Comparison vs baseline {baseline.get('recorded_at','')} ==")
        for k in current:
            b = baseline_scores.get(k)
            if b is not None:
                d = round(current[k] - b, 4)
                arrow = "+" if d >= 0 else ""
                print(f"  {k:24} {b:.4f} -> {current[k]:.4f}  ({arrow}{d:+.4f})")
        print(f"  {'mean':24} {baseline_mean:.4f} -> {current_mean:.4f}  "
              f"({'+' if delta >= 0 else ''}{delta:+.4f})")
        if delta < -THRESHOLD_DROP:
            print(f"\nFAIL: mean dropped by {abs(delta)} (> {THRESHOLD_DROP})")
            sys.exit(1)
        else:
            print(f"\nPASS: within tolerance (drop <= {THRESHOLD_DROP})")
    else:
        print("\nNo baseline recorded yet. Run with --record to set one.")

    payload = {
        "recorded_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "samples": N_SAMPLES, "model_judge": GEN_MODEL,
        "scores": current, "mean": current_mean,
    }
    if record or baseline is None:
        json.dump(payload, open(BASELINE_PATH, "w", encoding="utf-8"), indent=2)
        print(f"\nWrote baseline to {BASELINE_PATH}")


if __name__ == "__main__":
    main()
