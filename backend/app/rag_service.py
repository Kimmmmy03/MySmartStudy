"""
RAG (Retrieval-Augmented Generation) Service.

Manages ChromaDB vector store, Gemini embeddings, text chunking,
document indexing, and semantic retrieval for course content.
"""

import asyncio
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import chromadb

from . import models
from .firestore import db

logger = logging.getLogger(__name__)

# ── Cross-encoder reranker (Phase 1) ──
# Lazy-loaded singleton. Re-ranking is an OPTIONAL quality enhancement — when
# unavailable, retrieval gracefully falls back to embedding-similarity ordering.
_reranker = None
_reranker_failed_at: float | None = None
_RERANKER_RETRY_SECS = 3600  # retry after 1 hour cooldown


RERANKER_MODEL = os.getenv(
    "RAG_RERANKER_MODEL",
    # Multilingual — supports Malay, English, Chinese, etc.
    # Override to cross-encoder/ms-marco-MiniLM-L-6-v2 for English-only workloads (smaller, faster).
    "BAAI/bge-reranker-v2-m3",
)

# Memory guard ────────────────────────────────────────────────────────────────
# The default reranker (BAAI/bge-reranker-v2-m3 — an XLM-RoBERTa-large) needs
# ~2.5GB RAM to load. On a small serverless instance (512MB–1GB, e.g. Cloud Run
# defaults) that load is OOM-killed by the OS mid-request — a SIGKILL we cannot
# catch — taking the whole worker down and breaking EVERY RAG-backed AI feature
# (study guide, companion, mindmap buddy, study materials, grading). To avoid
# that we refuse to even attempt the load unless there is enough free memory,
# degrading to embedding-similarity ordering instead. Locally (where /proc is
# absent or memory is ample) full reranking still runs.
_RERANK_ENABLED = os.getenv("RAG_RERANK_ENABLED", "1").strip().lower() not in ("0", "false", "no")
# Free memory (MB) required before attempting to load the cross-encoder.
# Sized for the ~2.2GB default model + torch/runtime overhead.
_RERANK_MIN_AVAIL_MB = int(os.getenv("RAG_RERANK_MIN_AVAIL_MB", "3000"))
_rerank_disabled_logged = False


def _available_memory_mb() -> float | None:
    """Best-effort free system memory in MB; None when it can't be determined.

    Prefers the container's cgroup limit (accurate on Cloud Run / k8s), then
    falls back to host /proc/meminfo. Returns None on platforms without these
    (e.g. Windows dev) so reranking is never blocked locally.
    """
    # cgroup v2, then v1 — reflects the container's actual memory budget.
    try:
        for cur_path, max_path in (
            ("/sys/fs/cgroup/memory.current", "/sys/fs/cgroup/memory.max"),
            ("/sys/fs/cgroup/memory/memory.usage_in_bytes",
             "/sys/fs/cgroup/memory/memory.limit_in_bytes"),
        ):
            if os.path.exists(cur_path) and os.path.exists(max_path):
                with open(max_path) as f:
                    raw = f.read().strip()
                if raw and raw != "max":
                    limit = int(raw)
                    if 0 < limit < (1 << 62):  # ignore "unlimited" sentinels
                        with open(cur_path) as f:
                            used = int(f.read().strip())
                        return max(0.0, (limit - used) / 1024 / 1024)
    except Exception:
        pass
    # Host-level fallback.
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) / 1024  # kB → MB
    except Exception:
        pass
    return None


def reranking_allowed() -> bool:
    """Whether it is safe to load/use the cross-encoder reranker in this process.

    Shared by the legacy (``_get_reranker``) and framework
    (``ai_framework.get_cross_encoder``) paths so both degrade identically on
    memory-constrained instances.
    """
    global _rerank_disabled_logged
    if not _RERANK_ENABLED:
        return False
    avail = _available_memory_mb()
    if avail is not None and avail < _RERANK_MIN_AVAIL_MB:
        if not _rerank_disabled_logged:
            logger.warning(
                "Reranker disabled: %.0fMB free < %dMB required for %s. "
                "RAG will use embedding-similarity ordering. Set a smaller "
                "RAG_RERANKER_MODEL or raise instance memory to enable it.",
                avail, _RERANK_MIN_AVAIL_MB, RERANKER_MODEL,
            )
            _rerank_disabled_logged = True
        return False
    return True


