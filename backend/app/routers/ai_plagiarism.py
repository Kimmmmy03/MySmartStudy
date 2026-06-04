"""AI-powered plagiarism detection — lecturer only.

The analyze_assignment_network endpoint uses multi-agent fan-out:
  - similarity_agent: build embedding-based similarity graph
  - assignment_agent: verify assignment exists (parallel validation)
Then cluster detection + GAG narrative run after the graph is built.
"""

from fastapi import APIRouter, Depends, HTTPException
from app.firestore import db
from app.auth import get_current_user, require_lecturer
from app.authz import assert_assignment_owner
from app import models
from app.ai_service import generate_json, get_knowledge_base, set_tracking_context, safe_truncate
from app import knowledge_graph_service, gag_service
from app.multi_agent import fan_out, get_or_default
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter
import os

router = APIRouter(prefix="/api/ai/plagiarism", tags=["AI Plagiarism"])


def _report_out(d: dict) -> dict:
    return {
        "id": d.get("id"),
        "submission_id": d.get("submissionId"),
        "assignment_id": d.get("assignmentId"),
        "student_id": d.get("studentId"),
        "plagiarism_percentage": d.get("plagiarismPercentage", 0),
        "sources": d.get("sources", []),
        "summary": d.get("summary", ""),
        "analyzed_at": d.get("analyzedAt"),
    }


@router.post("/analyze/{submission_id}")
async def analyze_submission(submission_id: str, user=Depends(require_lecturer)):
    set_tracking_context(user["id"], "plagiarism")
    # Check cache first
    existing = db.collection(models.AI_PLAGIARISM_REPORTS).where(filter=FieldFilter("submissionId", "==", submission_id
    )).limit(1).get()
    if existing:
        return _report_out(models.doc_to_dict(existing[0]))

    # Fetch submission
    sub_doc = db.collection(models.SUBMISSIONS).document(submission_id).get()
    if not sub_doc.exists:
        raise HTTPException(404, "Submission not found")
    sub = sub_doc.to_dict()
    # Object-level authz: requester must own the parent assignment's course.
    assert_assignment_owner(db, sub.get("assignmentId", ""), user)

    # Get submission content
    content = ""
    if sub.get("submissionType") == "map" and sub.get("mapId"):
        map_doc = db.collection(models.MAPS).document(sub["mapId"]).get()
        if map_doc.exists:
            content = map_doc.to_dict().get("nodesText", "")
    elif sub.get("filePath"):
        # Try to read PDF text
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(sub["filePath"])
            content = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            content = sub.get("comments", "")
    else:
        content = sub.get("comments", "") or sub.get("externalLink", "")

    if not content or len(content.strip()) < 20:
        raise HTTPException(400, "Submission has insufficient text content for analysis")

    # AI analysis
    prompt = f"""Analyse this student submission for plagiarism and AI-generated content.

SUBMISSION TEXT:
\"\"\"
{safe_truncate(content)}
\"\"\"

Return JSON with this exact structure:
{{
  "plagiarism_percentage": <float 0-100>,
  "sources": [
    {{
      "type": "ai_generated" | "web" | "book" | "article",
      "confidence": <float 0-1>,
      "evidence": "<brief explanation of why this source type is suspected>"
    }}
  ],
  "summary": "<2-3 sentence overall assessment>"
}}"""

    try:
        result = await generate_json(prompt, system_instruction=get_knowledge_base("plagiarism"))
    except Exception as e:
        raise HTTPException(502, f"AI analysis failed: {str(e)}")

    # Store in Firestore
    report_id = models.gen_id()
    report_data = {
        "submissionId": submission_id,
        "assignmentId": sub.get("assignmentId"),
        "studentId": sub.get("studentId"),
        "plagiarismPercentage": result.get("plagiarism_percentage", 0),
        "sources": result.get("sources", []),
        "summary": result.get("summary", ""),
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "analyzedBy": user["id"],
    }
    db.collection(models.AI_PLAGIARISM_REPORTS).document(report_id).set(report_data)
    report_data["id"] = report_id

    return _report_out(report_data)


@router.get("/report/{submission_id}")
async def get_report(submission_id: str, user=Depends(require_lecturer)):
    docs = db.collection(models.AI_PLAGIARISM_REPORTS).where(filter=FieldFilter("submissionId", "==", submission_id
    )).limit(1).get()
    if not docs:
        return None
    return _report_out(models.doc_to_dict(docs[0]))


