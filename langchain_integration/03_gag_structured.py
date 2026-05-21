"""
Pattern 3 — Structured Output Generation (GAG) using LangChain.

Mirrors backend/app/gag_service.py — all 4 generators.
Uses LangChain's `with_structured_output()` which guarantees the LLM returns
a Pydantic object matching the schema.

How to run:
    cd langchain_integration
    python 03_gag_structured.py
"""

import os
from typing import Literal, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.3,
)


# ═══════════════════════════════════════════════════════════════════════════
# SHARED TYPES (used by multiple generators — same shape as your gag_service.py)
# ═══════════════════════════════════════════════════════════════════════════

class ResourceLink(BaseModel):
    title: str
    doc_id: str
    doc_type: str


# ═══════════════════════════════════════════════════════════════════════════
# 1. STUDY PLAN — mirrors generate_study_plan_artifact()
# ═══════════════════════════════════════════════════════════════════════════

class StudyRecommendation(BaseModel):
    course: str
    topic: str = Field(description="what to study")
    priority: Literal["high", "medium", "low"]
    suggested_time: str = Field(description="e.g. '9:00 AM - 10:00 AM'")
    reason: str
    estimated_time: str
    difficulty_rating: int = Field(ge=1, le=5)
    resource_links: list[ResourceLink] = []
    suggested_activities: list[str] = []

class StudyPlanArtifact(BaseModel):
    """Personalised study plan for today."""
    recommendations: list[StudyRecommendation]
    daily_schedule_summary: str
    motivational_message: str


def generate_study_plan(student_context: dict, rag_chunks: list[dict],
                        deadlines: list[dict]) -> StudyPlanArtifact:
    structured_llm = llm.with_structured_output(StudyPlanArtifact)

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an academic planning advisor. Given a student's performance, "
         "deadlines, and timetable, create a PERSONALISED study plan for today. "
         "Schedule sessions in FREE GAPS between classes, never overlap with class times. "
         "Order chronologically. Cite specific resource_links from materials."),
        ("human",
         "Today: {today}\nStudent: {name}\n"
         "Weak topics: {weak_topics}\n"
         "Quiz scores: {quiz_scores}\n"
         "Upcoming deadlines: {deadlines}\n"
         "Retrieved materials: {rag_context}"),
    ])

    chain = prompt | structured_llm
    return chain.invoke({
        "today": student_context.get("today", ""),
        "name": student_context.get("name", "Student"),
        "weak_topics": student_context.get("weak_topics", []),
        "quiz_scores": student_context.get("quiz_scores", []),
        "deadlines": deadlines,
        "rag_context": rag_chunks,
    })


# ═══════════════════════════════════════════════════════════════════════════
# 2. GRADING REPORT — mirrors generate_grading_report()
# ═══════════════════════════════════════════════════════════════════════════

class ImprovementSuggestion(BaseModel):
    criterion: str
    suggestion: str
    resource_link: Optional[ResourceLink] = None

class GradingReport(BaseModel):
    """Structured grading evaluation for a tutorial submission."""
    recommended_grade: float = Field(ge=0, le=100)
    criterion_scores: dict[str, float]
    justification: str
    confidence: float = Field(ge=0, le=1)
    comparative_analysis: str
    improvement_suggestions: list[ImprovementSuggestion]


def generate_grading_report(submission: str, rubric: list[dict],
                            class_stats: dict) -> GradingReport:
    structured_llm = llm.with_structured_output(GradingReport)

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an educational assessment specialist. Evaluate the student's submission "
         "against the rubric. Be fair but rigorous. Give per-criterion scores and "
         "actionable improvement suggestions."),
        ("human",
         "Rubric: {rubric}\n"
         "Class stats: {class_stats}\n\n"
         "Student submission:\n\"\"\"\n{submission}\n\"\"\""),
    ])

    chain = prompt | structured_llm
    return chain.invoke({
        "rubric": rubric,
        "class_stats": class_stats,
        "submission": submission[:6000],
    })


# ═══════════════════════════════════════════════════════════════════════════
# 3. MIND MAP SUGGESTIONS — mirrors generate_graph_suggestions()
# ═══════════════════════════════════════════════════════════════════════════

class NodeSuggestion(BaseModel):
    label: str
    description: str
    parent_label: str = Field(description="EXACT label of an existing node")
    source: Optional[ResourceLink] = None
    graph_connections: list[str] = []

class GraphNode(BaseModel):
    id: str
    label: str
    type: str

class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str

class RelatedConceptsGraph(BaseModel):
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []

class MindMapSuggestions(BaseModel):
    """Node suggestions for a student's mind map."""
    suggestions: list[NodeSuggestion]
    related_concepts_graph: RelatedConceptsGraph


