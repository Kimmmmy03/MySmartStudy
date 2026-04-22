"""
Central AI service module — wraps the Google Gemini API (google-genai SDK).
Every AI feature in the app calls through this module so the API key
lives in exactly one place and we get consistent error handling.
"""

import asyncio
import json
import logging
import os
import re
from contextvars import ContextVar

logger = logging.getLogger(__name__)
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ── Model constants ──
# Use SMART_MODEL for complex reasoning (study plans, grading, plagiarism, companion chat).
# Use FAST_MODEL for structured extraction and simple generation tasks (study materials,
# timetable parsing, course import) — roughly 10x cheaper per token.
# Both are env-configurable for cost/quality tuning.
SMART_MODEL = os.getenv("AI_SMART_MODEL", "gemini-2.5-flash")
FAST_MODEL  = os.getenv("AI_FAST_MODEL", "gemini-2.5-flash-lite")

# ── Token usage tracking via context vars ──
# Routers call set_tracking_context(user_id, feature) once per request.
# ai_service reads it after every Gemini response to log usage atomically.
_tracking_user: ContextVar[str] = ContextVar("tracking_user", default="")
_tracking_feature: ContextVar[str] = ContextVar("tracking_feature", default="")

# Default daily per-user token limit if `aiConfig/global` is not set.
# Tuned for Gemini 2.5 Flash (~$0.001/1K tokens blended): 50K/day = $0.05 worst
# case per user, with ~20-40 AI interactions headroom.
DEFAULT_DAILY_TOKEN_LIMIT = 50_000


def _today_key() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _get_daily_token_limit(user_id: str) -> int:
    """Resolve the daily token limit for a user: per-user override > global > default."""
    try:
        from .firestore import db
        from . import models as _m
        # Per-user override (aiUserSettings/{uid}.dailyTokenLimit)
        u_doc = db.collection(_m.AI_USER_SETTINGS).document(user_id).get()
        if u_doc.exists:
            override = u_doc.to_dict().get("dailyTokenLimit")
            if isinstance(override, int) and override >= 0:
                return override
        # Global config (aiConfig/global.dailyTokenLimit)
        g_doc = db.collection(_m.AI_CONFIG).document("global").get()
        if g_doc.exists:
            g = g_doc.to_dict().get("dailyTokenLimit")
            if isinstance(g, int) and g >= 0:
                return g
    except Exception as e:
        logger.debug("Token limit lookup failed, using default: %s", e)
    return DEFAULT_DAILY_TOKEN_LIMIT


def _get_tokens_used_today(user_id: str) -> int:
    try:
        from .firestore import db
        from . import models as _m
        doc = db.collection(_m.AI_DAILY_USAGE).document(f"{user_id}_{_today_key()}").get()
        if doc.exists:
            return int(doc.to_dict().get("total_tokens", 0) or 0)
    except Exception as e:
        logger.debug("Daily token lookup failed: %s", e)
    return 0


def set_tracking_context(user_id: str, feature: str) -> None:
    """Call at the start of any AI endpoint to tag subsequent Gemini calls for usage tracking.

    Also enforces the daily per-user token quota: raises HTTPException(429)
    when the user has already exceeded their limit for today.
    """
    _tracking_user.set(user_id)
    _tracking_feature.set(feature)

    # Enforce daily quota — skip if no user_id (unauthenticated background jobs)
    if not user_id:
        return
    try:
        limit = _get_daily_token_limit(user_id)
        if limit <= 0:
            return  # limit of 0 = unlimited by convention
        used = _get_tokens_used_today(user_id)
        if used >= limit:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Daily AI token limit reached ({used:,} / {limit:,} tokens used today). "
                    f"Resets at 00:00 UTC."
                ),
            )
    except Exception as e:
        # Re-raise FastAPI HTTPException so the client sees the 429
        from fastapi import HTTPException
        if isinstance(e, HTTPException):
            raise
        logger.debug("Quota check failed, allowing request: %s", e)


