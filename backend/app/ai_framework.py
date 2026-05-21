"""
LangChain + CrewAI framework integration layer.

This module is the shared plumbing for the AI_BACKEND=framework code path.
The default AI_BACKEND=legacy path never imports this file, so the heavy
LangChain / CrewAI dependencies are only loaded when the flag is on.

Responsibilities:
  - framework_enabled() — read the AI_BACKEND env flag
  - get_chat_llm()      — cached LangChain chat models (SMART / FAST)
  - LegacyCompatibleEmbeddings — a LangChain Embeddings adapter that produces
    vectors identical to the legacy rag_service, so LangChain can read the
    ChromaDB collections the legacy indexer already built (no re-indexing)
  - get_cross_encoder() — cached cross-encoder reranker model
  - UsageCallback       — funnels LangChain token usage back into
    ai_service's existing aiUsageSummary / aiDailyUsage tracking
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


# ── Feature flag ──────────────────────────────────────────────────────────────

def framework_enabled() -> bool:
    """True when AI_BACKEND=framework. Anything else (incl. unset) → legacy."""
    return os.getenv("AI_BACKEND", "legacy").strip().lower() == "framework"


# ── LangChain chat models (lazy singletons) ───────────────────────────────────

_chat_smart = None
_chat_fast = None


def get_chat_llm(fast: bool = False, temperature: float = 0.7):
    """Return a cached LangChain ChatGoogleGenerativeAI.

    fast=True  → FAST_MODEL  (gemini-2.5-flash-lite) — decomposition, extraction
    fast=False → SMART_MODEL (gemini-2.5-flash)      — reasoning, final answers
    """
    global _chat_smart, _chat_fast
    from langchain_google_genai import ChatGoogleGenerativeAI

    from . import ai_service

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    if fast:
        if _chat_fast is None:
            _chat_fast = ChatGoogleGenerativeAI(
                model=ai_service.FAST_MODEL,
                google_api_key=api_key,
                temperature=temperature,
            )
        return _chat_fast

    if _chat_smart is None:
        _chat_smart = ChatGoogleGenerativeAI(
            model=ai_service.SMART_MODEL,
            google_api_key=api_key,
            temperature=temperature,
        )
    return _chat_smart


# ── Embedding adapter — vector-compatible with the legacy ChromaDB index ──────

def _legacy_embed(texts: list[str]) -> list[list[float]]:
    """Embed text with the EXACT model + dimensionality the legacy rag_service
    used, so vectors line up with collections built by the legacy indexer."""
    from google.genai import types as genai_types

    from .ai_service import _get_client
    from .rag_service import EMBED_DIM, EMBED_MODEL

    client = _get_client()
    out: list[list[float]] = []
    for i in range(0, len(texts), 100):  # Gemini caps at 100 per call
        batch = texts[i : i + 100]
        try:
            res = client.models.embed_content(
                model=EMBED_MODEL,
                contents=batch,
                config=genai_types.EmbedContentConfig(output_dimensionality=EMBED_DIM),
            )
            out.extend([e.values for e in res.embeddings])
        except Exception as e:
            logger.error("Framework embedding batch %d failed: %s", i, e)
            out.extend([[0.0] * EMBED_DIM] * len(batch))
    return out


def get_embeddings():
    """Return a LangChain Embeddings object that matches the legacy index."""
    from langchain_core.embeddings import Embeddings

    class LegacyCompatibleEmbeddings(Embeddings):
        def embed_documents(self, texts: list[str]) -> list[list[float]]:
            return _legacy_embed(list(texts))

        def embed_query(self, text: str) -> list[float]:
            return _legacy_embed([text])[0]

    return LegacyCompatibleEmbeddings()


# ── Cross-encoder reranker (lazy singleton, reused across requests) ───────────

_cross_encoder = None


def get_cross_encoder():
    """Cached HuggingFace cross-encoder for LangChain's CrossEncoderReranker.
    Returns None if it fails to load — callers should degrade gracefully."""
    global _cross_encoder
    if _cross_encoder is not None:
        return _cross_encoder
    try:
        from langchain_community.cross_encoders import HuggingFaceCrossEncoder

        from .rag_service import RERANKER_MODEL

        _cross_encoder = HuggingFaceCrossEncoder(model_name=RERANKER_MODEL)
        logger.info("Framework cross-encoder loaded: %s", RERANKER_MODEL)
    except Exception as e:
        logger.warning("Framework cross-encoder unavailable: %s", e)
    return _cross_encoder


# ── Token usage callback — keeps the admin AI usage dashboard accurate ───────

def get_usage_callback():
    """Return a LangChain callback handler that logs token usage through
    ai_service._log_token_usage (which reads the context vars the routers set
    via set_tracking_context). Best-effort — never raises into the LLM call."""
    from langchain_core.callbacks import BaseCallbackHandler

    class UsageCallback(BaseCallbackHandler):
        def on_llm_end(self, response, **kwargs) -> None:
            try:
                from .ai_service import _log_token_usage

                total = 0
                # langchain-google-genai puts usage in a few possible places
                llm_output = getattr(response, "llm_output", None) or {}
                usage = llm_output.get("usage_metadata") or llm_output.get("token_usage") or {}
                total = (
                    usage.get("total_token_count")
                    or usage.get("total_tokens")
                    or 0
                )
                if not total:
                    for gen_list in getattr(response, "generations", []) or []:
                        for gen in gen_list:
                            msg = getattr(gen, "message", None)
                            um = getattr(msg, "usage_metadata", None) if msg else None
                            if um:
                                total += int(um.get("total_tokens", 0) or 0)
                if total:
                    _log_token_usage(int(total))
            except Exception as e:  # never break the request over telemetry
                logger.debug("UsageCallback failed: %s", e)

    return UsageCallback()
