"""
Smoke test for the four GAG (Generation-Augmented Generation) generators.

Each generator returns a structured artifact (a Pydantic-validated dict).
This script:
  1. Calls every generator with realistic IPG-context inputs.
  2. Verifies the response is a dict and contains the expected top-level keys.
  3. Records the call time and a short content-sanity check.
  4. Writes results to results/gag_results.json for the report.

Targets the same admin-gate-bypassed pipeline used elsewhere in /testing.
"""

import os
import sys
import json
import time
import asyncio
import datetime
import warnings

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, "..", "backend"))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env")

from app import rag_service, ai_service, gag_service  # noqa: E402
from app.firestore import db  # noqa: E402

ai_service._enforce_ai_gate = lambda *a, **k: None  # noqa: E731

RESULTS = os.path.join(HERE, "results")
os.makedirs(RESULTS, exist_ok=True)


def first_ipg_course_id() -> str | None:
    """Pick an IPG-aligned course that actually has indexed content."""
    for d in db.collection("courses").stream():
        cid = d.id
        name = d.to_dict().get("courseName", "")
        if any(k in name for k in (
            "Psikologi Perkembangan", "Profesionalisme Keguruan",
            "Bimbingan dan Kaunseling", "Pengantar Linguistik Melayu",
        )):
            try:
                if rag_service._get_collection(cid).count() > 0:
                    return cid
            except Exception:
                pass
    return None


async def fetch_context(course_id: str, query: str, top_k: int = 4):
    chunks = await rag_service.retrieve(query, [course_id], top_k=top_k)
    return chunks


