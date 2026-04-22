"""
RAG evaluation harness — measures recall@k across pipeline variants.

Populate GOLDEN_SET with (question, course_id, expected_doc_ids) tuples drawn
from a real indexed course. Run:

    python -m backend.tests.rag_eval

Compares three pipelines:
  - baseline:   embedding-only retrieval (rerank=False, no multistep)
  - phase1:     embedding + cross-encoder rerank
  - multistep:  decomposition + HyDE + rerank

Use the recall@5 delta to decide whether each phase is worth shipping.
To test a single phase, toggle env vars (RAG_MULTISTEP_ENABLED, RAG_HYDE_ENABLED).
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

from app import rag_service, rag_multistep


@dataclass
class EvalCase:
    question: str
    course_id: str
    expected_doc_ids: list[str]  # any overlap counts as a hit


# Real cases drawn from the indexed vector_store (education-psychology course on
# Piaget / Vygotsky). Extend with more cases for tighter statistical power.
_COURSE_EDU = "e31e5443-6d26-482a-be7c-2d3a172b45e2"

GOLDEN_SET: list[EvalCase] = [
    EvalCase(
        question="Apakah teori perkembangan kognitif Piaget?",
        course_id=_COURSE_EDU,
        expected_doc_ids=["3bd50c3c-f194-4228-9b7e-50eb44626c15"],
    ),
    EvalCase(
        question="Jelaskan teori Vygotsky tentang pembelajaran sosial.",
        course_id=_COURSE_EDU,
        expected_doc_ids=["0a54265d-196d-4b49-acd6-217a959776f8"],
    ),
    EvalCase(
        question="Bandingkan teori Piaget dan Vygotsky dalam perkembangan kognitif kanak-kanak.",
        course_id=_COURSE_EDU,
        expected_doc_ids=[
            "3bd50c3c-f194-4228-9b7e-50eb44626c15",
            "0a54265d-196d-4b49-acd6-217a959776f8",
        ],
    ),
    EvalCase(
        question="Piaget stages",
        course_id=_COURSE_EDU,
        expected_doc_ids=["3bd50c3c-f194-4228-9b7e-50eb44626c15"],
    ),
]

TOP_K = 5


def _recall(retrieved_ids: list[str], expected: list[str]) -> float:
    if not expected:
        return 1.0
    hits = sum(1 for e in expected if e in retrieved_ids)
    return hits / len(expected)


async def _run_pipeline(name: str, cases: list[EvalCase]) -> float:
    total = 0.0
    for c in cases:
        if name == "baseline":
            chunks = await rag_service.retrieve(
                c.question, [c.course_id], top_k=TOP_K, rerank=False,
            )
        elif name == "phase1":
            chunks = await rag_service.retrieve(
                c.question, [c.course_id], top_k=TOP_K, rerank=True,
            )
        elif name == "multistep":
            chunks, _ = await rag_multistep.retrieve_multistep(
                c.question, [c.course_id], top_k=TOP_K,
            )
        else:
            raise ValueError(name)
        got_ids = [ch.get("doc_id", "") for ch in chunks]
        total += _recall(got_ids, c.expected_doc_ids)
    return total / max(len(cases), 1)


async def main() -> None:
    if not GOLDEN_SET:
        print("GOLDEN_SET is empty — add cases in rag_eval.py before running.")
        return

    # Phase 1 only (disable multistep)
    os.environ["RAG_MULTISTEP_ENABLED"] = "0"
    baseline = await _run_pipeline("baseline", GOLDEN_SET)
    phase1 = await _run_pipeline("phase1", GOLDEN_SET)

    # Full multistep
    os.environ["RAG_MULTISTEP_ENABLED"] = "1"
    multistep = await _run_pipeline("multistep", GOLDEN_SET)

    print(f"recall@{TOP_K}: baseline={baseline:.2%}  phase1={phase1:.2%}  multistep={multistep:.2%}")
    print(f"  phase1 lift:    {(phase1 - baseline) * 100:+.1f} pts")
    print(f"  multistep lift: {(multistep - phase1) * 100:+.1f} pts  (vs phase1)")


if __name__ == "__main__":
    asyncio.run(main())
