"""AI-powered grade recommendations for tutorial-type assignments — lecturer only.

Uses multi-agent fan-out for parallel data gathering:
  - submission_agent: fetch submission + extract content
  - assignment_agent: fetch assignment + rubric
  - stats_agent: compute class statistics from graded submissions
  - rag_agent: retrieve relevant course materials
All run concurrently, then results feed into a single GAG synthesizer call.
"""

import asyncio
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.firestore import db
from app.auth import require_lecturer
from app import models, grading
from app.authz import assert_assignment_owner
from app.ai_service import generate_json, get_knowledge_base, set_tracking_context
from app import rag_service, gag_service
from app.audit import audit_log
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
        "criteria_detail": d.get("criteriaDetail", []),
        "justification": d.get("justification", ""),
        "confidence": d.get("confidence", 0),
        "score_spread": d.get("scoreSpread", 0),
        "needs_review": d.get("needsReview", False),
        "samples": d.get("samples", 1),
        "method": d.get("method", ""),
        "reviewed": d.get("reviewed", False),
        "created_at": d.get("createdAt"),
    }
    # Include GAG-enhanced fields if present
    if d.get("comparativeAnalysis"):
        out["comparative_analysis"] = d["comparativeAnalysis"]
    if d.get("improvementSuggestions"):
        out["improvement_suggestions"] = d["improvementSuggestions"]
    return out


async def _synthesize_recommendation(
    content: str,
    rubric_criteria: list[dict],
    rag_chunks: list,
    assignment_info: dict,
    reference_answer: str = "",
) -> dict:
    """Self-consistency synthesis: grade the submission several times and
    aggregate into one calibrated, rubric-enforced recommendation.

    Confidence is derived from the agreement between samples (not self-reported),
    and the deterministic total is computed from the median per-criterion scores.
    """
    criteria = grading.normalize_criteria(rubric_criteria)
    n = max(1, int(os.getenv("GRADING_SC_SAMPLES", "3")))
    base_temp = float(os.getenv("GRADING_SC_TEMPERATURE", "0.5"))

    async def _one(i: int) -> dict:
        # Vary temperature slightly per sample to surface genuine disagreement.
        return await gag_service.grade_submission_once(
            content, criteria, rag_chunks, assignment_info, reference_answer,
            temperature=min(0.9, base_temp + i * 0.1),
        )

    raw = await asyncio.gather(*[_one(i) for i in range(n)], return_exceptions=True)
    samples = [s for s in raw if isinstance(s, dict) and s.get("criteria")]
    if not samples:
        raise RuntimeError("Grader produced no valid samples")

    agg = grading.aggregate_samples(samples, criteria)
    agg["method"] = f"rubric-decomposed · self-consistency (n={agg['samples']})" + (
        " · reference-guided" if reference_answer else ""
    )
    return agg


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

    # Optional reference answer / marking scheme for reference-guided grading.
    reference_answer = (
        assign.get("referenceAnswer")
        or assign.get("modelAnswer")
        or assign.get("markingScheme")
        or ""
    )

    return {"assign": assign, "rubric_criteria": rubric_criteria, "reference_answer": reference_answer}


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
    # Object-level authz: requester must own the parent assignment's course.
    assert_assignment_owner(db, sub.get("assignmentId", ""), user)
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
    reference_answer = assign_result.get("reference_answer", "")
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

    # ── Synthesizer: self-consistency, rubric-enforced grading ───────────────
    try:
        result = await _synthesize_recommendation(
            content, rubric_criteria, rag_chunks,
            {"title": assign.get("title", ""), "description": assign.get("description", ""), "class_stats": class_stats},
            reference_answer,
        )
    except Exception as e:
        raise HTTPException(502, f"AI grading failed: {str(e)}")

    rec_data = _store_recommendation(submission_id, assignment_id, result)
    return _rec_out(rec_data)