def _get_reranker():
    """Load cross-encoder once. Returns None if unavailable — caller should degrade gracefully.

    Retries after a 1-hour cooldown instead of permanently disabling.
    """
    import time

    global _reranker, _reranker_failed_at
    if _reranker is not None:
        return _reranker
    # Refuse to load on memory-constrained instances — see _RERANK_MIN_AVAIL_MB.
    if not reranking_allowed():
        return None
    if _reranker_failed_at is not None:
        if time.monotonic() - _reranker_failed_at < _RERANKER_RETRY_SECS:
            return None  # still in cooldown
        _reranker_failed_at = None  # cooldown expired, retry
    try:
        from sentence_transformers import CrossEncoder
        _reranker = CrossEncoder(RERANKER_MODEL, max_length=512, trust_remote_code=True)
        logger.info("Cross-encoder reranker loaded: %s", RERANKER_MODEL)
    except Exception as e:
        _reranker_failed_at = time.monotonic()
        logger.warning("Reranker unavailable (retry in %ds), falling back to embedding scores: %s",
                        _RERANKER_RETRY_SECS, e)
    return _reranker


def _rerank(query: str, chunks: list[dict], top_k: int) -> list[dict]:
    """Re-rank chunks with a cross-encoder. Falls back to original order on failure."""
    if not chunks:
        return chunks
    model = _get_reranker()
    if model is None:
        return chunks[:top_k]
    try:
        pairs = [(query, c["text"][:2000]) for c in chunks]
        scores = model.predict(pairs)
        for c, s in zip(chunks, scores):
            c["rerank_score"] = float(s)
        chunks.sort(key=lambda x: x.get("rerank_score", 0.0), reverse=True)
    except Exception as e:
        logger.warning("Rerank failed, using embedding scores: %s", e)
    return chunks[:top_k]


# ── ChromaDB client (initialized once at startup) ──

_chroma_client: Optional[chromadb.PersistentClient] = None


def init_chroma():
    """Initialize the persistent ChromaDB client. Called once from main.py lifespan."""
    global _chroma_client
    store_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vector_store")
    os.makedirs(store_path, exist_ok=True)
    _chroma_client = chromadb.PersistentClient(path=store_path)
    logger.info("ChromaDB initialized at %s", store_path)


def _get_chroma() -> chromadb.PersistentClient:
    if _chroma_client is None:
        init_chroma()
    return _chroma_client  # type: ignore


def _get_collection(course_id: str) -> chromadb.Collection:
    """Get or create a course-scoped ChromaDB collection."""
    safe_name = f"course_{course_id.replace('-', '_')[:50]}"
    return _get_chroma().get_or_create_collection(
        name=safe_name,
        metadata={"hnsw:space": "cosine"},
    )


# ── Embedding via Gemini ──

EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = int(os.getenv("GEMINI_EMBED_DIM", "768"))


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed texts using Gemini. Max 100 per call. Model via GEMINI_EMBED_MODEL env."""
    from .ai_service import _get_client
    from google.genai import types as genai_types

    if not texts:
        return []

    client = _get_client()
    all_embeddings = []

    for i in range(0, len(texts), 100):
        batch = texts[i : i + 100]
        try:
            result = await asyncio.to_thread(
                client.models.embed_content,
                model=EMBED_MODEL,
                contents=batch,
                config=genai_types.EmbedContentConfig(output_dimensionality=EMBED_DIM),
            )
            all_embeddings.extend([e.values for e in result.embeddings])
        except Exception as e:
            logger.error("Embedding batch %d failed: %s", i, e)
            all_embeddings.extend([[0.0] * EMBED_DIM] * len(batch))

    return all_embeddings


# ── Text chunking ──

def chunk_text(text: str, chunk_size: int = 220, overlap: int = 30) -> list[str]:
    """Split text into token-approximate chunks with overlap.

    Recursive splitter that respects natural breaks (paragraphs → sentences →
    words) instead of cutting mid-sentence. Uses ~1.3 words per token heuristic.

    Tuned defaults (smaller chunks + smaller overlap) significantly improve
    RAG Context Precision and Answer Relevancy — see docs/RAG_EVAL_NOTES.md.
    """
    if not text or not text.strip():
        return []

    words_per_chunk = int(chunk_size * 1.3)
    overlap_words = int(overlap * 1.3)

    # Split on natural separators in order of preference; if a piece is still
    # too big, split it again with the next finer separator.
    def _split(t: str, separators: list[str]) -> list[str]:
        if not separators:
            # final fallback: word-level sliding window with overlap
            words = t.split()
            if len(words) <= words_per_chunk:
                return [t.strip()] if t.strip() else []
            out = []
            start = 0
            while start < len(words):
                end = start + words_per_chunk
                piece = " ".join(words[start:end]).strip()
                if piece:
                    out.append(piece)
                start = end - overlap_words
                if start >= len(words):
                    break
            return out

        sep, rest = separators[0], separators[1:]
        parts = [p for p in t.split(sep) if p.strip()]
        chunks_out: list[str] = []
        buf = ""
        for part in parts:
            candidate = (buf + sep + part).strip() if buf else part.strip()
            if len(candidate.split()) <= words_per_chunk:
                buf = candidate
            else:
                if buf:
                    chunks_out.append(buf)
                # part itself may still be too big — recurse on finer sep
                if len(part.split()) > words_per_chunk:
                    chunks_out.extend(_split(part, rest))
                    buf = ""
                else:
                    buf = part.strip()
        if buf:
            chunks_out.append(buf)
        return chunks_out

    return _split(text.strip(), ["\n\n", "\n", ". ", " "])


def _content_hash(text: str) -> str:
    """SHA-256 hash of text content for incremental indexing."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ── Document indexing ──

