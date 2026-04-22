"""AI-powered grade recommendations for tutorial-type assignments — lecturer only.

Uses multi-agent fan-out for parallel data gathering:
  - submission_agent: fetch submission + extract content
  - assignment_agent: fetch assignment + rubric
  - stats_agent: compute class statistics from graded submissions
  - rag_agent: retrieve relevant course materials
All run concurrently, then results feed into a single GAG synthesizer call.
"""

from fastapi import APIRouter, Depends, HTTPException
from app.firestore import db
from app.auth import require_lecturer
from app import models
from app.ai_service import generate_json, get_knowledge_base, set_tracking_context
from app import rag_service, gag_service
from app.multi_agent import fan_out, fan_out_synthesize, get_or_default
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/ai/grading", tags=["AI Grading"])


def _rec_out(d: dict) -> dict:
    out = {
        "id": d.get("id"),
        "submission_id": d.get("submissionId"),
        "assignment_id": d.get("assignmentId"),
        "recommended_grade": d.get("recommendedGrade", 0),
        "criterion_scores": d.get("criterionScores", {}),
        "justification": d.get("justification", ""),
        "confidence": d.get("confidence", 0),
        "created_at": d.get("createdAt"),
    }
    # Include GAG-enhanced fields if present
    if d.get("comparativeAnalysis"):
        out["comparative_analysis"] = d["comparativeAnalysis"]
    if d.get("improvementSuggestions"):
        out["improvement_suggestions"] = d["improvementSuggestions"]
    return out


async def _fetch_submission(submission_id: str) -> dict:
    """Agent: fetch submission and extract its content."""
    sub_doc = db.collection(models.SUBMISSIONS).document(submission_id).get()
    if not sub_doc.exists:
        return {"_not_found": True}
    sub = sub_doc.to_dict()

    content = ""
    if sub.get("submissionType") == "map" and sub.get("mapId"):
        map_doc = db.collection(models.MAPS).document(sub["mapId"]).get()
        if map_doc.exists:
            content = map_doc.to_dict().get("nodesText", "")
    elif sub.get("filePath"):
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(sub["filePath"])
            content = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            content = sub.get("comments", "")
    else:
        content = sub.get("comments", "") or sub.get("externalLink", "")

    return {"sub": sub, "content": content}


async def _fetch_assignment_and_rubric(assignment_id: str) -> dict:
    """Agent: fetch assignment metadata + rubric criteria."""
    assign_doc = db.collection(models.ASSIGNMENTS).document(assignment_id).get()
    if not assign_doc.exists:
        return {"_not_found": True}
    assign = assign_doc.to_dict()

    rubric_docs = db.collection(models.RUBRICS).where(
        filter=FieldFilter("assignmentId", "==", assignment_id)
    ).limit(1).get()
    rubric_criteria = []
    if rubric_docs:
        rubric_criteria = rubric_docs[0].to_dict().get("criteria", [])

    return {"assign": assign, "rubric_criteria": rubric_criteria}


