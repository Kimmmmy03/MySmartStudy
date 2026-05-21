"""
Multi-Agent Orchestration via CrewAI — the AI_BACKEND=framework implementation
of the AI Grading feature.

Why grading (and not the companion chat)?
  CrewAI agents are LLM-reasoning agents — each does its own model call.
  The AI Companion's "agents" are just Firestore queries (pure I/O), so
  CrewAI there would turn a ~2s chat into ~30s. Grading, by contrast, is a
  non-real-time action (a lecturer clicks "AI grade" and waits) and is a
  genuine multi-step reasoning task — a good, honest fit for a crew.

Speed measures baked in:
  - Only 2 agents (Analyst + Grader), not 4-6
  - The worker (Analyst) runs on FAST_MODEL; only the Grader uses SMART_MODEL
  - max_iter capped so agents cannot loop
  - The router already caches the result in Firestore (aiGradeRecommendations)

Public function `generate_grading_report` has the SAME signature and return
shape as gag_service.generate_grading_report, so the dispatcher can swap it.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ── Structured output schema (matches gag_service's grading report dict) ─────

class _ResourceLink(BaseModel):
    title: str = ""
    doc_id: str = ""
    doc_type: str = ""

class _ImprovementSuggestion(BaseModel):
    criterion: str = ""
    suggestion: str = ""
    resource_link: Optional[_ResourceLink] = None

class _GradingReport(BaseModel):
    recommended_grade: float = Field(default=0.0, ge=0, le=100)
    criterion_scores: dict[str, float] = {}
    justification: str = ""
    confidence: float = Field(default=0.0, ge=0, le=1)
    comparative_analysis: str = ""
    improvement_suggestions: list[_ImprovementSuggestion] = []


def _run_grading_crew(
    submission_content: str,
    rubric: list[dict],
    rag_context: str,
    assignment_info: dict,
) -> dict:
    """Blocking CrewAI run — invoked inside asyncio.to_thread."""
    from crewai import LLM, Agent, Crew, Process, Task

    from . import ai_service

    api_key = os.getenv("GEMINI_API_KEY", "")
    os.environ.setdefault("GEMINI_API_KEY", api_key)  # LiteLLM reads this

    # CrewAI talks to Gemini through LiteLLM — model id form is "gemini/<name>"
    fast_llm = LLM(model=f"gemini/{ai_service.FAST_MODEL}", api_key=api_key, temperature=0.2)
    smart_llm = LLM(model=f"gemini/{ai_service.SMART_MODEL}", api_key=api_key, temperature=0.3)

    # ── Agent 1 — the worker (fast model) ──
    analyst = Agent(
        role="Submission Analyst",
        goal="Assess the student's submission against each rubric criterion",
        backstory=(
            "You are a meticulous teaching assistant. You read a submission and "
            "note, per rubric criterion, exactly what was done well and what is "
            "missing or weak. You do not assign final marks — you only analyse."
        ),
        llm=fast_llm,
        max_iter=2,
        allow_delegation=False,
        verbose=False,
    )

    # ── Agent 2 — the grader (smart model) ──
    grader = Agent(
        role="Grader",
        goal="Produce a fair, rigorous final grade with per-criterion scores",
        backstory=(
            "You are an educational assessment specialist. You take the analyst's "
            "per-criterion breakdown plus class statistics and similar past work, "
            "and produce an objective, well-justified grade."
        ),
        llm=smart_llm,
        max_iter=2,
        allow_delegation=False,
        verbose=False,
    )

    criteria_text = (
        "No rubric provided — grade on overall quality out of 100."
        if not rubric
        else "\n".join(
            f"- {c.get('name', '')}: {c.get('description', '')} (max {c.get('maxPoints', 10)} points)"
            for c in rubric
        )
    )

    analyse_task = Task(
        description=(
            f"Assess this student submission against the rubric.\n\n"
            f"RUBRIC:\n{criteria_text}\n\n"
            f"STUDENT SUBMISSION:\n\"\"\"\n"
            f"{ai_service.safe_truncate(submission_content)}\n\"\"\"\n\n"
            f"For every criterion, list concrete strengths and concrete gaps."
        ),
        expected_output="A per-criterion breakdown of strengths and gaps.",
        agent=analyst,
    )

    grade_task = Task(
        description=(
            f"Using the analyst's breakdown above, produce the final grade.\n\n"
            f"ASSIGNMENT: {assignment_info.get('title', '')}\n"
            f"DESCRIPTION: {assignment_info.get('description', '')}\n"
            f"CLASS STATISTICS: {assignment_info.get('class_stats', {})}\n\n"
            f"SIMILAR PAST SUBMISSIONS FOR REFERENCE:\n{rag_context}\n\n"
            f"Produce: recommended_grade (0-100), criterion_scores (per criterion), "
            f"justification, confidence (0-1), comparative_analysis, and "
            f"improvement_suggestions."
        ),
        expected_output="A complete structured grading report.",
        agent=grader,
        context=[analyse_task],
        output_pydantic=_GradingReport,
    )

    crew = Crew(
        agents=[analyst, grader],
        tasks=[analyse_task, grade_task],
        process=Process.sequential,  # grader waits for the analyst
        verbose=False,
    )

    result = crew.kickoff()

    report = getattr(result, "pydantic", None)
    if isinstance(report, _GradingReport):
        return report.model_dump()

    # Fallback if structured output didn't bind
    logger.warning("Grading crew returned no structured output; using raw text")
    return {
        "recommended_grade": 0,
        "criterion_scores": {},
        "justification": str(getattr(result, "raw", result))[:1000],
        "confidence": 0.0,
        "comparative_analysis": "",
        "improvement_suggestions": [],
    }


# ── Adaptive complexity routing ──
# Submissions vary wildly in size. A 200-word answer doesn't need a 2-agent
# crew chewing on it for ~12s — a single SMART_MODEL call grades it well in
# ~3s. Reserving the crew for substantial work means the common case gets
# FASTER, not slower, while we still honestly "use CrewAI for complex grading."
#
# The classifier is deliberately free (no extra LLM call): just length and
# rubric complexity. Tuneable via env vars so behaviour can be changed
# without a redeploy.
import os as _os
_COMPLEX_WORD_THRESHOLD = int(_os.getenv("GRADING_CREW_MIN_WORDS", "300"))
_COMPLEX_RUBRIC_THRESHOLD = int(_os.getenv("GRADING_CREW_MIN_CRITERIA", "3"))


def _is_complex_submission(submission_content: str, rubric: list[dict]) -> bool:
    """True → use the CrewAI crew; False → use the single-call fast path.

    Heuristic, on purpose:
      - Long submissions need per-criterion analysis (crew shines)
      - Many criteria → multi-step reasoning helps
      - Short or simple-rubric work → one strong LLM call is enough
    """
    word_count = len((submission_content or "").split())
    criteria = len(rubric or [])
    if word_count >= _COMPLEX_WORD_THRESHOLD:
        return True
    if criteria >= _COMPLEX_RUBRIC_THRESHOLD:
        return True
    return False


async def generate_grading_report(
    submission_content: str,
    rubric: list[dict],
    rag_chunks: list[dict],
    assignment_info: dict,
) -> dict:
    """Adaptive grader — single LLM call for trivial work, CrewAI crew for
    substantial work. Drop-in for gag_service.generate_grading_report.
    """
    from . import ai_service
    from . import rag_service_lc as rag

    ai_service._enforce_ai_gate()
    sources = rag.format_citations(rag_chunks)

    complex_submission = _is_complex_submission(submission_content, rubric)

    if complex_submission:
        # ── Substantial submission → 2-agent CrewAI crew ──
        logger.info(
            "Grading: routing to CrewAI crew (words=%d, criteria=%d)",
            len((submission_content or "").split()), len(rubric or []),
        )
        rag_context = rag.format_context(rag_chunks)
        data = await asyncio.to_thread(
            _run_grading_crew, submission_content, rubric, rag_context, assignment_info
        )
    else:
        # ── Trivial submission → single LangChain LLM call (~3s) ──
        logger.info(
            "Grading: routing to fast single-call path (words=%d, criteria=%d)",
            len((submission_content or "").split()), len(rubric or []),
        )
        from . import gag_service_lc
        data = await gag_service_lc.generate_grading_report(
            submission_content, rubric, rag_chunks, assignment_info,
        )

    # Defensive enrichment — fill missing resource_links from RAG sources
    for sug in data.get("improvement_suggestions", []):
        if not sug.get("resource_link") and sources:
            sug["resource_link"] = sources[0]
    # Surface the routing decision for the admin dashboard / audit
    data.setdefault("_grading_route", "crew" if complex_submission else "fast")
    return data
