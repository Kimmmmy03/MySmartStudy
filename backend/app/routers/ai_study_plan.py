"""AI-powered study guide, exam planner, and timetable analysis.

Daily guide uses multi-agent fan-out for parallel data gathering:
  - courses_agent: enrolled courses
  - deadlines_agent: assignments + submission status + quizzes
  - performance_agent: quiz scores + assignment grades + weak topics
  - timetable_agent: saved timetables
All run concurrently, then RAG retrieval, then a single GAG synthesizer call.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional
from app.firestore import db
from app.auth import get_current_user
from app import models
from app.ai_service import generate_json, generate_text, get_knowledge_base, FAST_MODEL, set_tracking_context
from app import rag_service, gag_service
from app.multi_agent import fan_out, get_or_default
from datetime import datetime, timezone, timedelta
from google.cloud.firestore_v1.base_query import FieldFilter
import hashlib
import json as json_lib

router = APIRouter(prefix="/api/ai/study-plan", tags=["AI Study Plan"])


class ExamPlanRequest(BaseModel):
    exams: list[dict]  # [{"course_id": str, "course_name": str, "exam_date": str, "topics": [str]}]


class TimetableRequest(BaseModel):
    timetable_text: str


# ── Daily Guide data-gathering agents ──


async def _agent_courses(user_id: str) -> dict:
    """Fetch enrolled courses. Returns {id: name} map + list of IDs."""
    course_docs = db.collection(models.COURSES).where(
        filter=FieldFilter("enrolledStudents", "array_contains", user_id)
    ).get()
    courses = {}
    course_ids = []
    for doc in course_docs:
        c = doc.to_dict()
        courses[doc.id] = c.get("courseName", "")
        course_ids.append(doc.id)
    return {"courses": courses, "course_ids": course_ids}


async def _agent_deadlines(user_id: str, now: str) -> list:
    """Fetch upcoming assignment deadlines + quiz deadlines with submission status."""
    # Pre-fetch all assignments and quizzes — cheaper than per-course queries
    assign_docs = db.collection(models.ASSIGNMENTS).get()
    quiz_docs = db.collection(models.QUIZZES).get()

    # Get user's enrolled course IDs (need for filtering)
    course_docs = db.collection(models.COURSES).where(
        filter=FieldFilter("enrolledStudents", "array_contains", user_id)
    ).get()
    courses = {doc.id: doc.to_dict().get("courseName", "") for doc in course_docs}

    deadlines = []
    for doc in assign_docs:
        a = doc.to_dict()
        if a.get("courseId") in courses and a.get("deadline", "") >= now:
            subs = db.collection(models.SUBMISSIONS).where(
                filter=FieldFilter("assignmentId", "==", doc.id)
            ).where(
                filter=FieldFilter("studentId", "==", user_id)
            ).limit(1).get()
            deadlines.append({
                "title": a.get("title", ""),
                "course": courses.get(a.get("courseId"), ""),
                "deadline": a.get("deadline", ""),
                "status": "submitted" if subs else "pending",
            })

    for doc in quiz_docs:
        q = doc.to_dict()
        if q.get("courseId") in courses and (q.get("deadline") or "9999") >= now:
            attempts = db.collection(models.QUIZ_ATTEMPTS).where(
                filter=FieldFilter("quizId", "==", doc.id)
            ).where(
                filter=FieldFilter("studentId", "==", user_id)
            ).limit(1).get()
            deadlines.append({
                "title": q.get("title", ""),
                "course": courses.get(q.get("courseId"), ""),
                "deadline": q.get("deadline", ""),
                "status": "completed" if attempts else "not attempted",
                "type": "quiz",
            })
    return deadlines


async def _agent_performance(user_id: str) -> dict:
    """Fetch quiz scores + assignment grades, identify weak topics."""
    quiz_scores = []
    assignment_grades = []
    weak_topics = []

    # Quiz attempts
    quiz_attempts = db.collection(models.QUIZ_ATTEMPTS).where(
        filter=FieldFilter("studentId", "==", user_id)
    ).limit(20).get()
    for att_doc in quiz_attempts:
        att = att_doc.to_dict()
        quiz_scores.append({
            "quiz_title": att.get("quizTitle", att.get("quizId", "")),
            "course": "",  # filled by synthesizer if needed
            "percentage": att.get("percentage", 0),
        })
        if att.get("percentage", 100) < 60:
            weak_topics.append(att.get("quizTitle", ""))

    # Graded submissions
    graded_subs = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("studentId", "==", user_id)
    ).limit(30).get()
    for sub_doc in graded_subs:
        sub = sub_doc.to_dict()
        grade = sub.get("grade")
        if grade is not None:
            assign_doc = db.collection(models.ASSIGNMENTS).document(
                sub.get("assignmentId", "")
            ).get()
            if assign_doc.exists:
                a = assign_doc.to_dict()
                assignment_grades.append({
                    "title": a.get("title", ""),
                    "course": "",
                    "grade": grade,
                })
                if grade < 60:
                    weak_topics.append(a.get("title", ""))

    return {
        "quiz_scores": quiz_scores,
        "assignment_grades": assignment_grades,
        "weak_topics": weak_topics,
    }


async def _agent_timetables(user_id: str) -> list:
    """Fetch saved timetables."""
    tt_docs = db.collection(models.SAVED_TIMETABLES).where(
        filter=FieldFilter("userId", "==", user_id)
    ).get()
    saved = []
    for doc in tt_docs:
        d = doc.to_dict()
        if d.get("parsed_schedule"):
            saved.append({
                "semester_label": d.get("semesterLabel", ""),
                "parsed_schedule": d.get("parsed_schedule", []),
                "recommended_study_times": d.get("recommended_study_times", []),
            })
    return saved


async def _agent_reflections(user_id: str) -> dict:
    """Fetch recent weekly reflections → avg confidence + latest notes.

    Self-reported signals help the synthesizer weight its tone (encouraging vs.
    push) and flag topics the student said they struggled with.
    """
    ref_docs = db.collection(models.REFLECTIONS).where(
        filter=FieldFilter("ownerId", "==", user_id)
    ).order_by("createdAt", direction="DESCENDING").limit(3).get()

    entries = [doc.to_dict() for doc in ref_docs]
    if not entries:
        return {"avg_confidence": 0, "count": 0, "latest_notes": "", "latest_week": ""}

    confidences = [int(e.get("confidence", 0) or 0) for e in entries if e.get("confidence")]
    avg = round(sum(confidences) / len(confidences), 1) if confidences else 0
    latest = entries[0]
    latest_notes = (latest.get("notes") or "").strip()
    if len(latest_notes) > 300:
        latest_notes = latest_notes[:300] + "…"
    return {
        "avg_confidence": avg,
        "count": len(entries),
        "latest_notes": latest_notes,
        "latest_week": latest.get("weekLabel", ""),
    }


# ── Daily Guide endpoint ──

@router.get("/daily-guide")
async def daily_guide(
    user=Depends(get_current_user),
    refresh: bool = Query(False, description="Force regeneration, ignoring cache"),
):
    user_id = user["id"]
    set_tracking_context(user_id, "study_plan")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── Cache check (skip if refresh=true) ────────────────────────────────────
    cache_doc_id = f"{user_id}_{now}"
    if not refresh:
        cached = db.collection(models.AI_DAILY_GUIDE_CACHE).document(cache_doc_id).get()
        if cached.exists:
            data = cached.to_dict()
            result = data.get("guide")
            if result:
                result["_cached"] = True
                return result

    # ── Fan-out: all 5 data agents run in parallel ────────────────────────────
    agent_results = await fan_out({
        "courses":     _agent_courses(user_id),
        "deadlines":   _agent_deadlines(user_id, now),
        "performance": _agent_performance(user_id),
        "timetables":  _agent_timetables(user_id),
        "reflections": _agent_reflections(user_id),
    })

    courses_data = get_or_default(agent_results, "courses", {"courses": {}, "course_ids": []})
    courses = courses_data.get("courses", {})
    course_ids = courses_data.get("course_ids", [])
    deadlines = get_or_default(agent_results, "deadlines", [])
    perf = get_or_default(agent_results, "performance", {})
    quiz_scores = perf.get("quiz_scores", [])
    assignment_grades = perf.get("assignment_grades", [])
    weak_topics = perf.get("weak_topics", [])
    saved_timetables = get_or_default(agent_results, "timetables", [])
    reflections = get_or_default(
        agent_results, "reflections",
        {"avg_confidence": 0, "count": 0, "latest_notes": "", "latest_week": ""},
    )

    # ── RAG: retrieve relevant materials for weak areas ───────────────────────
    rag_chunks = []
    try:
        if course_ids:
            query = (
                f"study materials for {', '.join(weak_topics[:5])}"
                if weak_topics else "key course topics and study materials"
            )
            rag_chunks = await rag_service.retrieve(query, course_ids, top_k=5)
    except Exception:
        pass

    # ── Synthesizer: GAG study plan artifact ──────────────────────────────────
    student_context = {
        "name": user.get("displayName", "Student"),
        "today": now,
        "quiz_scores": quiz_scores[:10],
        "assignment_grades": assignment_grades[:10],
        "weak_topics": list(set(weak_topics))[:10],
        "timetables": saved_timetables,
        "reflections": reflections,
    }
    try:
        result = await gag_service.generate_study_plan_artifact(
            student_context=student_context,
            rag_chunks=rag_chunks,
            deadlines=deadlines,
        )
    except Exception:
        # Fallback: return structured data without AI narrative
        result = {
            "recommendations": [
                {
                    "course": d.get("course", ""),
                    "topic": d.get("title", ""),
                    "priority": "high" if d.get("status") == "pending" else "medium",
                    "reason": f"Due {d.get('deadline', 'soon')} — {d.get('status', 'pending')}",
                    "estimated_time": "1 hour",
                    "difficulty_rating": 3,
                    "resource_links": [],
                    "suggested_activities": ["Review materials", "Practice problems"],
                }
                for d in deadlines[:5] if d.get("status") != "submitted"
            ],
            "daily_schedule_summary": "AI generation unavailable. Showing upcoming deadlines as study priorities.",
            "motivational_message": "Keep going! Review your upcoming deadlines and tackle them one by one.",
            "fallback": True,
        }

    # ── Store in cache ────────────────────────────────────────────────────────
    try:
        db.collection(models.AI_DAILY_GUIDE_CACHE).document(cache_doc_id).set({
            "userId": user_id,
            "date": now,
            "guide": result,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    result["_cached"] = False
    return result


# ── Exam Plan ──

@router.post("/exam-plan")
async def create_exam_plan(req: ExamPlanRequest, user=Depends(get_current_user)):
    user_id = user["id"]
    set_tracking_context(user_id, "study_plan")

    # ── Cache check: same exams content → return stored plan ─────────────────
    exams_key = json_lib.dumps(
        sorted(req.exams, key=lambda e: (e.get("course_name", ""), e.get("exam_date", ""))),
        sort_keys=True,
    )
    exams_hash = hashlib.sha256(exams_key.encode()).hexdigest()[:24]
    cache_doc_id = f"{user_id}_{exams_hash}"

    cached = db.collection(models.AI_EXAM_PLAN_CACHE).document(cache_doc_id).get()
    if cached.exists:
        data = cached.to_dict()
        result = {"plan": data.get("plan", []), "tips": data.get("tips", []), "id": data.get("planId"), "_cached": True}
        return result

    exams_text = ""
    for exam in req.exams:
        topics = ", ".join(exam.get("topics", []))
        exams_text += f"- {exam.get('course_name', '')} on {exam.get('exam_date', '')}: Topics — {topics}\n"

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    prompt = f"""Create a detailed study plan for the following upcoming exams.
Distribute study sessions across the available days, prioritising weaker areas.
Include breaks and review sessions.

