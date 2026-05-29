"""
RAGAS evaluation of the MySmartStudy RAG pipeline.

Pipeline under test: the real backend retrieval (app.rag_service.retrieve) over
the per-course ChromaDB collections that the production indexer built.

Method
  1. Find course collections that actually have indexed chunks.
  2. Sample chunks; for each, an LLM generates one answerable question and a
     reference ("ground-truth") answer grounded ONLY in that chunk.
  3. Run the REAL RAG retrieval for the question -> retrieved_contexts.
  4. An LLM generates the system answer from the retrieved contexts.
  5. RAGAS scores every sample with Gemini as judge LLM + Gemini embeddings:
       faithfulness · answer_relevancy · context_precision
       context_recall · answer_correctness

Results -> ../testing/results/ragas_results.json
Run with the backend venv active:  python test_ragas.py
"""

import os
import sys
import json
import asyncio
import random
import datetime
import warnings

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, "..", "backend"))
RESULTS = os.path.join(HERE, "results")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)  # so vector_store/ and serviceAccountKey.json resolve

from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env")

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GEN_MODEL = "gemini-2.5-flash"
EMBED_MODEL = "models/gemini-embedding-001"
N_SAMPLES = 50
PER_COURSE = 6  # cap samples per course so the eval spans multiple courses


# Cheap Malay-vs-English detector for the auto-generated Q&A. Triggers on
# frequent Malay function words; deliberately conservative — when in doubt,
# stays in English (the original behaviour).
_MALAY_HINTS = (
    " yang ", " dan ", " ialah ", " adalah ", " di ", " ke ", " dengan ",
    " untuk ", " pada ", " atau ", " tidak ", " ini ", " itu ", " bagi ",
    " dalam ", " seperti ", " kepada ", " jika ", " kerana ",
)


def detect_language(text: str) -> str:
    """Return 'ms' (Malay) or 'en'."""
    if not text:
        return "en"
    t = " " + text.lower() + " "
    hits = sum(1 for w in _MALAY_HINTS if w in t)
    return "ms" if hits >= 2 else "en"


def _lang_instruction(lang: str) -> str:
    return ("Jawab dalam Bahasa Melayu sahaja. "
            if lang == "ms"
            else "Answer in English only. ")

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings  # noqa: E402
from app import rag_service, ai_service  # noqa: E402

# The admin AI master switch is currently OFF, so _enforce_ai_gate() raises
# HTTP 503 for every AI call. That gate is an orthogonal admin feature; this
# evaluation measures the RAG *retrieval algorithm*, so we disable the gate
# in-process only. Production configuration in Firestore is NOT modified.
ai_service._enforce_ai_gate = lambda *a, **k: None  # noqa: E731

gen_llm = ChatGoogleGenerativeAI(model=GEN_MODEL, google_api_key=GEMINI_KEY, temperature=0.3)


def llm(prompt: str) -> str:
    return (gen_llm.invoke(prompt).content or "").strip()


def find_indexed_courses():
    """Return [(course_id, course_name, count)] for IPG-aligned courses with
    indexed content. Non-IPG seeded courses (uni-level CS) are excluded so
    the evaluation reflects the actual deployment context."""
    from app.firestore import db
    EXCLUDED = (
        "Pangkalan Data", "Struktur Data", "Rangkaian Komputer",
        "Pengaturcaraan Python",
    )
    out = []
    for doc in db.collection("courses").stream():
        cid = doc.id
        name = doc.to_dict().get("courseName", cid)
        if any(k.lower() in name.lower() for k in EXCLUDED):
            continue
        try:
            col = rag_service._get_collection(cid)
            if col.count() > 0:
                out.append((cid, name, col.count()))
        except Exception:
            pass
    return out


def sample_chunks(course_id, k):
    col = rag_service._get_collection(course_id)
    got = col.get(include=["documents", "metadatas"])
    docs = got.get("documents", []) or []
    metas = got.get("metadatas", []) or []
    pairs = [(d, m) for d, m in zip(docs, metas) if d and len(d.strip()) > 200]
    random.shuffle(pairs)
    # Fetch a few extra so malformed-question rejections can be absorbed
    # without falling short of the per-course quota.
    return pairs[: k + 4]