async def index_document(
    course_id: str,
    doc_id: str,
    doc_type: str,
    title: str,
    text: str,
    metadata: Optional[dict] = None,
):
    """Chunk, embed, and upsert a document into the course's ChromaDB collection.

    Skips re-indexing if the content hash matches the last indexed version.
    """
    if not text or len(text.strip()) < 30:
        return

    content_hash = _content_hash(text)

    # Check if already indexed with same hash
    try:
        state_docs = (
            db.collection(models.RAG_INDEX_STATE)
            .where("docId", "==", doc_id)
            .where("courseId", "==", course_id)
            .limit(1)
            .get()
        )
        for sd in state_docs:
            if sd.to_dict().get("contentHash") == content_hash:
                return  # Already indexed, no changes
    except Exception as e:
        logger.debug("Index state check failed for %s: %s", doc_id, e)

    # Chunk the text
    chunks = chunk_text(text)
    if not chunks:
        return

    # Prefix each chunk with a [Title — Type] header before embedding so the
    # semantic vector carries document-level context. The raw chunk text is
    # still stored verbatim in the document for downstream answer generation.
    header = f"[{title}{' — ' + doc_type if doc_type else ''}]"
    chunks_for_embedding = [f"{header} {c}" for c in chunks]

    # Embed all chunks (with header)
    embeddings = await embed_texts(chunks_for_embedding)

    # Prepare IDs and metadata
    collection = _get_collection(course_id)

    # Remove old chunks for this document (query actual IDs instead of guessing range)
    try:
        existing = collection.get(where={"doc_id": doc_id}, include=[])
        if existing and existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception as e:
        logger.warning("Failed to remove old chunks for %s: %s", doc_id, e)

    chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    # Per-document extra metadata (e.g. section/week/topic) propagates into
    # every chunk so filtering and provenance work downstream. Only flat
    # scalar values are accepted — ChromaDB rejects nested objects.
    extra: dict = {}
    if metadata:
        for k, v in metadata.items():
            if isinstance(v, (str, int, float, bool)):
                extra[k] = v
    chunk_metas = [
        {
            "doc_id": doc_id,
            "doc_type": doc_type,
            "title": title,
            "course_id": course_id,
            "chunk_index": i,
            "total_chunks": len(chunks),
            **extra,
        }
        for i in range(len(chunks))
    ]

    # Upsert into ChromaDB
    collection.upsert(
        ids=chunk_ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=chunk_metas,
    )

    # Update index state in Firestore (use | separator to avoid collision with UUIDs containing _)
    now = datetime.now(timezone.utc).isoformat()
    state_id = f"{course_id}|{doc_id}"
    db.collection(models.RAG_INDEX_STATE).document(state_id).set({
        "docId": doc_id,
        "courseId": course_id,
        "contentHash": content_hash,
        "lastIndexedAt": now,
        "chunkCount": len(chunks),
        "docType": doc_type,
        "title": title,
    })

    logger.info("Indexed %s '%s' (%d chunks) for course %s", doc_type, title, len(chunks), course_id)