TODAY: {now}
STUDENT: {user.get('displayName', 'Student')}

EXAMS:
{exams_text}

Return JSON:
{{
  "plan": [
    {{
      "date": "<YYYY-MM-DD>",
      "sessions": [
        {{
          "course": "<course name>",
          "topic": "<topic to study>",
          "activity": "<e.g. Read notes, Practice problems, Review flashcards>",
          "duration_minutes": <int>
        }}
      ]
    }}
  ],
  "tips": ["<study tip 1>", "<study tip 2>", ...]
}}"""

    try:
        result = await generate_json(prompt, system_instruction=get_knowledge_base("study_plan"), model_name=FAST_MODEL)
    except Exception as e:
        raise HTTPException(502, f"AI planning failed: {str(e)}")

    # Store plan + write cache
    plan_id = models.gen_id()
    plan_data = {
        "userId": user_id,
        "exams": req.exams,
        "plan": result.get("plan", []),
        "tips": result.get("tips", []),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    db.collection(models.AI_STUDY_PLANS).document(plan_id).set(plan_data)
    try:
        db.collection(models.AI_EXAM_PLAN_CACHE).document(cache_doc_id).set({
            **plan_data,
            "planId": plan_id,
            "examsHash": exams_hash,
        })
    except Exception:
        pass  # Cache write failure is non-fatal

    result["id"] = plan_id
    result["_cached"] = False
    return result


@router.get("/exam-plans")
async def list_exam_plans(user=Depends(get_current_user)):
    docs = db.collection(models.AI_STUDY_PLANS).where(filter=FieldFilter(
        "userId", "==", user["id"]
    )).order_by("createdAt", direction="DESCENDING").limit(10).get()

    results = []
    for doc in docs:
        d = models.doc_to_dict(doc)
        results.append({
            "id": d["id"],
            "exams": d.get("exams", []),
            "plan": d.get("plan", []),
            "tips": d.get("tips", []),
            "created_at": d.get("createdAt"),
        })
    return results


@router.delete("/{plan_id}")
async def delete_plan(plan_id: str, user=Depends(get_current_user)):
    doc = db.collection(models.AI_STUDY_PLANS).document(plan_id).get()
    if not doc.exists:
        raise HTTPException(404, "Plan not found")
    if doc.to_dict().get("userId") != user["id"]:
        raise HTTPException(403, "Not your plan")
    doc.reference.delete()
    return {"ok": True}


# ── Timetable Extraction ──
# Extract schedule + recommend study times based on free gaps.
# Saving is a separate step — user labels the semester before saving.

TIMETABLE_PROMPT_TEMPLATE = """Parse this student's class timetable. Extract all classes with their day, time, subject, and location.
Then identify free periods between classes and recommend optimal study time slots.
Sort days in order: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
Sort classes within each day by start time (earliest first).

