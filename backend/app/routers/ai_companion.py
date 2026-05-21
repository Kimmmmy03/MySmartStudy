"""AI Study Companion — floating chat for students.

Uses multi-agent fan-out for parallel context gathering:
  - courses_agent: enrolled courses list
  - deadlines_agent: upcoming assignments + quizzes with status
  - performance_agent: quiz scores + assignment grades + weak areas
  - timetable_agent: saved class timetables
  - reminders_agent: pending planner tasks
All run concurrently, reducing the 10+ sequential Firestore reads to
a single parallel wave.
"""

import asyncio
import hashlib
import json as json_lib
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.firestore import db
from app.auth import get_current_user
from app import models
from app.ai_service import chat_completion, generate_json, get_knowledge_base, set_tracking_context
from app import rag_service, rag_multistep
from app.multi_agent import fan_out, get_or_default
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/ai/companion", tags=["AI Companion"])


# ── Request / Response schemas ──

class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None  # {"page": "...", "course_id": "..."}


class LearningProfileUpdate(BaseModel):
    learning_style: str  # visual, auditory, reading, kinesthetic
    strengths: list[str] = []
    weaknesses: list[str] = []


# ── Helpers ──

async def _ctx_courses(user_id: str) -> dict:
    """Agent: enrolled courses → text + id list + id→name map."""
    course_docs = db.collection(models.COURSES).where(
        filter=FieldFilter("enrolledStudents", "array_contains", user_id)
    ).get()
    course_ids = []
    course_map: dict[str, str] = {}
    lines = []
    for doc in course_docs:
        c = doc.to_dict()
        name = c.get("courseName", "")
        code = c.get("courseCode", "")
        course_ids.append(doc.id)
        course_map[doc.id] = name
        lines.append(f"{name} ({code})")
    text = f"Enrolled courses: {', '.join(lines)}" if lines else ""
    return {"text": text, "course_ids": course_ids, "course_map": course_map}


async def _ctx_deadlines(user_id: str, now: str) -> dict:
    """Agent: upcoming assignments + quizzes with submission status."""
    course_docs = db.collection(models.COURSES).where(
        filter=FieldFilter("enrolledStudents", "array_contains", user_id)
    ).get()
    course_map = {doc.id: doc.to_dict().get("courseName", "") for doc in course_docs}

    assign_docs = db.collection(models.ASSIGNMENTS).get()
    upcoming = []
    for doc in assign_docs:
        a = doc.to_dict()
        if a.get("courseId") in course_map and a.get("deadline", "") >= now:
            subs = db.collection(models.SUBMISSIONS).where(
                filter=FieldFilter("assignmentId", "==", doc.id)
            ).where(filter=FieldFilter("studentId", "==", user_id)).limit(1).get()
            status = "submitted" if subs else "pending"
            cname = course_map.get(a.get("courseId", ""), "")
            upcoming.append(f"- {a.get('title', '')} ({cname}) due {a.get('deadline', '')} [{status}]")

    quiz_docs = db.collection(models.QUIZZES).get()
    quiz_items = []
    for doc in quiz_docs:
        q = doc.to_dict()
        if q.get("courseId") in course_map and (q.get("deadline") or "9999") >= now:
            attempts = db.collection(models.QUIZ_ATTEMPTS).where(
                filter=FieldFilter("quizId", "==", doc.id)
            ).where(filter=FieldFilter("studentId", "==", user_id)).limit(1).get()
            status = "completed" if attempts else "not attempted"
            cname = course_map.get(q.get("courseId", ""), "")
            quiz_items.append(f"- {q.get('title', '')} ({cname}) deadline {q.get('deadline', 'none')} [{status}]")

    parts = []
    if upcoming:
        parts.append("Upcoming deadlines:\n" + "\n".join(upcoming[:10]))
    if quiz_items:
        parts.append("Upcoming quizzes:\n" + "\n".join(quiz_items[:10]))
    return {"text": "\n".join(parts)}


