"""
Rebuild the Psikologi course RAG index from substantive content in Firestore.

The original PDF content was lost; this re-ingests every artefact that still
holds real Malay-language educational text: assignment descriptions, quiz
questions, announcements, course-module descriptions, discussions. Each
becomes one indexed "document" and is chunked with the improved chunker.

Run with the backend venv:  python rebuild_psikologi.py
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

ai_service._enforce_ai_gate = lambda *a, **k: None  # noqa: E731

PSIKOLOGI_ID = "c5a4cd2d-34d7-4db0-97a7-7e782bdbf23e"
MIN_LEN = 60  # below this it's not worth indexing (e.g. "hi")


def harvest():
    """Return [{doc_id, doc_type, title, text}] from every relevant Firestore
    collection for the Psikologi course."""
    items: list[dict] = []

    # Assignments — title + description (often longest, richest text)
    for d in db.collection("assignments").where("courseId", "==", PSIKOLOGI_ID).stream():
        o = d.to_dict()
        body = (o.get("description") or "").strip()
        if len(body) < MIN_LEN:
            continue
        items.append({
            "doc_id": f"asg_{d.id}",
            "doc_type": "assignment",
            "title": o.get("title") or "Assignment",
            "text": body,
        })

    # Quiz questions belonging to the course's quizzes
    quiz_ids = [q.id for q in db.collection("quizzes")
                .where("courseId", "==", PSIKOLOGI_ID).stream()]
    for qid in quiz_ids:
        qsnaps = list(db.collection("quizQuestions")
                       .where("quizId", "==", qid).stream())
        # Aggregate all questions of one quiz into one document for context
        chunks = []
        title = ""
        for qq in qsnaps:
            o = qq.to_dict()
            qtext = (o.get("text") or "").strip()
            if not qtext:
                continue
            opts = o.get("options") or []
            line = f"Q: {qtext}"
            if opts:
                line += "\nOptions: " + " | ".join(str(x) for x in opts)
            ans = o.get("correctAnswer")
            if ans:
                line += f"\nAnswer: {ans}"
            chunks.append(line)
        if chunks:
            quiz_doc = next((q for q in db.collection("quizzes")
                              .where("__name__", "==", qid).stream()), None)
            if quiz_doc:
                title = quiz_doc.to_dict().get("title", f"Quiz {qid[:8]}")
            body = "\n\n".join(chunks)
            if len(body) >= MIN_LEN:
                items.append({
                    "doc_id": f"quiz_{qid}",
                    "doc_type": "quiz",
                    "title": title or "Quiz",
                    "text": body,
                })

    # Announcements
    for d in db.collection("announcements").where("courseId", "==", PSIKOLOGI_ID).stream():
        o = d.to_dict()
        body = ((o.get("title") or "") + "\n" + (o.get("content") or "")).strip()
        if len(body) < MIN_LEN:
            continue
        items.append({
            "doc_id": f"ann_{d.id}",
            "doc_type": "announcement",
            "title": o.get("title") or "Announcement",
            "text": body,
        })

    # Course modules — title + description
    for d in db.collection("courseModules").where("courseId", "==", PSIKOLOGI_ID).stream():
        o = d.to_dict()
        body = ((o.get("title") or "") + "\n" + (o.get("description") or "")).strip()
        if len(body) < MIN_LEN:
            continue
        items.append({
            "doc_id": f"mod_{d.id}",
            "doc_type": "module",
            "title": o.get("title") or "Module",
            "text": body,
        })

    # Discussion messages — group all into one corpus document
    disc_lines = []
    for d in db.collection("discussions").where("courseId", "==", PSIKOLOGI_ID).stream():
        t = (d.to_dict().get("text") or "").strip()
        if len(t) >= 20:
            disc_lines.append(t)
    if disc_lines:
        body = "\n\n".join(disc_lines)
        if len(body) >= MIN_LEN:
            items.append({
                "doc_id": "discussions_corpus",
                "doc_type": "discussion",
                "title": "Course Discussions",
                "text": body,
            })

    return items


async def main():
    rag_service._chroma_client = None  # fresh client

    # Wipe ALL stale state docs for Psikologi so nothing short-circuits
    print("== Wiping stale state docs ==")
    state_col = db.collection(models.RAG_INDEX_STATE)
    wiped = 0
    for s in state_col.where("courseId", "==", PSIKOLOGI_ID).stream():
        s.reference.delete()
        wiped += 1
    print(f"  wiped {wiped} state docs")

    # Wipe the ChromaDB collection (should already be empty but be safe)
    col = rag_service._get_collection(PSIKOLOGI_ID)
    ids = col.get(include=[]).get("ids", []) or []
    if ids:
        col.delete(ids=ids)
        print(f"  cleared {len(ids)} stale chunks")

    # Harvest source content
    print("\n== Harvesting source content from Firestore ==")
    items = harvest()
    print(f"  found {len(items)} substantive documents:")
    from collections import Counter
    for t, n in Counter(x["doc_type"] for x in items).most_common():
        print(f"    {t}: {n}")

    # Re-index each
    print("\n== Indexing ==")
    done = 0
    for it in items:
        try:
            await rag_service.index_document(
                course_id=PSIKOLOGI_ID,
                doc_id=it["doc_id"],
                doc_type=it["doc_type"],
                title=it["title"],
                text=it["text"],
            )
            done += 1
        except Exception as e:
            print(f"  [skip] {it['doc_id']}: {type(e).__name__}: {str(e)[:100]}")

    final_count = col.count()
    print(f"\n== DONE ==  {done} documents indexed  ->  {final_count} chunks")


if __name__ == "__main__":
    asyncio.run(main())