def _store_recommendation(submission_id: str, assignment_id: str, result: dict) -> dict:
    """Persist an aggregated recommendation and return the stored doc."""
    rec_id = models.gen_id()
    rec_data = {
        "submissionId": submission_id,
        "assignmentId": assignment_id,
        "recommendedGrade": result.get("recommended_grade", 0),
        "criterionScores": result.get("criterion_scores", {}),
        "criteriaDetail": result.get("criteria_detail", []),
        "justification": result.get("justification", ""),
        "confidence": result.get("confidence", 0),
        "scoreSpread": result.get("score_spread", 0),
        "needsReview": result.get("needs_review", False),
        "samples": result.get("samples", 1),
        "method": result.get("method", ""),
        "comparativeAnalysis": result.get("comparative_analysis", ""),
        "improvementSuggestions": result.get("improvement_suggestions", []),
        "reviewed": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    db.collection(models.AI_GRADE_RECOMMENDATIONS).document(rec_id).set(rec_data)
    rec_data["id"] = rec_id
    return rec_data


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
        reference_answer = assign_result.get("reference_answer", "")
        class_stats = get_or_default(wave1, "class_stats", {})

        rag_chunks = []
        try:
            rag_chunks = await _retrieve_rag_for_grading(
                assign.get("courseId", ""), assign.get("title", ""), assign.get("description", ""),
            )
        except Exception:
            pass

        result = await _synthesize_recommendation(
            content, rubric_criteria, rag_chunks,
            {"title": assign.get("title", ""), "description": assign.get("description", ""), "class_stats": class_stats},
            reference_answer,
        )

        rec_data = _store_recommendation(submission_id, assignment_id, result)
        return {"submission_id": submission_id, **_rec_out(rec_data)}
    except Exception as e:
        return {"submission_id": submission_id, "_error": str(e)}


@router.post("/recommend-batch/{assignment_id}")
async def recommend_batch(assignment_id: str, user=Depends(require_lecturer)):
    """Grade all submissions for an assignment in parallel using multi-agent fan-out."""
    set_tracking_context(user["id"], "grading")

    # Verify assignment exists + requester owns its course
    assert_assignment_owner(db, assignment_id, user)
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


# ── Human-in-the-loop: accept / override audit trail ─────────────────────────

class GradeReviewIn(BaseModel):
    submission_id: str
    ai_grade: float | None = None       # what the AI recommended (for calibration)
    final_grade: float                  # the grade the lecturer is committing
    action: str                         # "accepted" | "overridden"
    reason: str | None = None
    feedback: str | None = None
    apply: bool = True                   # also write the grade onto the submission


@router.post("/review")
async def review_recommendation(body: GradeReviewIn, user=Depends(require_lecturer)):
    """Record the lecturer's accept/override decision on an AI grade recommendation.

    This is the human-in-the-loop gate: the AI grade is never final until a
    lecturer confirms or overrides it. Each decision logs the AI-vs-human pair so
    agreement (QWK / MAE) can be measured over time, and optionally applies the
    final grade to the submission.
    """
    if body.action not in ("accepted", "overridden"):
        raise HTTPException(400, "action must be 'accepted' or 'overridden'")
    if not (0 <= body.final_grade <= 100):
        raise HTTPException(400, "final_grade must be between 0 and 100")

    sub_ref = db.collection(models.SUBMISSIONS).document(body.submission_id)
    sub_doc = sub_ref.get()
    if not sub_doc.exists:
        raise HTTPException(404, "Submission not found")
    sub = sub_doc.to_dict()
    assignment_id = sub.get("assignmentId", "")
    # Object-level authz: requester must own the parent assignment's course.
    assert_assignment_owner(db, assignment_id, user)

    reviewer_name = user.get("displayName") or user.get("name") or user.get("email") or "Lecturer"
    now = datetime.now(timezone.utc).isoformat()

    # One review per submission — overwrite any prior decision.
    doc_id = body.submission_id
    db.collection(models.GRADE_REVIEWS).document(doc_id).set({
        "submissionId": body.submission_id,
        "assignmentId": assignment_id,
        "studentId": sub.get("studentId", ""),
        "aiGrade": body.ai_grade,
        "finalGrade": body.final_grade,
        "action": body.action,
        "reason": body.reason or "",
        "reviewerId": user["id"],
        "reviewerName": reviewer_name,
        "reviewedAt": now,
    })

    # Mark the recommendation as reviewed (best-effort).
    recs = db.collection(models.AI_GRADE_RECOMMENDATIONS).where(
        filter=FieldFilter("submissionId", "==", body.submission_id)
    ).limit(1).get()
    if recs:
        recs[0].reference.update({"reviewed": True})

    # Apply the confirmed grade to the submission.
    if body.apply:
        update = {"grade": round(body.final_grade, 1)}
        if body.feedback is not None:
            update["feedback"] = body.feedback
        sub_ref.update(update)

    audit_log(db, user["id"], "ai_grade_review", "submission", body.submission_id,
              details=f"action={body.action} ai={body.ai_grade} final={body.final_grade}")

    return {"ok": True, "submission_id": body.submission_id, "action": body.action, "final_grade": body.final_grade}


@router.get("/calibration/{assignment_id}")
async def grading_calibration(assignment_id: str, user=Depends(require_lecturer)):
    """Validity evidence: how well AI recommendations agree with the lecturer's
    confirmed grades for this assignment (Quadratic Weighted Kappa + MAE +
    exact/adjacent agreement). This turns 'trust the AI' into a measured claim."""
    assert_assignment_owner(db, assignment_id, user)
    reviews = db.collection(models.GRADE_REVIEWS).where(
        filter=FieldFilter("assignmentId", "==", assignment_id)
    ).get()

    human: list[float] = []
    ai: list[float] = []
    overrides = 0
    for r in reviews:
        d = r.to_dict()
        if d.get("action") == "overridden":
            overrides += 1
        ag = d.get("aiGrade")
        fg = d.get("finalGrade")
        if ag is not None and fg is not None:
            human.append(float(fg))
            ai.append(float(ag))

    total = len(list(reviews)) if not isinstance(reviews, list) else len(reviews)
    qwk = grading.quadratic_weighted_kappa(human, ai)
    agreement = grading.grade_agreement(human, ai)

    return {
        "assignment_id": assignment_id,
        "reviewed_count": len(human),
        "override_count": overrides,
        "qwk": qwk,
        **agreement,
    }