TIMETABLE:
\"\"\"
{timetable_text}
\"\"\"

Return JSON:
{{
  "parsed_schedule": [
    {{
      "day": "<Monday/Tuesday/...>",
      "classes": [
        {{"time": "<h:MM AM/PM - h:MM AM/PM>", "subject": "<course name>", "location": "<if mentioned>"}}
      ]
    }}
  ],
  "recommended_study_times": [
    {{
      "day": "<day>",
      "time": "<h:MM AM/PM - h:MM AM/PM>",
      "duration_minutes": <int>,
      "reason": "<why this slot is good, e.g. free gap between classes>"
    }}
  ]
}}"""


_TIMETABLE_TTL_DAYS = 30


def _timetable_cache_get(text_hash: str) -> dict | None:
    """Return cached timetable result if within TTL, else None."""
    doc = db.collection(models.AI_TIMETABLE_CACHE).document(text_hash).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    created = datetime.fromisoformat(data.get("createdAt", "2000-01-01"))
    if datetime.now(timezone.utc) - created > timedelta(days=_TIMETABLE_TTL_DAYS):
        return None
    return data.get("result")


def _timetable_cache_set(text_hash: str, result: dict) -> None:
    try:
        db.collection(models.AI_TIMETABLE_CACHE).document(text_hash).set({
            "result": result,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


@router.post("/timetable-analyze")
async def analyze_timetable(req: TimetableRequest, user=Depends(get_current_user)):
    set_tracking_context(user["id"], "study_plan")
    if not req.timetable_text or len(req.timetable_text.strip()) < 10:
        raise HTTPException(400, "Please provide your timetable text")

    text_hash = hashlib.sha256(req.timetable_text.strip().encode()).hexdigest()[:32]
    cached = _timetable_cache_get(text_hash)
    if cached:
        cached["_cached"] = True
        return cached

    prompt = TIMETABLE_PROMPT_TEMPLATE.format(timetable_text=req.timetable_text[:5000])

    try:
        result = await generate_json(prompt, system_instruction=get_knowledge_base("study_plan"), model_name=FAST_MODEL)
    except Exception as e:
        raise HTTPException(502, f"AI extraction failed: {str(e)}")

    _timetable_cache_set(text_hash, result)
    result["_cached"] = False
    return result


@router.post("/timetable-upload")
async def analyze_timetable_pdf(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Upload a PDF timetable, extract schedule + recommend study times."""
    set_tracking_context(user["id"], "study_plan")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5MB)")

    try:
        import PyPDF2
        import io
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        text_parts = []
        for page in reader.pages:
            text_parts.append(page.extract_text() or "")
        extracted_text = "\n".join(text_parts).strip()
    except Exception as e:
        raise HTTPException(400, f"Failed to read PDF: {str(e)}")

    if len(extracted_text) < 10:
        raise HTTPException(400, "Could not extract enough text from the PDF. Please ensure it is not a scanned image.")

    text_hash = hashlib.sha256(extracted_text.encode()).hexdigest()[:32]
    cached = _timetable_cache_get(text_hash)
    if cached:
        cached["_cached"] = True
        return cached

    prompt = TIMETABLE_PROMPT_TEMPLATE.format(timetable_text=extracted_text[:5000])

    try:
        result = await generate_json(prompt, system_instruction=get_knowledge_base("study_plan"), model_name=FAST_MODEL)
    except Exception as e:
        raise HTTPException(502, f"AI extraction failed: {str(e)}")

    _timetable_cache_set(text_hash, result)
    result["_cached"] = False
    return result