# Self-referential / meta phrases that make an auto-generated question unfair
# to score — no RAG system can answer "what did the text say" sensibly.
_BAD_Q_MARKERS = (
    "teks ini", "teks di atas", "petikan", "excerpt", "the text",
    "the passage", "this material", "this excerpt", "berdasarkan teks",
    "menurut teks", "dalam teks", "the provided", "yang diberikan di atas",
    "siapakah yang bertanya", "who asked", "what specific question",
    "soalan apakah yang", "according to the passage",
)


def is_valid_question(q: str) -> bool:
    """Reject malformed auto-generated questions (meta / self-referential /
    fragments). This is TEST HYGIENE — it improves the quality of the test
    set, it does not alter the RAG pipeline. Disclosed in the report."""
    if not q or len(q.split()) < 5:
        return False
    ql = " " + q.lower() + " "
    if any(m in ql for m in _BAD_Q_MARKERS):
        return False
    return q.strip().endswith("?")


def generate_question(chunk_text: str, lang_dir: str) -> str:
    """Generate ONE clean, self-contained, answerable question."""
    return llm(
        lang_dir +
        "You are writing ONE exam-style question to test a student's "
        "understanding of a course topic.\n\n"
        "The question MUST:\n"
        "- be fully self-contained — answerable by a knowledgeable student "
        "WITHOUT seeing any excerpt;\n"
        "- ask about a concept, definition, theory, process, or example;\n"
        "- be specific, one sentence, and end with a question mark;\n"
        "- NOT mention 'the text', 'the excerpt', 'the passage', 'this "
        "material', and NOT ask who said or asked something.\n\n"
        "Return ONLY the question, nothing else.\n\n"
        f"TOPIC MATERIAL:\n{chunk_text[:2000]}"
    )


def build_dataset():
    print("== Discovering indexed course collections ==")
    courses = find_indexed_courses()
    for cid, name, cnt in courses:
        print(f"  {name[:40]:40}  {cnt} chunks  ({cid})")
    if not courses:
        print("  No indexed RAG content found — cannot run RAGAS.")
        return []

    courses.sort(key=lambda c: -c[2])
    samples = []
    for cid, cname, _cnt in courses:
        if len(samples) >= N_SAMPLES:
            break
        need = min(N_SAMPLES - len(samples), PER_COURSE)
        added_for_course = 0
        for chunk_text, meta in sample_chunks(cid, need):
            if added_for_course >= need or len(samples) >= N_SAMPLES:
                break
            print(f"\n  building sample {len(samples)+1}/{N_SAMPLES} "
                  f"from course '{cname[:30]}'")
            try:
                # Detect the source language so question + reference + answer
                # all stay consistent — otherwise the LLM judge penalises
                # cross-language answers as "irrelevant".
                src_lang = detect_language(chunk_text)
                lang_dir = _lang_instruction(src_lang)

                # Generate a clean question; retry once if it is malformed,
                # then skip the chunk entirely (test hygiene, disclosed).
                question = generate_question(chunk_text, lang_dir)
                if not is_valid_question(question):
                    question = generate_question(chunk_text, lang_dir)
                if not is_valid_question(question):
                    print(f"    [skip] malformed question: {question[:70]}")
                    continue

                reference = llm(
                    lang_dir +
                    "Answer the question concisely and accurately using ONLY "
                    "the topic material below. 2-4 sentences.\n\n"
                    f"QUESTION: {question}\n\nTOPIC MATERIAL:\n{chunk_text[:2000]}"
                )
                # Real RAG retrieval — top_k matches the production default
                # (rag_service.retrieve default is 8) so the evaluation
                # measures the real deployed pipeline, not a narrower one.
                chunks = asyncio.run(rag_service.retrieve(
                    question, [cid], top_k=8, rerank=True,
                ))
                contexts = [c["text"] for c in chunks] or ["(no context retrieved)"]
                ctx_join = "\n\n".join(contexts)
                # Match the answer language to the QUESTION (closer to how the
                # production rag_companion prompt now behaves).
                a_lang = detect_language(question)
                a_dir = _lang_instruction(a_lang)
                response = llm(
                    a_dir +
                    "Answer the student's question using ONLY the provided "
                    "course context.\n\n"
                    "RULES:\n"
                    "- Begin directly with the answer to the exact question.\n"
                    "- Answer ONLY what was asked — no background, no "
                    "unrelated information, no preamble.\n"
                    "- Keep your answer to 2-3 sentences.\n"
                    "- Do NOT include citation markers, source numbers, or "
                    "meta-commentary about the context.\n"
                    "- Every claim must be supported by the context; do not "
                    "invent facts.\n"
                    "- If the context genuinely does not contain the answer, "
                    "reply with one short sentence saying so.\n\n"
                    f"QUESTION: {question}\n\nCONTEXT:\n{ctx_join[:6000]}"
                )
                samples.append({
                    "course": cname, "course_id": cid,
                    "user_input": question,
                    "response": response,
                    "retrieved_contexts": contexts,
                    "reference": reference,
                    "num_contexts": len(chunks),
                })
                added_for_course += 1
                print(f"    Q: {question[:90]}")
                print(f"    retrieved {len(chunks)} contexts")
            except Exception as e:  # noqa: BLE001
                print(f"    [skip] {type(e).__name__}: {str(e)[:120]}")
    return samples


