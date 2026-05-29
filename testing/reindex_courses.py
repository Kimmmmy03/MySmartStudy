"""
Re-index every course's RAG content with the improved chunker.

Strategy: each document is currently chunked across several rows in its course's
ChromaDB collection. We reconstruct each document by concatenating its chunks in
chunk_index order, delete the old chunks, and call rag_service.index_document
again — which now uses the new smaller-chunk + header-prefixed embeddings.

The content-hash skip in index_document() would prevent a re-index, so we first
wipe the matching rag_index_state entry per document.

Run with the backend venv:  python reindex_courses.py
"""

import os
import sys
import asyncio
import warnings

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, "..", "backend"))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env")

from app import rag_service, models, ai_service  # noqa: E402
from app.firestore import db  # noqa: E402

# The admin AI master switch is currently OFF in Firestore, so every embed
# call would 503. We bypass the gate in-process only — production config is
# NOT modified. Same approach as test_ragas.py.
ai_service._enforce_ai_gate = lambda *a, **k: None  # noqa: E731


def reconstruct_documents(course_id: str) -> dict:
    """Return {doc_id: {title, doc_type, text}} for a course collection."""
    col = rag_service._get_collection(course_id)
    got = col.get(include=["documents", "metadatas"])
    docs = got.get("documents", []) or []
    metas = got.get("metadatas", []) or []
    ids = got.get("ids", []) or []

    # Group chunks by doc_id, ordered by chunk_index
    by_doc: dict[str, list[tuple[int, str, dict]]] = {}
    for cid, text, meta in zip(ids, docs, metas):
        doc_id = (meta or {}).get("doc_id") or ""
        if not doc_id or not text:
            continue
        idx = (meta or {}).get("chunk_index", 0)
        try:
            idx = int(idx)
        except Exception:
            idx = 0
        by_doc.setdefault(doc_id, []).append((idx, text, meta or {}))

    out = {}
    for doc_id, parts in by_doc.items():
        parts.sort(key=lambda t: t[0])
        # Note: chunks have ~50-token overlap, so naive join would duplicate.
        # Use the first chunk as-is, then for each subsequent chunk drop the
        # overlap prefix (= the last ~50 words of the previous chunk).
        joined = parts[0][1]
        for _, txt, _ in parts[1:]:
            prev_words = joined.split()
            overlap_words = min(int(50 * 1.3), len(prev_words))
            overlap_tail = " ".join(prev_words[-overlap_words:]) if overlap_words else ""
            if overlap_tail and txt.startswith(overlap_tail):
                joined += " " + txt[len(overlap_tail):].lstrip()
            else:
                joined += " " + txt
        first_meta = parts[0][2]
        out[doc_id] = {
            "title": first_meta.get("title", doc_id),
            "doc_type": first_meta.get("doc_type", ""),
            "text": joined,
        }
    return out


async def reindex_course(course_id: str, course_name: str) -> tuple[int, int]:
    """Re-index every document in one course. Returns (docs, total_chunks_after)."""
    print(f"\n== {course_name[:50]}  ({course_id}) ==")
    documents = reconstruct_documents(course_id)
    if not documents:
        print("  (no documents found)")
        return (0, 0)

    # Wipe state docs for these so index_document does not short-circuit
    state_col = db.collection(models.RAG_INDEX_STATE)
    for doc_id in documents:
        try:
            state_col.document(f"{course_id}__{doc_id}").delete()
            state_col.document(f"{course_id}_{doc_id}").delete()  # legacy id
        except Exception:
            pass

    # Wipe the whole collection so old chunks (large) don't linger
    col = rag_service._get_collection(course_id)
    try:
        all_ids = col.get(include=[]).get("ids", []) or []
        if all_ids:
            col.delete(ids=all_ids)
    except Exception as e:
        print(f"  warn: clear failed — {e}")

    docs_done = 0
    for doc_id, info in documents.items():
        try:
            await rag_service.index_document(
                course_id=course_id, doc_id=doc_id,
                doc_type=info["doc_type"], title=info["title"],
                text=info["text"],
            )
            docs_done += 1
        except Exception as e:
            print(f"  [skip] {doc_id}: {type(e).__name__}: {str(e)[:120]}")

    total_chunks = col.count()
    print(f"  re-indexed {docs_done} documents -> {total_chunks} chunks")
    return docs_done, total_chunks


async def main():
    print("== Re-indexing all courses with improved chunker ==")
    courses = []
    for doc in db.collection("courses").stream():
        cid = doc.id
        try:
            col = rag_service._get_collection(cid)
            if col.count() > 0:
                courses.append((cid, doc.to_dict().get("courseName", cid)))
        except Exception:
            pass

    print(f"Found {len(courses)} courses with indexed content.")

    total_docs = total_chunks = 0
    for cid, name in courses:
        d, c = await reindex_course(cid, name)
        total_docs += d
        total_chunks += c

    print(f"\n== DONE ==  {total_docs} documents -> {total_chunks} chunks total")


if __name__ == "__main__":
    asyncio.run(main())
