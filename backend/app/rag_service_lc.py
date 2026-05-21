"""
RAG via LangChain — the AI_BACKEND=framework implementation of retrieval.

Public functions mirror rag_service / rag_multistep exactly so the dispatcher
can swap implementations without routers changing:

  - retrieve(query, course_ids, top_k, doc_types, rerank, query_embedding)
  - retrieve_multistep(query, course_ids, top_k, doc_types)

Indexing is NOT reimplemented here — the legacy rag_service.index_document
still owns writing to ChromaDB. This module only READS those collections,
using a vector-compatible embedding adapter (see ai_framework).

Layered techniques, all via LangChain:
  - MultiQueryRetriever      — query decomposition (compound -> sub-queries)
  - CrossEncoderReranker     — two-stage retrieve-then-rerank
  - ContextualCompressionRetriever — pipes the reranker onto the retriever
HyDE for terse queries is done with a FAST_MODEL call, same as the legacy path.
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

# Same env-tunable constants as the legacy path
import os

_FETCH_RATIO = int(os.getenv("RAG_FETCH_RATIO", "4"))
_HYDE_ENABLED = os.getenv("RAG_HYDE_ENABLED", "1") == "1"
_HYDE_MIN_TOKENS = int(os.getenv("RAG_HYDE_MIN_TOKENS", "3"))
_MULTISTEP_ENABLED = os.getenv("RAG_MULTISTEP_ENABLED", "1") == "1"


def _build_vectorstore(course_id: str):
    """LangChain Chroma wrapper over the existing per-course collection."""
    from langchain_chroma import Chroma

    from . import rag_service
    from .ai_framework import get_embeddings

    safe_name = f"course_{course_id.replace('-', '_')[:50]}"
    return Chroma(
        client=rag_service._get_chroma(),
        collection_name=safe_name,
        embedding_function=get_embeddings(),
    )


def _doc_to_chunk(d, course_id_fallback: str = "") -> dict:
    """Convert a LangChain Document back to the legacy chunk dict shape."""
    meta = d.metadata or {}
    return {
        "text": d.page_content,
        "doc_id": meta.get("doc_id", ""),
        "doc_type": meta.get("doc_type", ""),
        "title": meta.get("title", ""),
        "course_id": meta.get("course_id", course_id_fallback),
        "score": float(meta.get("relevance_score", meta.get("score", 0)) or 0),
    }


def _retrieve_sync(
    query: str,
    course_ids: list[str],
    top_k: int,
    doc_types: list[str] | None,
    rerank: bool,
) -> list[dict]:
    """Blocking retrieval — run inside asyncio.to_thread by the async wrapper."""
    from langchain_classic.retrievers import ContextualCompressionRetriever
    from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
    from langchain_classic.retrievers.multi_query import MultiQueryRetriever

    from .ai_framework import get_chat_llm, get_cross_encoder

    fetch_k = top_k * _FETCH_RATIO if rerank else top_k
    is_compound = _MULTISTEP_ENABLED and len(query.split()) >= 6

    all_chunks: list[dict] = []
    for cid in course_ids:
        try:
            vs = _build_vectorstore(cid)
            if vs._collection.count() == 0:
                continue

            search_kwargs: dict = {"k": fetch_k}
            if doc_types:
                search_kwargs["filter"] = (
                    {"doc_type": doc_types[0]}
                    if len(doc_types) == 1
                    else {"doc_type": {"$in": doc_types}}
                )

            retriever = vs.as_retriever(search_kwargs=search_kwargs)

            # Layer 1 — query decomposition for compound questions
            if is_compound:
                retriever = MultiQueryRetriever.from_llm(
                    retriever=retriever, llm=get_chat_llm(fast=True, temperature=0.1)
                )

            # Layer 2 — cross-encoder rerank
            ce = get_cross_encoder() if rerank else None
            if ce is not None:
                retriever = ContextualCompressionRetriever(
                    base_compressor=CrossEncoderReranker(model=ce, top_n=top_k),
                    base_retriever=retriever,
                )

            docs = retriever.invoke(query)
            all_chunks.extend(_doc_to_chunk(d, cid) for d in docs)
        except Exception as e:
            logger.error("Framework retrieval error for course %s: %s", cid, e)

    all_chunks.sort(key=lambda c: c["score"], reverse=True)
    return all_chunks[:top_k]


async def retrieve(
    query: str,
    course_ids: list[str],
    top_k: int = 5,
    doc_types: list[str] | None = None,
    rerank: bool = True,
    query_embedding: list[float] | None = None,  # accepted for signature parity
) -> list[dict]:
    """Semantic search across course collections — LangChain implementation.

    Same return shape as rag_service.retrieve:
      [{text, doc_id, doc_type, title, course_id, score}, ...]
    """
    from . import ai_service

    if not query or not course_ids:
        return []
    ai_service._enforce_ai_gate()
    return await asyncio.to_thread(
        _retrieve_sync, query, course_ids, top_k, doc_types, rerank
    )


async def _hyde_query(query: str) -> str:
    """Generate a hypothetical answer for a terse query (HyDE)."""
    from .ai_framework import get_chat_llm

    try:
        llm = get_chat_llm(fast=True, temperature=0.2)
        msg = await asyncio.to_thread(
            llm.invoke,
            "Write a brief, factual 2-3 sentence answer to this academic "
            "question as if from a textbook. Do not hedge.\n\nQuestion: " + query,
        )
        return getattr(msg, "content", "") or query
    except Exception as e:
        logger.warning("Framework HyDE failed, using raw query: %s", e)
        return query


async def retrieve_multistep(
    query: str,
    course_ids: list[str],
    top_k: int = 5,
    doc_types: list[str] | None = None,
) -> tuple[list[dict], list[str]]:
    """Multi-step retrieval — LangChain implementation.

    Returns (chunks, sub_questions_used), same as rag_multistep.retrieve_multistep.
    MultiQueryRetriever handles decomposition internally, so sub-questions are
    not separately surfaced; we return [query] for signature parity.
    """
    if not query or not course_ids:
        return [], [query]

    # HyDE: for very terse queries, search with a hypothetical answer instead
    search_text = query
    if _HYDE_ENABLED and len(query.split()) < _HYDE_MIN_TOKENS:
        search_text = await _hyde_query(query)

    chunks = await retrieve(
        search_text, course_ids, top_k=top_k, doc_types=doc_types, rerank=True
    )
    return chunks, [query]


# ── Formatting helpers — identical behaviour to the legacy module ────────────

def format_context(chunks: list[dict]) -> str:
    if not chunks:
        return "No relevant course materials found."
    lines = []
    for i, c in enumerate(chunks, 1):
        lines.append(f"[Source {i}: {c['title']} ({c['doc_type']})]")
        lines.append(c["text"][:2000])
        lines.append("")
    return "\n".join(lines)


def format_citations(chunks: list[dict]) -> list[dict]:
    return [
        {
            "index": i + 1,
            "title": c["title"],
            "doc_type": c["doc_type"],
            "doc_id": c["doc_id"],
            "course_id": c["course_id"],
            "score": round(c.get("score", 0), 3),
        }
        for i, c in enumerate(chunks)
    ]