# ── Saved Timetables (CRUD) ──
# Users save timetables with a semester label. Multiple timetables allowed.
# All saved timetables feed into the Daily Guide.

class SaveTimetableRequest(BaseModel):
    semester_label: str  # e.g. "Semester 6 2025/2026"
    parsed_schedule: list[dict]
    recommended_study_times: list[dict] = []


@router.post("/timetables")
async def save_timetable(req: SaveTimetableRequest, user=Depends(get_current_user)):
    """Save a parsed timetable with a semester label."""
    user_id = user["id"]
    doc_id = models.gen_id()
    db.collection(models.SAVED_TIMETABLES).document(doc_id).set({
        "userId": user_id,
        "semesterLabel": req.semester_label,
        "parsed_schedule": req.parsed_schedule,
        "recommended_study_times": req.recommended_study_times,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "id": doc_id,
        "semester_label": req.semester_label,
        "parsed_schedule": req.parsed_schedule,
        "recommended_study_times": req.recommended_study_times,
    }


@router.get("/timetables")
async def list_timetables(user=Depends(get_current_user)):
    """List all saved timetables for the current user."""
    docs = db.collection(models.SAVED_TIMETABLES).where(filter=FieldFilter(
        "userId", "==", user["id"]
    )).order_by("createdAt", direction="DESCENDING").get()

    results = []
    for doc in docs:
        d = doc.to_dict()
        results.append({
            "id": doc.id,
            "semester_label": d.get("semesterLabel", ""),
            "parsed_schedule": d.get("parsed_schedule", []),
            "recommended_study_times": d.get("recommended_study_times", []),
            "created_at": d.get("createdAt"),
        })
    return results


@router.delete("/timetables/{timetable_id}")
async def delete_timetable(timetable_id: str, user=Depends(get_current_user)):
    """Delete a saved timetable."""
    doc = db.collection(models.SAVED_TIMETABLES).document(timetable_id).get()
    if not doc.exists:
        raise HTTPException(404, "Timetable not found")
    if doc.to_dict().get("userId") != user["id"]:
        raise HTTPException(403, "Not your timetable")
    doc.reference.delete()
    return {"ok": True}