def _log_token_usage(total_tokens: int) -> None:
    """Atomically increment token usage counters in Firestore. Never raises."""
    user_id = _tracking_user.get()
    feature = _tracking_feature.get()
    if not user_id or not feature or total_tokens <= 0:
        return
    try:
        from google.cloud.firestore_v1 import Increment
        from .firestore import db
        from . import models as _m
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        # Lifetime summary (existing)
        db.collection(_m.AI_USAGE_SUMMARY).document(user_id).set({
            "userId": user_id,
            "updatedAt": now_iso,
            "total_calls": Increment(1),
            "total_tokens": Increment(total_tokens),
            f"{feature}_calls": Increment(1),
            f"{feature}_tokens": Increment(total_tokens),
        }, merge=True)
        # Daily counter (new) — used for quota enforcement
        db.collection(_m.AI_DAILY_USAGE).document(f"{user_id}_{_today_key()}").set({
            "userId": user_id,
            "date": _today_key(),
            "updatedAt": now_iso,
            "total_calls": Increment(1),
            "total_tokens": Increment(total_tokens),
            f"{feature}_tokens": Increment(total_tokens),
        }, merge=True)
    except Exception as e:
        logger.debug("Token usage logging failed: %s", e)


def safe_truncate(text: str, max_tokens: int = 6000) -> str:
    """Truncate text to approximately *max_tokens* tokens using the ~1.3 words/token heuristic.

    Safer than raw ``text[:N]`` slicing which can cut mid-word or mid-sentence
    and doesn't correlate with actual token budgets.
    """
    if not text:
        return text
    max_words = int(max_tokens * 1.3)
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])


# ── Configuration ──

_client: genai.Client | None = None


def configure_gemini():
    """Call once at app startup (in main.py lifespan)."""
    global _client
    if _client is not None:
        return
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
    _client = genai.Client(api_key=api_key)


def _get_client() -> genai.Client:
    if _client is None:
        configure_gemini()
    return _client  # type: ignore


# ── Safety settings (relaxed for educational content) ──

SAFETY = [
    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_ONLY_HIGH"),
    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_ONLY_HIGH"),
    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_ONLY_HIGH"),
    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_ONLY_HIGH"),
]

# ── Knowledge-base system prompts ──

KNOWLEDGE_BASES: dict[str, str] = {
    "plagiarism": (
        "You are an academic integrity expert. Analyse the given student submission "
        "and estimate how likely it is to be plagiarised or AI-generated. "
        "Identify suspicious patterns: overly formal language, lack of personal voice, "
        "inconsistent terminology, known AI phrasing patterns, or content that closely "
        "matches common textbook / web sources. "
        "Always return your analysis as JSON."
    ),
    "grading": (
        "You are an educational assessment specialist. Given a student's submission "
        "and the rubric criteria, evaluate the work objectively. Provide a recommended "
        "grade per criterion with short justification. Be fair but rigorous. "
        "Always return your evaluation as JSON."
    ),
    "study_companion": (
        "You are SmartBuddy, a friendly AI study companion for university students. "
        "Adapt to the student's learning style. Be warm, concise, and motivating. "
        "Use simple language. Offer encouragement when the student seems stressed."
    ),
    "study_materials": (
        "You are an expert educational content creator. Given lecture notes or "
        "slide content, you create high-quality study materials: concise summaries, "
        "effective flashcards, and practice quiz questions. "
        "Ensure accuracy, clarity, and pedagogical value. "
        "Always return structured JSON when asked."
    ),
    "study_plan": (
        "You are an academic planning advisor. Given a student's courses, grades, "
        "deadlines, and exam schedule, you create personalised study plans. "
        "Prioritise topics where the student is weakest, balance workload across days, "
        "and include breaks. Be practical and motivating. "
        "Always return your plan as JSON when asked."
    ),
    "rag_companion": (
        "You are SmartBuddy, a friendly AI study companion. Be warm, concise, and motivating. "
        "When provided with retrieved source material, ground your answers in it and cite sources "
        "as [Source N]. If sources don't cover the question, say so and give general guidance."
    ),
    "course_import": (
        "You are a curriculum organisation expert. Given raw HTML content scraped "
        "from a Google Sites page, extract and organise it into structured course "
        "modules with resource items. Each module should have a title and a list of "
        "items (with title, type, and URL if available). "
        "Always return your result as JSON."
    ),
}


