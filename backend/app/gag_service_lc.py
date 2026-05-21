"""
GAG via LangChain — the AI_BACKEND=framework implementation.

Reimplements the four gag_service generators using LangChain's
`with_structured_output()`, which binds a Pydantic schema to the chat model
so the response is guaranteed-valid structured data (no manual JSON parsing).

Public functions and their return dict shapes are IDENTICAL to gag_service:
  - generate_study_plan_artifact
  - generate_grading_report
  - generate_graph_suggestions
  - generate_plagiarism_network_report
"""

from __future__ import annotations

import asyncio
import logging
from typing import Literal, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ── Shared schema fragment ───────────────────────────────────────────────────

class _ResourceLink(BaseModel):
    title: str = ""
    doc_id: str = ""
    doc_type: str = ""


def _structured(model_cls, fast: bool = False):
    """Bind a Pydantic schema to the LangChain chat model."""
    from .ai_framework import get_chat_llm, get_usage_callback

    llm = get_chat_llm(fast=fast, temperature=0.3)
    return llm.with_structured_output(model_cls).with_config(
        {"callbacks": [get_usage_callback()]}
    )


# ════════════════════════════════════════════════════════════════════════════
# 1. STUDY PLAN
# ════════════════════════════════════════════════════════════════════════════

class _StudyRecommendation(BaseModel):
    course: str
    topic: str
    priority: Literal["high", "medium", "low"]
    suggested_time: str = ""
    reason: str = ""
    estimated_time: str = ""
    difficulty_rating: int = Field(default=3, ge=1, le=5)
    resource_links: list[_ResourceLink] = []
    suggested_activities: list[str] = []

class _StudyPlanArtifact(BaseModel):
    recommendations: list[_StudyRecommendation] = []
    daily_schedule_summary: str = ""
    motivational_message: str = ""


async def generate_study_plan_artifact(
    student_context: dict,
    rag_chunks: list[dict],
    deadlines: list[dict],
    exam_info: list[dict] | None = None,
) -> dict:
    from . import ai_service
    from . import rag_service_lc as rag

    ai_service._enforce_ai_gate()
    rag_context = rag.format_context(rag_chunks)
    sources = rag.format_citations(rag_chunks)

    prompt = f"""Create a PERSONALISED study plan for today.
Prioritise the student's weakest topics. Schedule sessions in free gaps
between classes, never overlapping class times, ordered chronologically.

TODAY: {student_context.get('today', '')}
STUDENT: {student_context.get('name', 'Student')}
PERFORMANCE: quiz_scores={student_context.get('quiz_scores', [])}, weak_topics={student_context.get('weak_topics', [])}
TIMETABLES: {student_context.get('timetables', [])}
UPCOMING DEADLINES: {deadlines}
EXAM INFO: {exam_info or 'none'}

RETRIEVED COURSE MATERIALS:
{rag_context}
"""
    chain = _structured(_StudyPlanArtifact)
    result: _StudyPlanArtifact = await asyncio.to_thread(chain.invoke, prompt)
    data = result.model_dump()

    # Enrichment — same defensive fill as the legacy generator
    for rec in data.get("recommendations", []):
        if not rec.get("resource_links"):
            rec["resource_links"] = sources[:2] if sources else []
    return data


# ════════════════════════════════════════════════════════════════════════════
# 2. GRADING REPORT
# ════════════════════════════════════════════════════════════════════════════

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


async def generate_grading_report(
    submission_content: str,
    rubric: list[dict],
    rag_chunks: list[dict],
    assignment_info: dict,
) -> dict:
    from . import ai_service
    from . import rag_service_lc as rag

    ai_service._enforce_ai_gate()
    rag_context = rag.format_context(rag_chunks)
    sources = rag.format_citations(rag_chunks)

    criteria_text = "No rubric provided. Grade on overall quality out of 100."
    if rubric:
        criteria_text = "RUBRIC CRITERIA:\n" + "\n".join(
            f"- {c.get('name', '')}: {c.get('description', '')} (max {c.get('maxPoints', 10)} points)"
            for c in rubric
        )

    prompt = f"""Grade this student tutorial submission objectively with comparative analysis.

ASSIGNMENT: {assignment_info.get('title', '')}
DESCRIPTION: {assignment_info.get('description', '')}
{criteria_text}
CLASS STATISTICS: {assignment_info.get('class_stats', {})}

STUDENT SUBMISSION:
\"\"\"
{ai_service.safe_truncate(submission_content)}
\"\"\"

SIMILAR PAST SUBMISSIONS FOR REFERENCE:
{rag_context}
"""
    chain = _structured(_GradingReport)
    result: _GradingReport = await asyncio.to_thread(chain.invoke, prompt)
    data = result.model_dump()

    for sug in data.get("improvement_suggestions", []):
        if not sug.get("resource_link") and sources:
            sug["resource_link"] = sources[0]
    return data