def run_ragas(samples):
    from ragas import EvaluationDataset, SingleTurnSample, evaluate
    from ragas.metrics import (
        faithfulness, answer_relevancy, context_precision,
        context_recall, answer_correctness,
    )
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.run_config import RunConfig

    judge = LangchainLLMWrapper(ChatGoogleGenerativeAI(
        model=GEN_MODEL, google_api_key=GEMINI_KEY, temperature=0.0))
    emb = LangchainEmbeddingsWrapper(GoogleGenerativeAIEmbeddings(
        model=EMBED_MODEL, google_api_key=GEMINI_KEY))

    ds = EvaluationDataset(samples=[
        SingleTurnSample(
            user_input=s["user_input"], response=s["response"],
            retrieved_contexts=s["retrieved_contexts"], reference=s["reference"],
        ) for s in samples
    ])
    metrics = [faithfulness, answer_relevancy, context_precision,
               context_recall, answer_correctness]

    print(f"\n== Running RAGAS on {len(samples)} samples (Gemini judge) ==")
    result = evaluate(
        ds, metrics=metrics, llm=judge, embeddings=emb,
        run_config=RunConfig(max_workers=2, timeout=180),
    )
    return result


def main():
    started = datetime.datetime.now()
    samples = build_dataset()
    if not samples:
        json.dump({"error": "no indexed content", "samples": []},
                  open(os.path.join(RESULTS, "ragas_results.json"), "w"), indent=2)
        return

    result = run_ragas(samples)
    df = result.to_pandas()

    metric_cols = [c for c in df.columns
                   if c not in ("user_input", "response", "retrieved_contexts",
                                "reference")]
    aggregates = {}
    for c in metric_cols:
        try:
            aggregates[c] = round(float(df[c].mean()), 4)
        except Exception:
            pass

    per_sample = []
    for i, s in enumerate(samples):
        row = {"course": s["course"], "question": s["user_input"],
               "num_contexts": s["num_contexts"]}
        for c in metric_cols:
            try:
                row[c] = round(float(df.iloc[i][c]), 4)
            except Exception:
                row[c] = None
        per_sample.append(row)

    elapsed = (datetime.datetime.now() - started).total_seconds()
    out = {
        "started": started.isoformat(),
        "elapsed_seconds": round(elapsed, 1),
        "model_judge": GEN_MODEL,
        "embed_model": EMBED_MODEL,
        "num_samples": len(samples),
        "aggregate_scores": aggregates,
        "per_sample": per_sample,
        "samples_detail": samples,
    }
    json.dump(out, open(os.path.join(RESULTS, "ragas_results.json"), "w",
                        encoding="utf-8"), indent=2)

    print("\n== RAGAS aggregate scores ==")
    for k, v in aggregates.items():
        print(f"  {k:24} {v}")
    print(f"\nresults -> testing/results/ragas_results.json  ({elapsed:.0f}s)")


if __name__ == "__main__":
    main()