async def index_course_content(course_id: str):
    """Index all content for a course: PDFs, announcements, discussions, maps, quizzes, assignments."""
    logger.info("Starting indexing for course %s", course_id)

    # 1. Module Items (PDFs and other resources)
    try:
        module_docs = db.collection(models.COURSE_MODULES).where("courseId", "==", course_id).get()
        for m_doc in module_docs:
            module_id = m_doc.id
            items = db.collection(models.MODULE_ITEMS).where("moduleId", "==", module_id).get()
            for item_doc in items:
                item = item_doc.to_dict()
                text = _extract_item_text(item)
                if text and len(text.strip()) >= 30:
                    await index_document(
                        course_id, item_doc.id, "pdf",
                        item.get("title", "Resource"), text,
                    )
    except Exception as e:
        logger.error("Error indexing module items for %s: %s", course_id, e)

    # 2. Announcements
    try:
        ann_docs = db.collection(models.ANNOUNCEMENTS).where("courseId", "==", course_id).get()
        for ann_doc in ann_docs:
            ann = ann_doc.to_dict()
            text = f"{ann.get('title', '')}\n{ann.get('content', '')}"
            await index_document(
                course_id, ann_doc.id, "announcement",
                ann.get("title", "Announcement"), text,
            )
    except Exception as e:
        logger.error("Error indexing announcements for %s: %s", course_id, e)

    # 3. Discussions (batch by chunks of messages)
    try:
        disc_docs = db.collection(models.DISCUSSIONS).where("courseId", "==", course_id).limit(500).get()
        # Group discussion messages into batches of 10 for more meaningful chunks
        batch_texts = []
        batch_id_base = f"disc_batch_{course_id}"
        for disc_doc in disc_docs:
            d = disc_doc.to_dict()
            text = d.get("text", "")
            sender = d.get("senderName", "")
            if text:
                batch_texts.append(f"{sender}: {text}")

        # Index in batches of 10 messages
        for i in range(0, len(batch_texts), 10):
            batch = batch_texts[i : i + 10]
            combined = "\n".join(batch)
            batch_num = i // 10
            await index_document(
                course_id, f"{batch_id_base}_{batch_num}", "discussion",
                f"Discussion messages (batch {batch_num + 1})", combined,
            )
    except Exception as e:
        logger.error("Error indexing discussions for %s: %s", course_id, e)

    # 4. Mind Maps (from enrolled students)
    try:
        course_doc = db.collection(models.COURSES).document(course_id).get()
        if course_doc.exists:
            enrolled = course_doc.to_dict().get("enrolledStudents", [])
            for student_id in enrolled[:50]:  # Limit to 50 students
                map_docs = (
                    db.collection(models.MAPS)
                    .where("ownerId", "==", student_id)
                    .limit(20)
                    .get()
                )
                for map_doc in map_docs:
                    m = map_doc.to_dict()
                    text = m.get("nodesText", "")
                    if text and len(text.strip()) >= 30:
                        await index_document(
                            course_id, map_doc.id, "mindmap",
                            m.get("title", "Mind Map"), text,
                        )
    except Exception as e:
        logger.error("Error indexing mind maps for %s: %s", course_id, e)

    # 5. Quiz Questions
    try:
        quiz_docs = db.collection(models.QUIZZES).where("courseId", "==", course_id).get()
        for quiz_doc in quiz_docs:
            q = quiz_doc.to_dict()
            questions = db.collection(models.QUIZ_QUESTIONS).where("quizId", "==", quiz_doc.id).get()
            q_texts = []
            for qd in questions:
                qdata = qd.to_dict()
                q_text = qdata.get("text", "")
                options = qdata.get("options", [])
                if q_text:
                    line = f"Q: {q_text}"
                    if options:
                        line += f" Options: {', '.join(str(o) for o in options)}"
                    q_texts.append(line)
            if q_texts:
                combined = f"Quiz: {q.get('title', '')}\n" + "\n".join(q_texts)
                await index_document(
                    course_id, quiz_doc.id, "quiz",
                    q.get("title", "Quiz"), combined,
                )
    except Exception as e:
        logger.error("Error indexing quizzes for %s: %s", course_id, e)

    # 6. Assignments
    try:
        assign_docs = db.collection(models.ASSIGNMENTS).where("courseId", "==", course_id).get()
        for a_doc in assign_docs:
            a = a_doc.to_dict()
            text = f"{a.get('title', '')}\n{a.get('description', '')}"
            if len(text.strip()) >= 30:
                await index_document(
                    course_id, a_doc.id, "assignment",
                    a.get("title", "Assignment"), text,
                )
    except Exception as e:
        logger.error("Error indexing assignments for %s: %s", course_id, e)

    logger.info("Finished indexing for course %s", course_id)