# ════════════════════════════════════════════════════════════════════════════
# 3. MIND MAP GRAPH SUGGESTIONS
# ════════════════════════════════════════════════════════════════════════════

class _NodeSuggestion(BaseModel):
    label: str
    description: str = ""
    parent_label: str = ""
    source: Optional[_ResourceLink] = None
    graph_connections: list[str] = []

class _GraphNode(BaseModel):
    id: str
    label: str
    type: str = "concept"

class _GraphEdge(BaseModel):
    source: str
    target: str
    relation: str = "related_to"

class _RelatedConceptsGraph(BaseModel):
    nodes: list[_GraphNode] = []
    edges: list[_GraphEdge] = []

class _MindMapSuggestions(BaseModel):
    suggestions: list[_NodeSuggestion] = []
    related_concepts_graph: _RelatedConceptsGraph = _RelatedConceptsGraph()


async def generate_graph_suggestions(
    map_nodes: list[dict],
    map_edges: list[dict],
    rag_chunks: list[dict],
    concept_subgraph: dict,
    map_title: str = "",
    task_description: str = "",
) -> dict:
    from . import ai_service
    from . import rag_service_lc as rag

    ai_service._enforce_ai_gate()
    node_labels = [n.get("label", "") for n in map_nodes if n.get("label")]
    rag_context = rag.format_context(rag_chunks)
    sources = rag.format_citations(rag_chunks)

    kg_context = ""
    if concept_subgraph and concept_subgraph.get("nodes"):
        kg_nodes = concept_subgraph["nodes"]
        kg_context = "RELATED CONCEPTS FROM KNOWLEDGE GRAPH:\n" + "\n".join(
            f"  - {n.get('label', '')} (type: {n.get('type', 'concept')})"
            for n in kg_nodes.values()
        )
        for edge in concept_subgraph.get("edges", [])[:20]:
            kg_context += (
                f"\n  {edge['source']} --[{edge.get('relation', 'related_to')}]--> {edge['target']}"
            )

    prompt = f"""A student is building a mind map titled "{map_title or 'Untitled'}".
Task: {task_description or 'General mind map'}

EXISTING NODES: {', '.join(node_labels[:40]) if node_labels else 'None yet'}

{kg_context}

RETRIEVED COURSE MATERIALS:
{rag_context}

Suggest 5-8 new nodes that improve this mind map. Each must be grounded in the
materials or knowledge graph, cite a source, and give an EXACT existing node
label as parent_label.
"""
    chain = _structured(_MindMapSuggestions)
    result: _MindMapSuggestions = await asyncio.to_thread(chain.invoke, prompt)
    data = result.model_dump()

    for sug in data.get("suggestions", []):
        if not sug.get("source") and sources:
            sug["source"] = sources[0]
    return data


# ════════════════════════════════════════════════════════════════════════════
# 4. PLAGIARISM NETWORK REPORT
# ════════════════════════════════════════════════════════════════════════════

class _StudentInCluster(BaseModel):
    id: str
    name: str = ""
    similarity_to_cluster: float = Field(default=0.0, ge=0, le=1)

class _FlaggedCluster(BaseModel):
    students: list[_StudentInCluster] = []
    max_similarity: float = Field(default=0.0, ge=0, le=1)
    analysis: str = ""

class _PlagiarismNetworkReport(BaseModel):
    flagged_clusters: list[_FlaggedCluster] = []
    summary: str = ""


async def generate_plagiarism_network_report(
    similarity_graph: dict,
    clusters: list[list[str]],
    submission_contents: dict,
) -> dict:
    from . import ai_service

    ai_service._enforce_ai_gate()

    cluster_text = ""
    for i, cluster in enumerate(clusters):
        cluster_text += f"\nCluster {i + 1}:\n"
        for sid in cluster:
            content = submission_contents.get(sid, "")
            cluster_text += f"  Student {sid}: \"{content[:500]}...\"\n"

    edges = similarity_graph.get("edges", [])
    high_sim = [e for e in edges if e.get("similarity", 0) >= 0.7]
    pairs_text = "\n".join(
        f"  {p['source']} <-> {p['target']}: {p['similarity']:.2f}" for p in high_sim[:20]
    )

    prompt = f"""Analyse these submission clusters for plagiarism patterns.

FLAGGED CLUSTERS (high similarity groups):
{cluster_text or 'No clusters detected.'}

HIGH SIMILARITY PAIRS:
{pairs_text or 'No high similarity pairs.'}

For each cluster, analyse what content is shared, whether it appears
coincidental or intentional, and the severity level.
"""
    chain = _structured(_PlagiarismNetworkReport)
    result: _PlagiarismNetworkReport = await asyncio.to_thread(chain.invoke, prompt)
    data = result.model_dump()
    data["network_graph"] = similarity_graph  # re-attach for visualisation
    return data
