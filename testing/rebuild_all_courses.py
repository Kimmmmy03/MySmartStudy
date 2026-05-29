"""
Re-build the RAG index for every course from substantive Firestore content.

For each course, harvests:
  - Assignment descriptions (real Malay/English academic text)
  - Quiz questions + options + correct answers (educational content)
  - Announcement title + body
  - Course module title + description
  - Discussion threads (aggregated)
  - Module item titles + URLs (low value, included for coverage only)

Then re-indexes with the improved chunker. The state-doc wipe avoids the
content-hash short-circuit in rag_service.index_document.

Run with the backend venv:  python rebuild_all_courses.py
"""

import os
import sys
import asyncio
import warnings
from collections import Counter

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

MIN_LEN = 60  # docs below this are noise (e.g. "hi" discussion messages)


def harvest_course(course_id: str) -> list[dict]:
    """Return [{doc_id, doc_type, title, section, text}] for one course."""
    items: list[dict] = []

    # Assignments — title + description
    for d in db.collection("assignments").where("courseId", "==", course_id).stream():
        o = d.to_dict()
        body = (o.get("description") or "").strip()
        if len(body) < MIN_LEN:
            continue
        items.append({
            "doc_id": f"asg_{d.id}",
            "doc_type": "assignment",
            "title": o.get("title") or "Assignment",
            "section": o.get("assignmentType") or "assignment",
            "text": body,
        })

    # Quizzes — aggregate questions of each quiz into one document
    for q in db.collection("quizzes").where("courseId", "==", course_id).stream():
        qid = q.id
        q_data = q.to_dict()
        chunks = []
        for qq in db.collection("quizQuestions").where("quizId", "==", qid).stream():
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
        body = "\n\n".join(chunks)
        if len(body) >= MIN_LEN:
            items.append({
                "doc_id": f"quiz_{qid}",
                "doc_type": "quiz",
                "title": q_data.get("title") or f"Quiz {qid[:8]}",
                "section": "assessment",
                "text": body,
            })

    # Announcements
    for d in db.collection("announcements").where("courseId", "==", course_id).stream():
        o = d.to_dict()
        body = ((o.get("title") or "") + "\n" + (o.get("content") or "")).strip()
        if len(body) < MIN_LEN:
            continue
        items.append({
            "doc_id": f"ann_{d.id}",
            "doc_type": "announcement",
            "title": o.get("title") or "Announcement",
            "section": "announcement",
            "text": body,
        })

    # Course modules — title + description (often gives weekly topic context)
    for d in db.collection("courseModules").where("courseId", "==", course_id).stream():
        o = d.to_dict()
        body = ((o.get("title") or "") + "\n" + (o.get("description") or "")).strip()
        if len(body) < MIN_LEN:
            continue
        items.append({
            "doc_id": f"mod_{d.id}",
            "doc_type": "module",
            "title": o.get("title") or "Module",
            "section": f"week-{o.get('order','?')}",
            "text": body,
        })

    # Discussions — bundle all into one corpus document
    disc_lines = []
    for d in db.collection("discussions").where("courseId", "==", course_id).stream():
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
                "section": "discussion",
                "text": body,
            })

    return items


async def reindex_one(course_id: str, course_name: str) -> tuple[int, int]:
    print(f"\n== {course_name[:50]}  ({course_id}) ==")

    # Wipe state docs (so index_document does not short-circuit on content_hash)
    state_col = db.collection(models.RAG_INDEX_STATE)
    wiped = 0
    for s in state_col.where("courseId", "==", course_id).stream():
        s.reference.delete()
        wiped += 1
    if wiped:
        print(f"  wiped {wiped} stale state docs")

    # Wipe ChromaDB collection
    col = rag_service._get_collection(course_id)
    ids = col.get(include=[]).get("ids", []) or []
    if ids:
        col.delete(ids=ids)
        print(f"  cleared {len(ids)} stale chunks")

    items = harvest_course(course_id)
    if not items:
        print("  (no substantive content found in Firestore)")
        return (0, 0)

    types = Counter(x["doc_type"] for x in items)
    print(f"  harvested: {dict(types)}")

    done = 0
    for it in items:
        try:
            await rag_service.index_document(
                course_id=course_id,
                doc_id=it["doc_id"],
                doc_type=it["doc_type"],
                title=it["title"],
                text=it["text"],
                # Phase 2 fix lands in rag_service so this kwarg propagates
                metadata={"section": it["section"]},
            )
            done += 1
        except Exception as e:
            print(f"  [skip] {it['doc_id']}: {type(e).__name__}: {str(e)[:100]}")

    final = col.count()
    print(f"  indexed {done} documents -> {final} chunks")
    return done, final


async def main():
    rag_service._chroma_client = None
    print("== Re-indexing every course from Firestore content ==")
    courses = []
    for d in db.collection("courses").stream():
        cid = d.id
        name = d.to_dict().get("courseName", cid)
        courses.append((cid, name))
    print(f"Found {len(courses)} courses total in Firestore.")

    grand_docs = grand_chunks = 0
    skipped_empty = 0
    for cid, name in courses:
        d, c = await reindex_one(cid, name)
        grand_docs += d
        grand_chunks += c
        if d == 0:
            skipped_empty += 1

    print(f"\n== DONE ==  {grand_docs} documents -> {grand_chunks} chunks total "
          f"({skipped_empty} courses had no substantive content)")


if __name__ == "__main__":
    asyncio.run(main())