def _extract_pdf_text(source) -> str:
    """Try pdfplumber first (better layout preservation), fall back to PyPDF2."""
    try:
        import pdfplumber
        with pdfplumber.open(source) as pdf:
            text = "\n".join((p.extract_text() or "") for p in pdf.pages)
            if text.strip():
                return text
    except Exception as e:
        logger.debug("pdfplumber failed: %s", e)
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(source)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if text.strip():
            return text
    except Exception as e:
        logger.debug("PyPDF2 failed: %s", e)
    return ""


def _fetch_remote_pdf(url: str) -> Optional[bytes]:
    """Download a PDF by URL. HEAD-probe first to skip non-PDF responses cheaply.

    Short connect/read timeouts so indexing never hangs on slow hosts.
    Returns None on any failure.
    """
    try:
        import requests
        headers = {"User-Agent": "MySmartStudy-RAG-Indexer/1.0"}
        # Cheap probe: HEAD. Many hosts block HEAD, so fall through on failure.
        try:
            head = requests.head(url, timeout=(3, 5), allow_redirects=True, headers=headers)
            ctype = head.headers.get("content-type", "").lower()
            if head.ok and "pdf" not in ctype and not url.lower().endswith(".pdf"):
                return None
        except Exception:
            pass
        resp = requests.get(url, timeout=(3, 8), allow_redirects=True, headers=headers, stream=True)
        resp.raise_for_status()
        ctype = resp.headers.get("content-type", "").lower()
        if "pdf" not in ctype and not url.lower().endswith(".pdf"):
            return None
        return resp.content
    except Exception as e:
        logger.debug("PDF fetch failed for %s: %s", url, e)
        return None


def _extract_item_text(item: dict) -> str:
    """Extract text from a module item.

    Order of attempts:
      1. Local file at item['filePath'] — try pdfplumber then PyPDF2.
      2. Remote URL at item['url'] — download if PDF, extract.
      3. Fall back to title + url (title-only indexing — low quality).
    """
    import io

    file_path = item.get("filePath")
    if file_path and os.path.exists(file_path):
        text = _extract_pdf_text(file_path)
        if text.strip():
            return text

    url = (item.get("url") or "").strip()
    if url.startswith(("http://", "https://")):
        pdf_bytes = _fetch_remote_pdf(url)
        if pdf_bytes:
            text = _extract_pdf_text(io.BytesIO(pdf_bytes))
            if text.strip():
                return text

    return f"{item.get('title', '')}\n{url}".strip()


async def remove_document(course_id: str, doc_id: str):
    """Remove all chunks for a document from the collection."""
    try:
        collection = _get_collection(course_id)
        existing = collection.get(where={"doc_id": doc_id}, include=[])
        if existing and existing["ids"]:
            collection.delete(ids=existing["ids"])

        # Remove index state (try new | separator, fall back to old _)
        state_id = f"{course_id}|{doc_id}"
        state_doc = db.collection(models.RAG_INDEX_STATE).document(state_id).get()
        if state_doc.exists:
            state_doc.reference.delete()
        else:
            # Migration: try old separator
            old_state_id = f"{course_id}_{doc_id}"
            db.collection(models.RAG_INDEX_STATE).document(old_state_id).delete()
    except Exception as e:
        logger.error("Error removing document %s: %s", doc_id, e)


# ── Retrieval ──