# ── Core helpers ──

async def generate_text(
    prompt: str,
    system_instruction: str = "",
    temperature: float = 0.7,
    model_name: str = "gemini-2.5-flash",
) -> str:
    """Generate plain text from Gemini."""
    client = _get_client()
    config = types.GenerateContentConfig(
        temperature=temperature,
        safety_settings=SAFETY,
        system_instruction=system_instruction or None,
    )
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=model_name,
        contents=prompt,
        config=config,
    )
    try:
        tokens = (response.usage_metadata.total_token_count or 0) if response.usage_metadata else 0
        _log_token_usage(tokens)
    except Exception as e:
        logger.debug("Token extraction failed in generate_text: %s", e)
    text = response.text
    if not text:
        # Fallback: try extracting from candidates
        if response.candidates:
            parts = response.candidates[0].content.parts
            if parts:
                text = parts[0].text
        if not text:
            raise RuntimeError(
                f"Gemini returned empty response. "
                f"Finish reason: {getattr(response.candidates[0], 'finish_reason', 'unknown') if response.candidates else 'no candidates'}"
            )
    return text


async def generate_json(
    prompt: str,
    system_instruction: str = "",
    temperature: float = 0.3,
    model_name: str = "gemini-2.5-flash",
) -> dict | list:
    """Generate text and parse as JSON.  Strips markdown fences if present.
    Retries once on *any* failure — network errors AND parse errors."""
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            raw = await generate_text(
                prompt,
                system_instruction=system_instruction,
                temperature=temperature,
                model_name=model_name,
            )
            # Strip markdown code fences
            cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError as e:
                last_error = e
                # Try extracting JSON from within the response
                match = re.search(r'\{[\s\S]*\}', cleaned)
                if match:
                    try:
                        return json.loads(match.group())
                    except json.JSONDecodeError:
                        pass
        except Exception as e:
            last_error = e
        if attempt == 0:
            continue  # retry once
    raise ValueError(f"Failed to parse JSON from Gemini response after 2 attempts: {last_error}")


async def chat_completion(
    messages: list[dict],
    system_instruction: str = "",
    temperature: float = 0.7,
    model_name: str = "gemini-2.5-flash",
) -> str:
    """Multi-turn chat. *messages* is a list of {"role": "user"|"model", "parts": [str]}."""
    client = _get_client()
    config = types.GenerateContentConfig(
        temperature=temperature,
        safety_settings=SAFETY,
        system_instruction=system_instruction or None,
    )
    # Build history + last message
    history = [
        types.Content(role=m["role"], parts=[types.Part.from_text(text=m["parts"][0])])
        for m in messages[:-1]
    ]
    last_text = messages[-1]["parts"][0] if messages else ""

    # Use the create method for chat-style multi-turn
    all_contents = history + [
        types.Content(role="user", parts=[types.Part.from_text(text=last_text)])
    ]
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=model_name,
        contents=all_contents,
        config=config,
    )
    try:
        tokens = (response.usage_metadata.total_token_count or 0) if response.usage_metadata else 0
        _log_token_usage(tokens)
    except Exception as e:
        logger.debug("Token extraction failed in chat_completion: %s", e)
    return response.text


def get_knowledge_base(domain: str) -> str:
    """Return the system prompt for a given AI domain."""
    return KNOWLEDGE_BASES.get(domain, "")