def generate_graph_suggestions(map_nodes: list[dict], rag_chunks: list[dict],
                               map_title: str = "") -> MindMapSuggestions:
    structured_llm = llm.with_structured_output(MindMapSuggestions)

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are SmartBuddy for Mind Maps. Suggest 5-8 new nodes grounded in the "
         "course materials. Each parent_label must EXACTLY match one existing node."),
        ("human",
         "Map title: {title}\n"
         "Existing nodes: {existing_nodes}\n"
         "Retrieved materials: {rag_context}"),
    ])

    chain = prompt | structured_llm
    return chain.invoke({
        "title": map_title or "Untitled",
        "existing_nodes": [n.get("label") for n in map_nodes],
        "rag_context": rag_chunks,
    })


# ═══════════════════════════════════════════════════════════════════════════
# 4. PLAGIARISM NETWORK REPORT — mirrors generate_plagiarism_network_report()
# ═══════════════════════════════════════════════════════════════════════════

class StudentInCluster(BaseModel):
    id: str
    name: str
    similarity_to_cluster: float = Field(ge=0, le=1)

class FlaggedCluster(BaseModel):
    students: list[StudentInCluster]
    max_similarity: float = Field(ge=0, le=1)
    analysis: str

class PlagiarismNetworkReport(BaseModel):
    """Narrative report on suspicious submission clusters."""
    flagged_clusters: list[FlaggedCluster]
    summary: str


def generate_plagiarism_network_report(clusters: list[list[str]],
                                       submission_contents: dict) -> PlagiarismNetworkReport:
    structured_llm = llm.with_structured_output(PlagiarismNetworkReport)

    cluster_text = ""
    for i, cluster in enumerate(clusters):
        cluster_text += f"\nCluster {i+1}:\n"
        for sid in cluster:
            content = submission_contents.get(sid, "")
            cluster_text += f"  Student {sid}: \"{content[:500]}...\"\n"

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an academic integrity expert. For each cluster, analyse what content "
         "is shared, whether coincidental or intentional, and severity."),
        ("human", "Flagged clusters:\n{clusters}"),
    ])

    chain = prompt | structured_llm
    return chain.invoke({"clusters": cluster_text})


# ═══════════════════════════════════════════════════════════════════════════
# Demo — calls each generator
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("1. STUDY PLAN")
    print("=" * 60)
    plan = generate_study_plan(
        student_context={
            "today": "2026-05-21", "name": "Alice",
            "weak_topics": ["Normalisation"],
            "quiz_scores": [{"quiz_title": "ER Basics", "course": "DB101", "percentage": 55}],
        },
        rag_chunks=[{
            "title": "Intro to Relational Databases", "doc_id": "lec1",
            "doc_type": "pdf", "course_id": "db101",
            "text": "Normalisation organises tables to remove redundancy."
        }],
        deadlines=[{"title": "Quiz 2", "course": "DB101",
                    "deadline": "2026-05-26", "status": "pending"}],
    )
    print(f"Recommendations: {len(plan.recommendations)}")
    for r in plan.recommendations[:2]:
        print(f"  • {r.topic} ({r.priority}) — {r.suggested_time}, difficulty {r.difficulty_rating}/5")
    print(f"\nMotivation: {plan.motivational_message}")

    print("\n" + "=" * 60)
    print("2. GRADING REPORT")
    print("=" * 60)
    report = generate_grading_report(
        submission="Primary keys uniquely identify rows. ER models use entities and relationships.",
        rubric=[
            {"name": "Content", "description": "Topic coverage", "maxPoints": 50},
            {"name": "Depth",   "description": "Detail",          "maxPoints": 50},
        ],
        class_stats={"mean": 72.5, "median": 70, "count": 18},
    )
    print(f"Grade: {report.recommended_grade}/100  confidence={report.confidence:.2f}")
    print(f"Justification: {report.justification[:120]}...")
    print(f"Improvements: {len(report.improvement_suggestions)}")

    print("\n" + "=" * 60)
    print("3. MIND MAP SUGGESTIONS")
    print("=" * 60)
    mm = generate_graph_suggestions(
        map_nodes=[{"label": "Database"}, {"label": "ER Model"}],
        rag_chunks=[{"title": "Lec1", "doc_id": "x", "doc_type": "pdf", "course_id": "y",
                     "text": "Primary keys. Foreign keys. JOIN combines tables."}],
        map_title="Database Concepts",
    )
    print(f"Suggestions: {len(mm.suggestions)}")
    for s in mm.suggestions[:3]:
        print(f"  • {s.label} (attach to {s.parent_label})")

    print("\n" + "=" * 60)
    print("4. PLAGIARISM REPORT")
    print("=" * 60)
    plag = generate_plagiarism_network_report(
        clusters=[["s1", "s2"]],
        submission_contents={
            "s1": "A primary key uniquely identifies each row. Foreign keys link tables.",
            "s2": "A primary key uniquely identifies each row. Foreign keys link tables.",
        },
    )
    print(f"Flagged clusters: {len(plag.flagged_clusters)}")
    print(f"Summary: {plag.summary}")