async def retrieve(
    query: str,
    course_ids: list[str],
    top_k: int = 8,
    doc_types: Optional[list[str]] = None,
    rerank: bool = True,
    query_embedding: Optional[list[float]] = None,
) -> list[dict]:
    """Semantic search across one or more course collections.

    Over-fetches candidates then re-ranks with a cross-encoder for higher precision.
    Pass ``rerank=False`` to skip re-ranking, or ``query_embedding`` to reuse a
    precomputed embedding (e.g. for HyDE).

    Returns list of {text, doc_id, doc_type, title, course_id, score}.
    """
    # Dispatch to the LangChain implementation when AI_BACKEND=framework.
    from .ai_framework import framework_enabled
    if framework_enabled():
        from . import rag_service_lc
        return await rag_service_lc.retrieve(
            query, course_ids, top_k=top_k, doc_types=doc_types,
            rerank=rerank, query_embedding=query_embedding,
        )

    if not query or not course_ids:
        return []

    if query_embedding is None:
        query_embedding = (await embed_texts([query]))[0]
    # Over-fetch more candidates before the cross-encoder rerank: more
    # candidates → reranker has a wider pool → better Context Precision.
    fetch_ratio = int(os.getenv("RAG_FETCH_RATIO", "6"))
    fetch_k = top_k * fetch_ratio if rerank else top_k

    all_results = []
    for cid in course_ids:
        try:
            collection = _get_collection(cid)

            # Check if collection has any documents
            doc_count = collection.count()
            if doc_count == 0:
                continue

            where_filter = None
            if doc_types:
                if len(doc_types) == 1:
                    where_filter = {"doc_type": doc_types[0]}
                else:
                    where_filter = {"doc_type": {"$in": doc_types}}

            hits = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(fetch_k, doc_count),
                where=where_filter,
            )

            if hits and hits["documents"] and hits["documents"][0]:
                for i, doc_text in enumerate(hits["documents"][0]):
                    meta = hits["metadatas"][0][i] if hits["metadatas"] else {}
                    distance = hits["distances"][0][i] if hits["distances"] else 1.0
                    # ChromaDB returns distances; lower = more similar for cosine
                    score = 1.0 - distance

                    all_results.append({
                        "text": doc_text,
                        "doc_id": meta.get("doc_id", ""),
                        "doc_type": meta.get("doc_type", ""),
                        "title": meta.get("title", ""),
                        "course_id": cid,
                        "score": score,
                    })
        except Exception as e:
            logger.error("Retrieval error for course %s: %s", cid, e)

    # Sort by embedding score descending
    all_results.sort(key=lambda x: x["score"], reverse=True)

    if rerank:
        # Over-fetched candidates across all courses — rerank the combined pool.
        candidates = all_results[: fetch_k]
        return _rerank(query, candidates, top_k)

    return all_results[:top_k]


def format_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a prompt-ready context block with citations."""
    if not chunks:
        return "No relevant course materials found."

    lines = []
    for i, c in enumerate(chunks, 1):
        lines.append(f"[Source {i}: {c['title']} ({c['doc_type']})]")
        # Truncate individual chunks to avoid prompt overflow
        text = c["text"][:2000]
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def format_citations(chunks: list[dict]) -> list[dict]:
    """Return structured citation metadata for frontend display."""
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


# ── Index status ──

def get_index_status(course_id: str) -> dict:
    """Get indexing statistics for a course, including health metrics."""
    docs = db.collection(models.RAG_INDEX_STATE).where("courseId", "==", course_id).get()
    stats = {
        "course_id": course_id,
        "total_documents": 0,
        "total_chunks": 0,
        "by_type": {},
        "avg_chunks_per_doc": 0.0,
        "thin_passage_count": 0,
        "thin_passage_pct": 0.0,
        "oldest_indexed_at": None,
        "newest_indexed_at": None,
    }
    chunk_counts = []
    indexed_dates = []

    for d in docs:
        data = d.to_dict()
        stats["total_documents"] += 1
        cc = data.get("chunkCount", 0)
        stats["total_chunks"] += cc
        chunk_counts.append(cc)
        if cc <= 1:
            stats["thin_passage_count"] += 1
        dtype = data.get("docType", "unknown")
        stats["by_type"][dtype] = stats["by_type"].get(dtype, 0) + 1
        ts = data.get("lastIndexedAt")
        if ts:
            indexed_dates.append(ts)

    if stats["total_documents"] > 0:
        stats["avg_chunks_per_doc"] = round(stats["total_chunks"] / stats["total_documents"], 1)
        stats["thin_passage_pct"] = round(100 * stats["thin_passage_count"] / stats["total_documents"], 1)
    if indexed_dates:
        indexed_dates.sort()
        stats["oldest_indexed_at"] = indexed_dates[0]
        stats["newest_indexed_at"] = indexed_dates[-1]

    return stats