async def _ctx_performance(user_id: str) -> dict:
    """Agent: quiz scores + assignment grades + weak topics."""
    quiz_attempts = db.collection(models.QUIZ_ATTEMPTS).where(
        filter=FieldFilter("studentId", "==", user_id)
    ).limit(20).get()
    scores = []
    weak_topics = []
    for att_doc in quiz_attempts:
        att = att_doc.to_dict()
        pct = att.get("percentage", 0)
        scores.append(f"- {att.get('quizTitle', att.get('quizId', ''))} : {pct}%")
        if pct < 60:
            weak_topics.append(att.get("quizTitle", ""))

    graded_subs = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("studentId", "==", user_id)
    ).limit(30).get()
    grades = []
    for sub_doc in graded_subs:
        sub = sub_doc.to_dict()
        grade = sub.get("grade")
        if grade is not None:
            assign_doc = db.collection(models.ASSIGNMENTS).document(sub.get("assignmentId", "")).get()
            if assign_doc.exists:
                a = assign_doc.to_dict()
                grades.append(f"- {a.get('title', '')}: {grade}/100")
                if grade < 60:
                    weak_topics.append(a.get("title", ""))

    parts = []
    if scores:
        parts.append("Quiz scores:\n" + "\n".join(scores[:10]))
    if grades:
        parts.append("Assignment grades:\n" + "\n".join(grades[:10]))
    if weak_topics:
        parts.append(f"Weak areas (scored < 60%): {', '.join(set(weak_topics))}")
    return {"text": "\n".join(parts)}


async def _ctx_timetables(user_id: str) -> dict:
    """Agent: saved timetables."""
    tt_docs = db.collection(models.SAVED_TIMETABLES).where(
        filter=FieldFilter("userId", "==", user_id)
    ).get()
    parts = []
    for tt_doc in tt_docs:
        tt = tt_doc.to_dict()
        schedule = tt.get("parsed_schedule", [])
        if schedule:
            label = tt.get("semesterLabel", "Current")
            lines = [f"Class timetable ({label}):"]
            for day_entry in schedule:
                day = day_entry.get("day", "")
                for cls in day_entry.get("classes", []):
                    loc = f" ({cls['location']})" if cls.get("location") else ""
                    lines.append(f"  - {day} {cls.get('time', '')} — {cls.get('subject', '')}{loc}")
            study_times = tt.get("recommended_study_times", [])
            if study_times:
                lines.append("  Recommended study times:")
                for slot in study_times:
                    lines.append(f"    - {slot.get('day', '')} {slot.get('time', '')} ({slot.get('duration_minutes', 0)} min)")
            parts.append("\n".join(lines))
    return {"text": "\n".join(parts)}


async def _ctx_reminders(user_id: str) -> dict:
    """Agent: pending reminders / tasks."""
    rem_docs = db.collection(models.REMINDERS).where(
        filter=FieldFilter("ownerId", "==", user_id)
    ).where(filter=FieldFilter("isCompleted", "==", False)).limit(5).get()
    reminders = [doc.to_dict().get("title", "") for doc in rem_docs]
    text = f"Pending tasks: {', '.join(reminders)}" if reminders else ""
    return {"text": text}


async def _ctx_reflections(user_id: str) -> dict:
    """Agent: recent weekly self-reflections → confidence trend + latest notes.

    Surfaces self-reported signals the other agents can't see (confidence,
    open-ended wins/challenges). Used by the companion to personalise tone.
    """
    ref_docs = db.collection(models.REFLECTIONS).where(
        filter=FieldFilter("ownerId", "==", user_id)
    ).order_by("createdAt", direction="DESCENDING").limit(3).get()

    entries = [doc.to_dict() for doc in ref_docs]
    if not entries:
        return {"text": ""}

    confidences = [int(e.get("confidence", 0) or 0) for e in entries if e.get("confidence")]
    avg = round(sum(confidences) / len(confidences), 1) if confidences else 0

    latest = entries[0]
    latest_notes = (latest.get("notes") or "").strip()
    if len(latest_notes) > 220:
        latest_notes = latest_notes[:220] + "…"
    latest_label = latest.get("weekLabel", "recent week")

    lines = [f"Recent self-reflection: avg confidence {avg}/5 over last {len(entries)} entries."]
    if latest_notes:
        lines.append(f"Latest ({latest_label}): {latest_notes}")
    return {"text": "\n".join(lines)}