async def _compute_class_stats(assignment_id: str) -> dict:
    """Agent: compute grade statistics from all graded submissions."""
    all_subs = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("assignmentId", "==", assignment_id)
    ).get()
    grades = [s.to_dict().get("grade") for s in all_subs if s.to_dict().get("grade") is not None]
    if not grades:
        return {}
    return {
        "mean": round(sum(grades) / len(grades), 1),
        "median": round(sorted(grades)[len(grades) // 2], 1),
        "count": len(grades),
    }


async def _retrieve_rag_for_grading(course_id: str, title: str, description: str) -> list:
    """Agent: RAG retrieval for assignment context."""
    if not course_id:
        return []
    return await rag_service.retrieve(
        f"{title} {description}", [course_id], top_k=3,
    )


@router.post("/recommend/{submission_id}")
async def recommend_grade(submission_id: str, user=Depends(require_lecturer)):
    set_tracking_context(user["id"], "grading")

    # Check cache
    existing = db.collection(models.AI_GRADE_RECOMMENDATIONS).where(
        filter=FieldFilter("submissionId", "==", submission_id)
    ).limit(1).get()
    if existing:
        return _rec_out(models.doc_to_dict(existing[0]))

    # ── Phase 1: Fan-out — fetch submission + assignment in parallel ─────────
    # We need submission to get assignmentId, then fan-out assignment/rubric,
    # class stats, and RAG in parallel.
    sub_result = await _fetch_submission(submission_id)
    if sub_result.get("_not_found"):
        raise HTTPException(404, "Submission not found")

    sub = sub_result["sub"]
    content = sub_result["content"]
    if not content or len(content.strip()) < 10:
        raise HTTPException(400, "Submission has insufficient content for AI grading")

    assignment_id = sub["assignmentId"]

    # ── Phase 2: Fan-out — assignment, stats, RAG all in parallel ────────────
    # We pre-fetch assignment to get courseId for RAG. To maximize parallelism
    # we fetch assignment+rubric, class stats, and kick off RAG simultaneously.
    # RAG needs courseId from assignment, so we use a two-wave fan-out:
    # Wave 1: assignment + stats (independent)
    # Wave 2: RAG (depends on courseId from wave 1)

    wave1 = await fan_out({
        "assignment": _fetch_assignment_and_rubric(assignment_id),
        "class_stats": _compute_class_stats(assignment_id),
    })

    assign_result = get_or_default(wave1, "assignment", {})
    if assign_result.get("_not_found"):
        raise HTTPException(404, "Assignment not found")

    assign = assign_result.get("assign", {})
    rubric_criteria = assign_result.get("rubric_criteria", [])
    class_stats = get_or_default(wave1, "class_stats", {})

    if assign.get("assignmentType") != "tutorial":
        raise HTTPException(400, "AI grading is only available for tutorial-type assignments")

    # Wave 2: RAG (needs courseId)
    rag_chunks = []
    try:
        rag_chunks = await _retrieve_rag_for_grading(
            assign.get("courseId", ""),
            assign.get("title", ""),
            assign.get("description", ""),
        )
    except Exception:
        pass

    # ── Synthesizer: GAG grading report ──────────────────────────────────────
    try:
        result = await gag_service.generate_grading_report(
            submission_content=content,
            rubric=rubric_criteria,
            rag_chunks=rag_chunks,
            assignment_info={
                "title": assign.get("title", ""),
                "description": assign.get("description", ""),
                "class_stats": class_stats,
            },
        )
    except Exception as e:
        raise HTTPException(502, f"AI grading failed: {str(e)}")

    # Store
    rec_id = models.gen_id()
    rec_data = {
        "submissionId": submission_id,
        "assignmentId": assignment_id,
        "recommendedGrade": result.get("recommended_grade", 0),
        "criterionScores": result.get("criterion_scores", {}),
        "justification": result.get("justification", ""),
        "confidence": result.get("confidence", 0),
        "comparativeAnalysis": result.get("comparative_analysis", ""),
        "improvementSuggestions": result.get("improvement_suggestions", []),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    db.collection(models.AI_GRADE_RECOMMENDATIONS).document(rec_id).set(rec_data)
    rec_data["id"] = rec_id

    return _rec_out(rec_data)


@router.get("/recommendation/{submission_id}")
async def get_recommendation(submission_id: str, user=Depends(require_lecturer)):
    docs = db.collection(models.AI_GRADE_RECOMMENDATIONS).where(filter=FieldFilter("submissionId", "==", submission_id
    )).limit(1).get()
    if not docs:
        return None
    return _rec_out(models.doc_to_dict(docs[0]))


async def _grade_single(submission_id: str, user_id: str) -> dict:
    """Grade a single submission. Returns result dict or error dict."""
    try:
        set_tracking_context(user_id, "grading")

        # Skip if already graded
        existing = db.collection(models.AI_GRADE_RECOMMENDATIONS).where(
            filter=FieldFilter("submissionId", "==", submission_id)
        ).limit(1).get()
        if existing:
            return {"submission_id": submission_id, **_rec_out(models.doc_to_dict(existing[0])), "_cached": True}

        sub_result = await _fetch_submission(submission_id)
        if sub_result.get("_not_found"):
            return {"submission_id": submission_id, "_error": "Submission not found"}

        sub = sub_result["sub"]
        content = sub_result["content"]
        if not content or len(content.strip()) < 10:
            return {"submission_id": submission_id, "_error": "Insufficient content"}

        assignment_id = sub["assignmentId"]
        wave1 = await fan_out({
            "assignment": _fetch_assignment_and_rubric(assignment_id),
            "class_stats": _compute_class_stats(assignment_id),
        })

        assign_result = get_or_default(wave1, "assignment", {})
        if assign_result.get("_not_found"):
            return {"submission_id": submission_id, "_error": "Assignment not found"}

        assign = assign_result.get("assign", {})
        rubric_criteria = assign_result.get("rubric_criteria", [])
        class_stats = get_or_default(wave1, "class_stats", {})

        rag_chunks = []
        try:
            rag_chunks = await _retrieve_rag_for_grading(
                assign.get("courseId", ""), assign.get("title", ""), assign.get("description", ""),
            )
        except Exception:
            pass

        result = await gag_service.generate_grading_report(
            submission_content=content, rubric=rubric_criteria, rag_chunks=rag_chunks,
            assignment_info={"title": assign.get("title", ""), "description": assign.get("description", ""), "class_stats": class_stats},
        )

        rec_id = models.gen_id()
        rec_data = {
            "submissionId": submission_id, "assignmentId": assignment_id,
            "recommendedGrade": result.get("recommended_grade", 0),
            "criterionScores": result.get("criterion_scores", {}),
            "justification": result.get("justification", ""),
            "confidence": result.get("confidence", 0),
            "comparativeAnalysis": result.get("comparative_analysis", ""),
            "improvementSuggestions": result.get("improvement_suggestions", []),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        db.collection(models.AI_GRADE_RECOMMENDATIONS).document(rec_id).set(rec_data)
        rec_data["id"] = rec_id
        return {"submission_id": submission_id, **_rec_out(rec_data)}
    except Exception as e:
        return {"submission_id": submission_id, "_error": str(e)}


@router.post("/recommend-batch/{assignment_id}")
async def recommend_batch(assignment_id: str, user=Depends(require_lecturer)):
    """Grade all submissions for an assignment in parallel using multi-agent fan-out."""
    set_tracking_context(user["id"], "grading")

    # Verify assignment exists
    assign_doc = db.collection(models.ASSIGNMENTS).document(assignment_id).get()
    if not assign_doc.exists:
        raise HTTPException(404, "Assignment not found")
    if assign_doc.to_dict().get("assignmentType") != "tutorial":
        raise HTTPException(400, "AI grading is only available for tutorial-type assignments")

    # Get all submissions
    sub_docs = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("assignmentId", "==", assignment_id)
    ).get()
    if not sub_docs:
        return {"assignment_id": assignment_id, "results": [], "total": 0}

    # Fan out grading for all submissions
    agents = {
        doc.id: _grade_single(doc.id, user["id"])
        for doc in sub_docs
    }
    results = await fan_out(agents, timeout=120.0)

    graded = []
    errors = []
    for sid, result in results.items():
        if isinstance(result, dict) and result.get("_error"):
            errors.append({"submission_id": sid, "error": result["_error"]})
        else:
            graded.append(result)

    return {
        "assignment_id": assignment_id,
        "total": len(sub_docs),
        "graded": len(graded),
        "errors": len(errors),
        "results": graded,
        "error_details": errors,
    }