def check(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {name}  {detail}")
    return {"name": name, "ok": ok, "detail": detail}


async def test_study_plan(course_id):
    started = time.time()
    chunks = await fetch_context(course_id,
                                 "Apakah teori perkembangan utama kanak-kanak?")
    student_ctx = {
        "name": "Nurul Aisyah",
        "today": datetime.date.today().isoformat(),
        "weak_topics": ["Teori Erikson", "Teori Piaget"],
        "quiz_scores": [{"course": "Psikologi Perkembangan", "score": 55}],
        "timetables": [],
    }
    deadlines = [{"title": "Tugasan refleksi peringkat psikososial",
                  "course": "Psikologi Perkembangan",
                  "deadline": (datetime.date.today() +
                               datetime.timedelta(days=3)).isoformat()}]
    out = await gag_service.generate_study_plan_artifact(
        student_ctx, chunks, deadlines, exam_info=None,
    )
    elapsed = round(time.time() - started, 2)
    return {
        "feature": "study_plan",
        "elapsed_seconds": elapsed,
        "result_keys": sorted(list(out.keys())) if isinstance(out, dict) else [],
        "checks": [
            check("dict_returned", isinstance(out, dict)),
            check("recommendations_present",
                  isinstance(out.get("recommendations"), list)),
            check("recommendations_non_empty",
                  bool(out.get("recommendations")),
                  f"{len(out.get('recommendations',[]))} items"),
        ],
        "sample": (out.get("recommendations") or [None])[0],
    }


async def test_grading_report(course_id):
    started = time.time()
    chunks = await fetch_context(course_id, "Tugasan refleksi pelajar")
    submission = (
        "Refleksi saya: Teori Erikson menjelaskan lapan peringkat psikososial "
        "yang dilalui seseorang sepanjang hayat. Setiap peringkat melibatkan "
        "krisis yang perlu diselesaikan. Untuk peringkat sekolah rendah, "
        "krisis utama ialah Industri lawan Rendah Diri. Guru perlu memberi "
        "peluang pelajar berasa berjaya dalam tugasan akademik."
    )
    rubric = [
        {"name": "Kefahaman teori", "description": "Penerangan teori adalah tepat",
         "maxPoints": 30},
        {"name": "Aplikasi pendidikan",
         "description": "Kaitan dengan amalan PdPc", "maxPoints": 30},
        {"name": "Penulisan",
         "description": "Tatabahasa dan struktur baik", "maxPoints": 20},
        {"name": "Refleksi peribadi",
         "description": "Refleksi mendalam dan jujur", "maxPoints": 20},
    ]
    assignment_info = {"title": "Refleksi Teori Erikson",
                       "description": "Refleksi tentang peringkat psikososial",
                       "class_stats": {"average": 72, "median": 75}}
    out = await gag_service.generate_grading_report(
        submission, rubric, chunks, assignment_info,
    )
    elapsed = round(time.time() - started, 2)
    grade = out.get("recommended_grade") if isinstance(out, dict) else None
    return {
        "feature": "grading_report",
        "elapsed_seconds": elapsed,
        "result_keys": sorted(list(out.keys())) if isinstance(out, dict) else [],
        "checks": [
            check("dict_returned", isinstance(out, dict)),
            check("recommended_grade_present", grade is not None,
                  f"value={grade}"),
            check("grade_in_range",
                  isinstance(grade, (int, float)) and 0 <= grade <= 100,
                  f"value={grade}"),
            check("justification_non_empty",
                  bool(str(out.get("justification", "")).strip())),
        ],
        "route": out.get("_grading_route") if isinstance(out, dict) else None,
    }


async def test_graph_suggestions(course_id):
    started = time.time()
    chunks = await fetch_context(course_id, "Peringkat perkembangan kognitif")
    map_nodes = [
        {"id": "n1", "label": "Teori Piaget"},
        {"id": "n2", "label": "Peringkat Sensorimotor"},
    ]
    map_edges = [{"source": "n1", "target": "n2"}]
    concept_subgraph = {"nodes": {}, "edges": []}
    out = await gag_service.generate_graph_suggestions(
        map_nodes, map_edges, chunks, concept_subgraph,
        map_title="Teori Perkembangan", task_description="Mind map of Piaget",
    )
    elapsed = round(time.time() - started, 2)
    suggestions = out.get("suggestions") if isinstance(out, dict) else None
    return {
        "feature": "graph_suggestions",
        "elapsed_seconds": elapsed,
        "result_keys": sorted(list(out.keys())) if isinstance(out, dict) else [],
        "checks": [
            check("dict_returned", isinstance(out, dict)),
            check("suggestions_present", isinstance(suggestions, list)),
            check("suggestions_non_empty", bool(suggestions),
                  f"{len(suggestions or [])} items"),
            check("first_has_label",
                  bool(suggestions and suggestions[0].get("label"))),
        ],
        "sample": (suggestions or [None])[0],
    }


async def test_plagiarism_network(course_id):
    started = time.time()
    similarity_graph = {
        "nodes": [{"id": "s1"}, {"id": "s2"}, {"id": "s3"}],
        "edges": [
            {"source": "s1", "target": "s2", "similarity": 0.88},
            {"source": "s2", "target": "s3", "similarity": 0.72},
        ],
    }
    clusters = [["s1", "s2"]]
    submission_contents = {
        "s1": "Teori Erikson mempunyai lapan peringkat psikososial.",
        "s2": "Teori Erikson juga mempunyai lapan peringkat psikososial.",
        "s3": "Erikson membentangkan teori dengan lapan peringkat dalam hidup manusia.",
    }
    out = await gag_service.generate_plagiarism_network_report(
        similarity_graph, clusters, submission_contents,
    )
    elapsed = round(time.time() - started, 2)
    flagged = out.get("flagged_clusters") if isinstance(out, dict) else None
    return {
        "feature": "plagiarism_network",
        "elapsed_seconds": elapsed,
        "result_keys": sorted(list(out.keys())) if isinstance(out, dict) else [],
        "checks": [
            check("dict_returned", isinstance(out, dict)),
            check("flagged_clusters_present", isinstance(flagged, list)),
            check("network_graph_attached",
                  isinstance(out.get("network_graph"), dict)),
            check("summary_non_empty",
                  bool(str(out.get("summary", "")).strip())),
        ],
    }


async def main():
    print("== GAG Generators Smoke Test ==")
    course_id = first_ipg_course_id()
    if not course_id:
        print("No IPG course with indexed content found. Run seed_ipg_content.py first.")
        return
    print(f"  using course_id={course_id}\n")

    results = []
    for fn in (test_study_plan, test_grading_report,
               test_graph_suggestions, test_plagiarism_network):
        print(f"-- {fn.__name__} --")
        try:
            r = await fn(course_id)
        except Exception as e:
            r = {"feature": fn.__name__, "error":
                 f"{type(e).__name__}: {str(e)[:200]}"}
            print(f"  [FAIL] {r['error']}")
        results.append(r)

    summary = {
        "started": datetime.datetime.now().isoformat(),
        "course_id": course_id,
        "generators_tested": len(results),
        "results": results,
    }
    out = os.path.join(RESULTS, "gag_results.json")
    json.dump(summary, open(out, "w", encoding="utf-8"),
              indent=2, default=str)
    print(f"\n== DONE ==  results -> {out}")


if __name__ == "__main__":
    asyncio.run(main())