@router.get("/historical/{assignment_id}")
async def historical_corpus_check(assignment_id: str, user=Depends(require_lecturer)):
    """Cross-assignment plagiarism check: compare this assignment's submissions
    against submissions from other assignments in the same course (reuse / prior
    cohort detection) using semantic embeddings."""
    assert_assignment_owner(db, assignment_id, user)
    set_tracking_context(user["id"], "plagiarism")
    try:
        return await knowledge_graph_service.check_historical_corpus(assignment_id)
    except Exception as e:
        raise HTTPException(502, f"Historical analysis failed: {str(e)}")


@router.post("/analyze-assignment/{assignment_id}")
async def analyze_assignment_network(assignment_id: str, user=Depends(require_lecturer)):
    """RAG+GAG (Graph): Build a similarity network across all submissions for an assignment.

    Uses multi-agent fan-out: assignment validation runs in parallel with the
    expensive similarity graph build — if the assignment doesn't exist, we
    detect it immediately without waiting for the graph.
    """
    assert_assignment_owner(db, assignment_id, user)
    set_tracking_context(user["id"], "plagiarism")

    async def _verify_assignment():
        doc = db.collection(models.ASSIGNMENTS).document(assignment_id).get()
        return {"exists": doc.exists}

    async def _build_graph():
        return await knowledge_graph_service.build_similarity_graph(assignment_id)

    # Fan-out: validate assignment + build graph in parallel
    results = await fan_out({
        "assignment": _verify_assignment(),
        "graph": _build_graph(),
    }, timeout=60.0)

    assign_result = get_or_default(results, "assignment", {})
    if not assign_result.get("exists"):
        raise HTTPException(404, "Assignment not found")

    graph_result = get_or_default(results, "graph", None)
    if graph_result is None or isinstance(graph_result, dict) and graph_result.get("_error"):
        raise HTTPException(502, "Similarity analysis failed")
    similarity_graph = graph_result

    nodes = similarity_graph.get("nodes", [])
    edges = similarity_graph.get("edges", [])
    submission_contents = similarity_graph.get("submission_contents", {})

    if len(nodes) < 2:
        return {
            "assignment_id": assignment_id,
            "total_submissions": len(nodes),
            "flagged_clusters": [],
            "network_graph": {"nodes": nodes, "edges": edges},
            "summary": "Not enough submissions to perform network analysis.",
        }

    # Detect clusters of high-similarity submissions
    cluster_threshold = float(os.getenv("PLAGIARISM_CLUSTER_THRESHOLD", "0.7"))
    clusters = knowledge_graph_service.detect_clusters(similarity_graph, threshold=cluster_threshold)

    # Use GAG service for narrative analysis if clusters found
    if clusters:
        try:
            report = await gag_service.generate_plagiarism_network_report(
                similarity_graph={"nodes": nodes, "edges": edges},
                clusters=clusters,
                submission_contents=submission_contents,
            )
            return {
                "assignment_id": assignment_id,
                "total_submissions": len(nodes),
                "flagged_clusters": report.get("flagged_clusters", []),
                "network_graph": report.get("network_graph", {"nodes": nodes, "edges": edges}),
                "summary": report.get("summary", ""),
            }
        except Exception as e:
            # Fall back to basic report
            pass

    # Basic report without GAG narrative
    basic_clusters = []
    for cluster in clusters:
        cluster_edges = [
            e for e in edges
            if e["source"] in cluster and e["target"] in cluster
        ]
        max_sim = max((e.get("similarity", 0) for e in cluster_edges), default=0)
        basic_clusters.append({
            "students": [{"id": sid, "similarity_to_cluster": max_sim} for sid in cluster],
            "max_similarity": max_sim,
            "analysis": f"Cluster of {len(cluster)} submissions with similarity above 70%.",
        })

    return {
        "assignment_id": assignment_id,
        "total_submissions": len(nodes),
        "flagged_clusters": basic_clusters,
        "network_graph": {"nodes": nodes, "edges": edges},
        "summary": f"Found {len(clusters)} cluster(s) of similar submissions out of {len(nodes)} total.",
    }
