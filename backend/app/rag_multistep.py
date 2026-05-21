"""
Multi-step RAG reasoning — Phase 2 (query decomposition) and Phase 3 (HyDE).

decompose_query(): splits a compound question into atomic sub-questions using a
cheap FAST_MODEL call. Returns [original] when the question is already atomic.

retrieve_multistep(): retrieves per sub-question, deduplicates by (doc_id, text
prefix), then re-ranks the merged pool against the ORIGINAL query so the final
ranking reflects holistic relevance rather than per-sub-question relevance.

For very short queries (< MIN_HYDE_TOKENS), falls back to HyDE: we generate a
hypothetical answer and embed THAT instead of the raw query. This lifts recall
on terse lookups like "gradient descent?" where the query embedding alone is
semantically thin.

Feature-gated by RAG_MULTISTEP_ENABLED (default "1"). Set to "0" to short-circuit
back to plain rag_service.retrieve().
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

from . import ai_service, rag_service

logger = logging.getLogger(__name__)

# Tunables (env-overridable)
MULTISTEP_ENABLED = os.getenv("RAG_MULTISTEP_ENABLED", "1") == "1"
HYDE_ENABLED = os.getenv("RAG_HYDE_ENABLED", "1") == "1"
MIN_HYDE_TOKENS = int(os.getenv("RAG_HYDE_MIN_TOKENS", "3"))
MAX_SUB_QUESTIONS = int(os.getenv("RAG_MAX_SUB_QUESTIONS", "3"))


_DECOMPOSE_SYSTEM = (
    "You analyse student questions. If a question has multiple independent parts "
    "that would need different source material to answer (e.g. 'compare X and Y', "
    "'explain X then give examples of Z'), split it into atomic sub-questions. "
    "If it is a single question, return it unchanged. Never invent topics. "
    f"Return at most {MAX_SUB_QUESTIONS} items."
)

_DECOMPOSE_PROMPT = """Return STRICT JSON of the form: {{"questions": ["...", "..."]}}

Question: {query}"""


async def decompose_query(query: str) -> list[str]:
    """Split a compound query into sub-questions. Returns [query] if atomic or on failure."""
    if not MULTISTEP_ENABLED or not query or len(query.split()) < 6:
        return [query]
    try:
        raw = await ai_service.generate_text(
            prompt=_DECOMPOSE_PROMPT.format(query=query),
            system_instruction=_DECOMPOSE_SYSTEM,
            temperature=0.1,
            model_name=ai_service.FAST_MODEL,
        )
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        data = json.loads(cleaned)
        subs = [q.strip() for q in data.get("questions", []) if isinstance(q, str) and q.strip()]
        subs = subs[:MAX_SUB_QUESTIONS]
        if not subs:
            return [query]
        # If model returned one item, keep it as-is.
        return subs
    except Exception as e:
        logger.warning("Query decomposition failed, using original: %s", e)
        return [query]


async def _hyde_embedding(query: str) -> Optional[list[float]]:
    """Generate a hypothetical answer and embed it. Returns None on failure."""
    try:
        hypo = await ai_service.generate_text(
            prompt=(
                "Write a brief, factual 2-3 sentence answer to this academic question as if "
                "from a textbook. Do not hedge.\n\nQuestion: " + query
            ),
            temperature=0.2,
            model_name=ai_service.FAST_MODEL,
        )
        emb = await rag_service.embed_texts([hypo.strip()[:1000]])
        return emb[0] if emb else None
    except Exception as e:
        logger.warning("HyDE failed, using raw query embedding: %s", e)
        return None


def _dedupe(chunks: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    out: list[dict] = []
    for c in chunks:
        key = (c.get("doc_id", ""), c.get("text", "")[:120])
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


async def retrieve_multistep(
    query: str,
    course_ids: list[str],
    top_k: int = 5,
    doc_types: Optional[list[str]] = None,
) -> tuple[list[dict], list[str]]:
    """Multi-step retrieval. Returns (chunks, sub_questions_used).

    Pipeline:
      1. Decompose query (skipped if disabled or query is short).
      2. Per sub-question: use HyDE for terse questions, else raw embedding.
      3. Retrieve without rerank (over-fetch), merge, dedupe.
      4. Final cross-encoder rerank against the ORIGINAL query.
    """
    # Dispatch to the LangChain implementation when AI_BACKEND=framework.
    from .ai_framework import framework_enabled
    if framework_enabled():
        from . import rag_service_lc
        return await rag_service_lc.retrieve_multistep(
            query, course_ids, top_k=top_k, doc_types=doc_types,
        )

    if not query or not course_ids:
        return [], [query]

    if not MULTISTEP_ENABLED:
        chunks = await rag_service.retrieve(query, course_ids, top_k=top_k, doc_types=doc_types)
        return chunks, [query]

    sub_questions = await decompose_query(query)
    per_q_k = max(top_k, 5)

    merged: list[dict] = []
    for sub_q in sub_questions:
        # Phase 3: HyDE for terse sub-questions.
        q_embedding = None
        if HYDE_ENABLED and len(sub_q.split()) < MIN_HYDE_TOKENS:
            q_embedding = await _hyde_embedding(sub_q)

        chunks = await rag_service.retrieve(
            query=sub_q,
            course_ids=course_ids,
            top_k=per_q_k,
            doc_types=doc_types,
            rerank=False,  # defer to final rerank against original query
            query_embedding=q_embedding,
        )
        merged.extend(chunks)

    merged = _dedupe(merged)
    if not merged:
        return [], sub_questions

    # Final rerank against the original compound query — this is what the user actually asked.
    reranked = rag_service._rerank(query, merged, top_k)
    return reranked, sub_questions