async def _get_student_context(user_id: str) -> tuple[str, list[str]]:
    """Gather comprehensive student metadata via multi-agent fan-out.

    Returns (context_text, course_ids).
    All 6 data agents run in parallel — typically 3-5x faster than sequential.
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    results = await fan_out({
        "courses":     _ctx_courses(user_id),
        "deadlines":   _ctx_deadlines(user_id, now),
        "performance": _ctx_performance(user_id),
        "timetables":  _ctx_timetables(user_id),
        "reminders":   _ctx_reminders(user_id),
        "reflections": _ctx_reflections(user_id),
    })

    courses_data = get_or_default(results, "courses", {"text": "", "course_ids": [], "course_map": {}})
    course_ids = courses_data.get("course_ids", [])

    # Merge text parts from all agents
    parts = []
    for key in ["courses", "deadlines", "performance", "timetables", "reminders", "reflections"]:
        data = get_or_default(results, key, {})
        text = data.get("text", "") if isinstance(data, dict) else ""
        if text:
            parts.append(text)

    context = "\n".join(parts) if parts else "No additional context available."
    return context, course_ids


# ── Planning-intent detection + delegation ────────────────────────────────────
# The companion should give chat-fast answers (~2s).  But some questions are
# really requests for a STRUCTURED STUDY PLAN — for which we already have a
# better, GAG-based feature (generate_study_plan_artifact).
#
# Rather than spinning up a slow multi-agent crew inside the chat (which would
# be the wrong tool — see REFACTOR_PLAN.md), we detect those requests with a
# free keyword heuristic and DELEGATE to the existing study-plan feature,
# then return its output formatted as a chat reply.
#
# Trade-off chosen on purpose:
#   - Keyword classifier is FREE (zero LLM tokens) and INSTANT.
#   - The cost of a false positive (chat treats a non-planning Q as a planning
#     request) is just "the answer looks like a study plan instead of free
#     text" — not broken behaviour. Worst case: the student rephrases.
#   - The cost of a false negative is zero — it just falls through to normal
#     chat handling.

_PLAN_KEYWORDS = (
    "study plan", "study schedule", "revision plan", "revision schedule",
    "plan my", "plan for me", "schedule my", "schedule for me",
    "what should i study", "what should i revise", "what to study", "what to revise",
    "plan my week", "plan my day", "plan my revision",
)


def _looks_like_planning_request(message: str) -> bool:
    """True when the user's message reads like a study-plan request.

    Deliberately conservative — favours falling through to normal chat over
    accidentally hijacking a question (false negative is free, false positive
    costs the user a re-phrase).
    """
    if not message:
        return False
    msg = message.lower()
    return any(kw in msg for kw in _PLAN_KEYWORDS)


def _format_study_plan_for_chat(plan: dict) -> str:
    """Render a study-plan artifact dict (from generate_study_plan_artifact)
    as a friendly chat-shaped string the companion can return verbatim."""
    if not plan or not isinstance(plan, dict):
        return ""

    lines: list[str] = ["Here's a personalised study plan for you 📚\n"]

    for i, rec in enumerate(plan.get("recommendations", []) or [], 1):
        course = rec.get("course", "")
        topic = rec.get("topic", "")
        time = rec.get("suggested_time", "")
        prio = rec.get("priority", "")
        difficulty = rec.get("difficulty_rating", 0)
        est = rec.get("estimated_time", "")
        reason = rec.get("reason", "")

        header = f"**{i}. {topic}**" + (f" ({course})" if course else "")
        meta_bits = [b for b in (time, est, f"priority: {prio}" if prio else "",
                                  f"difficulty: {difficulty}/5" if difficulty else "") if b]
        if meta_bits:
            header += " — " + " · ".join(meta_bits)
        lines.append(header)
        if reason:
            lines.append(f"  {reason}")
        activities = rec.get("suggested_activities") or []
        for act in activities[:3]:
            lines.append(f"  • {act}")
        lines.append("")

    summary = plan.get("daily_schedule_summary")
    if summary:
        lines.append(summary)
    motivation = plan.get("motivational_message")
    if motivation:
        lines.append(f"\n{motivation}")

    return "\n".join(lines).strip()


async def _try_delegate_to_study_plan(
    message: str, user_id: str, user_display_name: str, course_ids: list[str],
) -> tuple[str, list[dict]] | None:
    """If the message looks like a planning request, run the existing study-plan
    feature and return (formatted_text, sources).  Returns None otherwise so the
    caller falls through to normal chat handling.

    Errors swallowed silently — a delegation failure must never break the chat.
    """
    if not _looks_like_planning_request(message):
        return None
    try:
        from app import gag_service
        from datetime import datetime, timezone

        # Light RAG so the plan cites real course material
        rag_chunks = []
        if course_ids:
            try:
                rag_chunks, _ = await rag_multistep.retrieve_multistep(
                    message, course_ids, top_k=3,
                )
            except Exception:
                pass

        student_context = {
            "name": user_display_name or "Student",
            "today": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "weak_topics": [],
            "quiz_scores": [],
            "timetables": [],
        }

        plan = await gag_service.generate_study_plan_artifact(
            student_context=student_context,
            rag_chunks=rag_chunks,
            deadlines=[],
        )
        text = _format_study_plan_for_chat(plan)
        if not text:
            return None
        sources = rag_service.format_citations(rag_chunks) if rag_chunks else []
        return text, sources
    except Exception as e:
        # Never propagate — fall through to normal chat
        import logging
        logging.getLogger(__name__).warning("Study-plan delegation failed: %s", e)
        return None


# ── Endpoints ──

@router.post("/chat")
async def chat(req: ChatRequest, user=Depends(get_current_user)):
    if user.get("role") != "student":
        raise HTTPException(403, "AI companion is for students only")

    user_id = user["id"]
    set_tracking_context(user_id, "companion")

    # Load learning profile
    profile_docs = db.collection(models.LEARNING_PROFILES).where(filter=FieldFilter(
        "userId", "==", user_id
    )).limit(1).get()
    learning_style = "general"
    if profile_docs:
        lp = profile_docs[0].to_dict()
        learning_style = lp.get("learningStyle", "general")

    # Load chat history (last 20 messages)
    history_docs = db.collection(models.AI_CHAT_HISTORY).where(filter=FieldFilter(
        "userId", "==", user_id
    )).order_by("createdAt", direction="DESCENDING").limit(1).get()

    messages = []
    history_id = None
    if history_docs:
        h = history_docs[0].to_dict()
        history_id = history_docs[0].id
        messages = h.get("messages", [])[-12:]

    # Build system instruction with context + RAG
    student_context, course_ids = _get_student_context(user_id)

    # ── Planning-intent delegation ──
    # "Plan my week" / "what should I study?" etc. → reuse the existing
    # structured study-plan feature instead of free-text chat. This keeps the
    # response feature-rich AND chat-fast (single GAG call, no multi-agent
    # crew inside the chat path).
    delegated = await _try_delegate_to_study_plan(
        req.message, user_id, user.get("displayName", ""), course_ids,
    )
    if delegated is not None:
        text, delegated_sources = delegated
        # Persist as a normal chat turn so the conversation history stays clean
        now = datetime.now(timezone.utc).isoformat()
        messages.append({"role": "user", "content": req.message, "timestamp": now})
        messages.append({"role": "model", "content": text, "timestamp": now})
        messages = messages[-15:]
        if history_id:
            db.collection(models.AI_CHAT_HISTORY).document(history_id).update({
                "messages": messages, "lastMessageAt": now,
            })
        else:
            history_id = models.gen_id()
            db.collection(models.AI_CHAT_HISTORY).document(history_id).set({
                "userId": user_id, "messages": messages,
                "createdAt": now, "lastMessageAt": now,
            })
        return {"response": text, "sources": delegated_sources, "_delegated": "study_plan"}

    # RAG: retrieve relevant course content for the student's message
    rag_chunks = []
    rag_context = ""
    sources = []
    try:
        if course_ids:
            rag_chunks, _sub_qs = await rag_multistep.retrieve_multistep(
                req.message, course_ids, top_k=3,
            )
            if rag_chunks:
                rag_context = rag_service.format_context(rag_chunks)
                sources = rag_service.format_citations(rag_chunks)
    except Exception:
        pass  # RAG failure should not block the companion

    system_prompt = (
        f"{get_knowledge_base('rag_companion')}\n\n"
        "IMPORTANT: NEVER repeat or echo the student's message. Always provide a helpful, original response.\n\n"
        f"Student name: {user.get('displayName', 'Student')}\n"
        f"Learning style: {learning_style}\n"
        f"Current page: {req.context.get('page', 'unknown') if req.context else 'unknown'}\n\n"
        f"Student metadata:\n{student_context}\n\n"
        f"RETRIEVED COURSE MATERIALS (use these to ground your answers):\n{rag_context}"
    )

    # ── Global question cache (only for non-course-specific questions) ────────
    # When no RAG chunks were found, the answer is general knowledge and safe to
    # share across users. Cache it for 7 days to avoid duplicate Gemini calls.
    q_hash: str | None = None
    if not rag_chunks:
        q_key = re.sub(r'\s+', ' ', req.message.strip().lower())
        q_hash = hashlib.sha256(q_key.encode()).hexdigest()[:32]
        try:
            cached_doc = db.collection(models.AI_COMPANION_QUESTION_CACHE).document(q_hash).get()
            if cached_doc.exists:
                cached_data = cached_doc.to_dict()
                created = datetime.fromisoformat(cached_data.get("createdAt", "2000-01-01"))
                if datetime.now(timezone.utc) - created <= timedelta(days=7):
                    return {"response": cached_data["reply"], "sources": [], "_cached": True}
        except Exception:
            pass  # Cache read failure is non-fatal

    # Format messages for Gemini
    gemini_messages = []
    for m in messages:
        gemini_messages.append({
            "role": m["role"],
            "parts": [m["content"]],
        })
    gemini_messages.append({"role": "user", "parts": [req.message]})

    try:
        response = await chat_completion(
            gemini_messages,
            system_instruction=system_prompt,
            temperature=0.7,
        )
    except Exception as e:
        raise HTTPException(502, f"AI companion error: {str(e)}")

    # Save to global question cache if this was a non-course-specific question
    if q_hash:
        try:
            db.collection(models.AI_COMPANION_QUESTION_CACHE).document(q_hash).set({
                "qHash": q_hash,
                "question": req.message.strip(),
                "reply": response,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass  # Cache write failure is non-fatal

    # Update history
    now = datetime.now(timezone.utc).isoformat()
    messages.append({"role": "user", "content": req.message, "timestamp": now})
    messages.append({"role": "model", "content": response, "timestamp": now})

    # Keep only last 15 messages
    messages = messages[-15:]

    if history_id:
        db.collection(models.AI_CHAT_HISTORY).document(history_id).update({
            "messages": messages,
            "lastMessageAt": now,
        })
    else:
        history_id = models.gen_id()
        db.collection(models.AI_CHAT_HISTORY).document(history_id).set({
            "userId": user_id,
            "messages": messages,
            "createdAt": now,
            "lastMessageAt": now,
        })

    return {"response": response, "sources": sources}


@router.post("/chat-stream")
async def chat_stream(req: ChatRequest, user=Depends(get_current_user)):
    """SSE streaming variant of /chat. Streams words with ~30ms delay, then a final
    'done' event with sources and history update.

    Event format: ``data: {"type": "token", "text": "word "}\n\n``
    Final event: ``data: {"type": "done", "sources": [...]}\n\n``
    """
    if user.get("role") != "student":
        raise HTTPException(403, "AI companion is for students only")

    user_id = user["id"]
    set_tracking_context(user_id, "companion")

    # Load learning profile
    profile_docs = db.collection(models.LEARNING_PROFILES).where(filter=FieldFilter(
        "userId", "==", user_id
    )).limit(1).get()
    learning_style = "general"
    if profile_docs:
        learning_style = profile_docs[0].to_dict().get("learningStyle", "general")

    # Load chat history
    history_docs = db.collection(models.AI_CHAT_HISTORY).where(filter=FieldFilter(
        "userId", "==", user_id
    )).order_by("createdAt", direction="DESCENDING").limit(1).get()

    messages = []
    history_id = None
    if history_docs:
        h = history_docs[0].to_dict()
        history_id = history_docs[0].id
        messages = h.get("messages", [])[-12:]

    # Context + RAG
    student_context, course_ids = _get_student_context(user_id)

    # ── Planning-intent delegation (same as /chat) ──
    delegated = await _try_delegate_to_study_plan(
        req.message, user_id, user.get("displayName", ""), course_ids,
    )
    if delegated is not None:
        text, delegated_sources = delegated
        now = datetime.now(timezone.utc).isoformat()
        messages.append({"role": "user", "content": req.message, "timestamp": now})
        messages.append({"role": "model", "content": text, "timestamp": now})
        messages = messages[-15:]
        if history_id:
            db.collection(models.AI_CHAT_HISTORY).document(history_id).update({
                "messages": messages, "lastMessageAt": now,
            })
        else:
            history_id = models.gen_id()
            db.collection(models.AI_CHAT_HISTORY).document(history_id).set({
                "userId": user_id, "messages": messages,
                "createdAt": now, "lastMessageAt": now,
            })

        async def _stream_delegated():
            words = text.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json_lib.dumps({'type': 'token', 'text': token})}\n\n"
                await asyncio.sleep(0.03)
            done_payload = {
                "type": "done",
                "sources": delegated_sources,
                "_delegated": "study_plan",
            }
            yield f"data: {json_lib.dumps(done_payload)}\n\n"

        return StreamingResponse(_stream_delegated(), media_type="text/event-stream")

    rag_chunks = []
    rag_context = ""
    sources = []
    try:
        if course_ids:
            rag_chunks, _ = await rag_multistep.retrieve_multistep(req.message, course_ids, top_k=3)
            if rag_chunks:
                rag_context = rag_service.format_context(rag_chunks)
                sources = rag_service.format_citations(rag_chunks)
    except Exception:
        pass

    system_prompt = (
        f"{get_knowledge_base('rag_companion')}\n\n"
        "IMPORTANT: NEVER repeat or echo the student's message. Always provide a helpful, original response.\n\n"
        f"Student name: {user.get('displayName', 'Student')}\n"
        f"Learning style: {learning_style}\n"
        f"Current page: {req.context.get('page', 'unknown') if req.context else 'unknown'}\n\n"
        f"Student metadata:\n{student_context}\n\n"
        f"RETRIEVED COURSE MATERIALS (use these to ground your answers):\n{rag_context}"
    )

    gemini_messages = [{"role": m["role"], "parts": [m["content"]]} for m in messages]
    gemini_messages.append({"role": "user", "parts": [req.message]})

    try:
        full_response = await chat_completion(gemini_messages, system_instruction=system_prompt, temperature=0.7)
    except Exception as e:
        raise HTTPException(502, f"AI companion error: {str(e)}")

    # Update history
    now = datetime.now(timezone.utc).isoformat()
    messages.append({"role": "user", "content": req.message, "timestamp": now})
    messages.append({"role": "model", "content": full_response, "timestamp": now})
    messages = messages[-15:]

    if history_id:
        db.collection(models.AI_CHAT_HISTORY).document(history_id).update({
            "messages": messages, "lastMessageAt": now,
        })
    else:
        history_id = models.gen_id()
        db.collection(models.AI_CHAT_HISTORY).document(history_id).set({
            "userId": user_id, "messages": messages, "createdAt": now, "lastMessageAt": now,
        })

    async def _stream():
        words = full_response.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json_lib.dumps({'type': 'token', 'text': token})}\n\n"
            await asyncio.sleep(0.03)
        yield f"data: {json_lib.dumps({'type': 'done', 'sources': sources})}\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


@router.get("/history")
async def get_history(user=Depends(get_current_user)):
    user_id = user["id"]
    docs = db.collection(models.AI_CHAT_HISTORY).where(filter=FieldFilter(
        "userId", "==", user_id
    )).order_by("createdAt", direction="DESCENDING").limit(1).get()

    if not docs:
        return {"messages": []}

    h = docs[0].to_dict()
    return {"messages": h.get("messages", [])}


@router.delete("/history")
async def clear_history(user=Depends(get_current_user)):
    user_id = user["id"]
    docs = db.collection(models.AI_CHAT_HISTORY).where(filter=FieldFilter(
        "userId", "==", user_id
    )).get()
    for doc in docs:
        doc.reference.delete()
    return {"ok": True}


@router.get("/learning-profile")
async def get_learning_profile(user=Depends(get_current_user)):
    user_id = user["id"]
    docs = db.collection(models.LEARNING_PROFILES).where(filter=FieldFilter(
        "userId", "==", user_id
    )).limit(1).get()
    if not docs:
        return None
    d = models.doc_to_dict(docs[0])
    return {
        "id": d["id"],
        "learning_style": d.get("learningStyle", "general"),
        "strengths": d.get("strengths", []),
        "weaknesses": d.get("weaknesses", []),
    }


@router.post("/learning-profile")
async def update_learning_profile(req: LearningProfileUpdate, user=Depends(get_current_user)):
    user_id = user["id"]
    docs = db.collection(models.LEARNING_PROFILES).where(filter=FieldFilter(
        "userId", "==", user_id
    )).limit(1).get()

    data = {
        "userId": user_id,
        "learningStyle": req.learning_style,
        "strengths": req.strengths,
        "weaknesses": req.weaknesses,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    if docs:
        docs[0].reference.update(data)
    else:
        doc_id = models.gen_id()
        db.collection(models.LEARNING_PROFILES).document(doc_id).set(data)

    return {"ok": True, "learning_style": req.learning_style}


@router.post("/assess-style")
async def assess_learning_style(user=Depends(get_current_user)):
    """Return a learning style assessment quiz for the student."""
    questions = [
        {
            "id": "q1",
            "text": "When learning something new, I prefer to:",
            "options": [
                {"value": "visual", "text": "See diagrams, charts, or videos"},
                {"value": "auditory", "text": "Listen to explanations or discussions"},
                {"value": "reading", "text": "Read textbooks or written notes"},
                {"value": "kinesthetic", "text": "Try hands-on activities or experiments"},
            ],
        },
        {
            "id": "q2",
            "text": "I remember information best when I:",
            "options": [
                {"value": "visual", "text": "Visualise it with colours and images"},
                {"value": "auditory", "text": "Repeat it out loud or discuss it"},
                {"value": "reading", "text": "Write it down multiple times"},
                {"value": "kinesthetic", "text": "Practice or apply it physically"},
            ],
        },
        {
            "id": "q3",
            "text": "During a lecture, I pay most attention when:",
            "options": [
                {"value": "visual", "text": "The lecturer uses slides with visuals"},
                {"value": "auditory", "text": "The lecturer explains clearly by talking"},
                {"value": "reading", "text": "I can follow along with printed notes"},
                {"value": "kinesthetic", "text": "There are interactive activities"},
            ],
        },
        {
            "id": "q4",
            "text": "When solving a problem, I usually:",
            "options": [
                {"value": "visual", "text": "Draw it out or sketch a diagram"},
                {"value": "auditory", "text": "Talk through it with someone"},
                {"value": "reading", "text": "Look up references and read solutions"},
                {"value": "kinesthetic", "text": "Jump in and try different approaches"},
            ],
        },
        {
            "id": "q5",
            "text": "My ideal study environment includes:",
            "options": [
                {"value": "visual", "text": "Colourful notes, mind maps, and highlighters"},
                {"value": "auditory", "text": "Background music or study groups"},
                {"value": "reading", "text": "Quiet space with lots of books/notes"},
                {"value": "kinesthetic", "text": "A space where I can move around"},
            ],
        },
    ]
    return {"questions": questions}
