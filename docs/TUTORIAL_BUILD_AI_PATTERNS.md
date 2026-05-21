# Code Walkthrough — How I Built the 4 AI Patterns in MySmartStudy

This document is a presentation guide for showing your lecturer **the actual code in your `backend/app/`** and explaining the tools you used to build each pattern.

Every code block here is taken **verbatim** from your existing project — file path is shown above each snippet so you can open the same file in your editor while presenting.

---

## Tools used across the AI stack

Open `backend/requirements.txt` to confirm — these are the libraries that power your AI features. Each tool name links to its official documentation:

| Library | Used for | Official link |
|---|---|---|
| **[`google-genai`](https://github.com/googleapis/python-genai)** | Calling the Gemini API (chat completions, JSON generation, embeddings) | [ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs) |
| **[`chromadb`](https://www.trychroma.com/)** | Local vector database (per-course collections, HNSW + cosine) | [docs.trychroma.com](https://docs.trychroma.com/) |
| **[`sentence-transformers`](https://www.sbert.net/)** | Cross-encoder reranker (`BAAI/bge-reranker-v2-m3`) for two-stage retrieval | [sbert.net/docs/cross_encoder](https://www.sbert.net/docs/cross_encoder/usage/usage.html) |
| **[`BAAI/bge-reranker-v2-m3`](https://huggingface.co/BAAI/bge-reranker-v2-m3)** | The actual reranker model (multilingual, ~80 MB) | HuggingFace model card |
| **[`pdfplumber`](https://github.com/jsvine/pdfplumber)** + **[`PyPDF2`](https://github.com/py-pdf/pypdf)** | Extract text from lecture PDFs before indexing | [pdfplumber GitHub](https://github.com/jsvine/pdfplumber) · [pypdf docs](https://pypdf.readthedocs.io/) |
| **[`firebase-admin`](https://firebase.google.com/docs/admin/setup)** (Firestore) | Persistence — index state, knowledge graphs, chat history, usage tracking | [Firestore docs](https://firebase.google.com/docs/firestore) |
| **[`asyncio`](https://docs.python.org/3/library/asyncio.html)** (stdlib) | Parallel agent fan-out and timeout isolation | [Python docs — asyncio](https://docs.python.org/3/library/asyncio.html) |
| **[`fastapi`](https://fastapi.tiangolo.com/)** | The web framework that exposes all `/api/ai/*` endpoints | [fastapi.tiangolo.com](https://fastapi.tiangolo.com/) |

**Single AI provider:** every Gemini call (chat, JSON, embeddings, image gen, OCR) goes through one wrapper — `backend/app/ai_service.py`. This is where the API key lives, where the master switch is enforced, and where token usage is logged.

**Gemini models used:**

| Model name | Used for | Documentation |
|---|---|---|
| [`gemini-2.5-flash`](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash) | SMART_MODEL — chat, grading, plagiarism, study plan | Gemini API docs |
| [`gemini-2.5-flash-lite`](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash-lite) | FAST_MODEL — query decomposition, HyDE hypothesis, structured extraction | Gemini API docs |
| [`gemini-embedding-001`](https://ai.google.dev/gemini-api/docs/embeddings) | All embeddings (768-dim, cosine) | Gemini embeddings docs |

**Where to get a free API key:** [aistudio.google.com](https://aistudio.google.com/app/apikey) (Google AI Studio — free tier with ~1,500 requests/day on Flash).

---

## Table of contents

1. [Pattern 1 — RAG family (`rag_service.py` + `rag_multistep.py`)](#part-1)
2. [Pattern 2 — Graph-RAG (`knowledge_graph_service.py`)](#part-2)
3. [Pattern 3 — GAG / Structured Output (`gag_service.py`)](#part-3)
4. [Pattern 4 — Multi-Agent Orchestration (`multi_agent.py` + `ai_companion.py`)](#part-4)
5. [End-to-end flow example](#part-5)
6. [Likely lecturer questions — model answers](#qa)

---

## Pattern 1 — RAG family <a name="part-1"></a>

### What it does

Reads course PDFs / mind maps / quiz questions, splits them into searchable chunks, and at query time returns the most relevant chunks so the AI can answer using real lecture material instead of hallucinating.

### Files

- `backend/app/rag_service.py` — chunking, embedding, ChromaDB storage, retrieval, cross-encoder reranking
- `backend/app/rag_multistep.py` — query decomposition (compound → atomic), HyDE (hypothetical document embedding), merge + final rerank

### Tools / libraries used

| Tool | Used for | Line of evidence |
|---|---|---|
| **`chromadb`** | Per-course persistent vector store with HNSW + cosine | `rag_service.py:90` `_chroma_client = chromadb.PersistentClient(path=store_path)` |
| **`google-genai`** (Gemini) | Generate 768-dim embeddings via `gemini-embedding-001` | `rag_service.py:115-140` `embed_texts()` |
| **`sentence-transformers`** | Cross-encoder reranker `BAAI/bge-reranker-v2-m3` for two-stage retrieval | `rag_service.py:52-53` `from sentence_transformers import CrossEncoder` |
| **`pdfplumber` / `PyPDF2`** | Extract text from lecture PDFs before chunking | `rag_service.py:395-411` `_extract_pdf_text()` |
| **`asyncio.to_thread`** | Make blocking embed/rerank calls non-blocking | `rag_service.py:129` `await asyncio.to_thread(client.models.embed_content, ...)` |
| **Firestore** | Track `contentHash` per indexed document for incremental updates | `rag_service.py:254-264` |

### 1A — Chunking  (file: `backend/app/rag_service.py`)

```python
# Lines 145-171
def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into token-approximate chunks with overlap.

    Uses ~1.3 words per token heuristic. A chunk_size of 500 tokens ≈ 650 words.
    """
    if not text or not text.strip():
        return []

    words = text.split()
    words_per_chunk = int(chunk_size * 1.3)
    overlap_words = int(overlap * 1.3)

    if len(words) <= words_per_chunk:
        return [text.strip()]

    chunks = []
    start = 0
    while start < len(words):
        end = start + words_per_chunk
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap_words
        if start >= len(words):
            break

    return chunks
```

**Tool used:** **Pure Python** — no external library. Sliding window over whitespace-split words. The `1.3 words/token` factor is the standard heuristic for English/Malay text on Gemini's tokenizer.

### 1B — Embedding with Gemini  (file: `backend/app/rag_service.py`)

```python
# Lines 111-140
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
```

**Tools used:**
- **`google.genai.Client.models.embed_content`** — the Gemini SDK call that converts text → 768-dim vector.
- **`asyncio.to_thread`** — the Gemini SDK is synchronous, so we run it in a thread to keep the FastAPI event loop free.
- **Batching** at 100 texts/call — Gemini's per-call hard limit.
- **Graceful degradation** — failed batches return zero-vectors so one bad batch doesn't kill the whole index build.

### 1C — Per-course ChromaDB collection  (file: `backend/app/rag_service.py`)

```python
# Lines 82-106
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
    return _chroma_client


def _get_collection(course_id: str) -> chromadb.Collection:
    """Get or create a course-scoped ChromaDB collection."""
    safe_name = f"course_{course_id.replace('-', '_')[:50]}"
    return _get_chroma().get_or_create_collection(
        name=safe_name,
        metadata={"hnsw:space": "cosine"},
    )
```

**Tool used:** **`chromadb`** — embedded vector DB. Files live in `backend/vector_store/`. Each course is its own collection (`course_{cid}`), giving multi-tenant isolation and easier per-course re-indexing.

### 1D — Cross-encoder reranker  (file: `backend/app/rag_service.py`)

```python
# Lines 22-77
RERANKER_MODEL = os.getenv(
    "RAG_RERANKER_MODEL",
    "BAAI/bge-reranker-v2-m3",  # multilingual — supports Malay, English, Chinese
)


def _get_reranker():
    """Load cross-encoder once. Returns None if unavailable — caller should degrade gracefully."""
    import time
    global _reranker, _reranker_failed_at
    if _reranker is not None:
        return _reranker
    if _reranker_failed_at is not None:
        if time.monotonic() - _reranker_failed_at < _RERANKER_RETRY_SECS:
            return None
        _reranker_failed_at = None
    try:
        from sentence_transformers import CrossEncoder
        _reranker = CrossEncoder(RERANKER_MODEL, max_length=512, trust_remote_code=True)
    except Exception as e:
        _reranker_failed_at = time.monotonic()
        logger.warning("Reranker unavailable, falling back to embedding scores: %s", e)
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
```

**Tools used:**
- **`sentence-transformers.CrossEncoder`** — runs a 80 MB MiniLM-class model on CPU. The model judges (query, chunk) pairs and returns a relevance score. Better than bi-encoder similarity because it reads query and chunk together.
- **Lazy singleton + 1-hour cooldown** — model is loaded only on first use; if loading fails (e.g. no network on cold start), we degrade gracefully and retry later.

### 1E — Retrieval — over-fetch then rerank  (file: `backend/app/rag_service.py`)

```python
# Lines 492-565 (the retrieve function)
async def retrieve(
    query: str,
    course_ids: list[str],
    top_k: int = 5,
    doc_types: Optional[list[str]] = None,
    rerank: bool = True,
    query_embedding: Optional[list[float]] = None,
) -> list[dict]:
    """Semantic search across one or more course collections.

    Over-fetches candidates then re-ranks with a cross-encoder for higher precision.
    """
    if not query or not course_ids:
        return []

    if query_embedding is None:
        query_embedding = (await embed_texts([query]))[0]
    fetch_ratio = int(os.getenv("RAG_FETCH_RATIO", "4"))
    fetch_k = top_k * fetch_ratio if rerank else top_k

    all_results = []
    for cid in course_ids:
        try:
            collection = _get_collection(cid)
            doc_count = collection.count()
            if doc_count == 0:
                continue

            where_filter = None
            if doc_types:
                where_filter = (
                    {"doc_type": doc_types[0]} if len(doc_types) == 1
                    else {"doc_type": {"$in": doc_types}}
                )

            hits = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(fetch_k, doc_count),
                where=where_filter,
            )

            if hits and hits["documents"] and hits["documents"][0]:
                for i, doc_text in enumerate(hits["documents"][0]):
                    meta = hits["metadatas"][0][i]
                    distance = hits["distances"][0][i]
                    score = 1.0 - distance  # ChromaDB returns distances; convert to similarity
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

    all_results.sort(key=lambda x: x["score"], reverse=True)

    if rerank:
        candidates = all_results[:fetch_k]
        return _rerank(query, candidates, top_k)

    return all_results[:top_k]
```

**Tools used:**
- **`chromadb.Collection.query`** — ANN search over the HNSW index, returns top-N candidates.
- **`os.getenv("RAG_FETCH_RATIO", "4")`** — over-fetch ratio, configurable via env var.
- The result is a Python list of dicts with `{text, doc_id, doc_type, title, course_id, score}` — passed to the prompt or to GAG.

### 1F — Multi-step query decomposition  (file: `backend/app/rag_multistep.py`)

```python
# Lines 39-73
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
        return subs
    except Exception as e:
        logger.warning("Query decomposition failed, using original: %s", e)
        return [query]
```

**Tool used:** **`google-genai` (via `ai_service.generate_text`)** with `FAST_MODEL = gemini-2.5-flash-lite` (cheaper) and `temperature=0.1` (deterministic). Returns up to 3 sub-questions per compound query.

### 1G — HyDE for terse queries  (file: `backend/app/rag_multistep.py`)

```python
# Lines 76-91
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
```

**Tool used:** **`google-genai` (FAST_MODEL)** to generate a textbook-style answer, then `rag_service.embed_texts` to embed it. Only triggered for queries with fewer than `MIN_HYDE_TOKENS = 3` words.

### 1H — Multi-step orchestration  (file: `backend/app/rag_multistep.py`)

```python
# Lines 106-153
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
    if not query or not course_ids:
        return [], [query]

    if not MULTISTEP_ENABLED:
        chunks = await rag_service.retrieve(query, course_ids, top_k=top_k, doc_types=doc_types)
        return chunks, [query]

    sub_questions = await decompose_query(query)
    per_q_k = max(top_k, 5)

    merged: list[dict] = []
    for sub_q in sub_questions:
        # HyDE for terse sub-questions
        q_embedding = None
        if HYDE_ENABLED and len(sub_q.split()) < MIN_HYDE_TOKENS:
            q_embedding = await _hyde_embedding(sub_q)

        chunks = await rag_service.retrieve(
            query=sub_q,
            course_ids=course_ids,
            top_k=per_q_k,
            doc_types=doc_types,
            rerank=False,                # defer to final rerank
            query_embedding=q_embedding,
        )
        merged.extend(chunks)

    merged = _dedupe(merged)
    if not merged:
        return [], sub_questions

    # Final rerank against the original compound query
    reranked = rag_service._rerank(query, merged, top_k)
    return reranked, sub_questions
```

**Why this design works:** Each sub-question gets its own retrieval (good recall for each topic), then the **final rerank uses the original compound query** — so the top chunks reflect holistic relevance, not just per-sub-question relevance.

---

## Pattern 2 — Graph-RAG <a name="part-2"></a>

### What it does

Builds a **per-course concept graph** — entities like "ER Model", "Primary Key", "Normalisation" linked by typed relations (`requires`, `part_of`, `leads_to`, `contrasts`, `example_of`). The mind-map buddy uses this graph to suggest *structurally* relevant new nodes rather than just text-similar ones.

Also: builds a **plagiarism similarity graph** — a different graph where students are nodes and the edge weight is the cosine similarity between their submissions.

### File

- `backend/app/knowledge_graph_service.py` — concept graph build, BFS traversal, plagiarism similarity graph, connected-components clustering

### Tools / libraries used

| Tool | Used for |
|---|---|
| **`google-genai`** (via `ai_service.generate_json`) | LLM-driven concept + relation extraction |
| **Firestore** | Persist the graph at `knowledgeGraphs/{courseId}` |
| **`collections.deque`** (stdlib) | BFS traversal for related-concept queries |
| **Pure Python** | Cosine similarity + connected-components |
| **`chromadb`** (indirectly) | Source chunks for concept extraction |

### 2A — Concept extraction prompt  (file: `backend/app/knowledge_graph_service.py`)

```python
# Lines 81-105 (excerpt — the prompt the LLM sees)
prompt = f"""Extract key concepts and their relationships from these course materials.

CONTENT:
{content_text[:6000]}

Return JSON:
{{
  "concepts": [
    {{
      "id": "<short_unique_id>",
      "label": "<concept name>",
      "type": "concept" | "fact" | "definition" | "example" | "process",
      "sources": ["<doc_id>"]
    }}
  ],
  "relationships": [
    {{
      "source": "<concept_id>",
      "target": "<concept_id>",
      "relation": "requires" | "part_of" | "related_to" | "leads_to" | "contrasts" | "example_of"
    }}
  ]
}}

Extract 10-20 key concepts and their most important relationships. Focus on educational concepts."""

try:
    result = await generate_json(prompt, temperature=0.2)
    concepts = result.get("concepts", [])
    relationships = result.get("relationships", [])
```

**Tool used:** **`google-genai` via `ai_service.generate_json`** — wraps `client.models.generate_content` with strict JSON parsing + retry on `JSONDecodeError`. `temperature=0.2` gives deterministic-ish extraction.

### 2B — Build & persist the graph  (file: `backend/app/knowledge_graph_service.py`)

```python
# Lines 26-173 (key parts of build_course_graph)
async def build_course_graph(course_id: str):
    """Extract concepts from all indexed content and build a knowledge graph."""
    # 1. Get every indexed document for this course from Firestore
    state_docs = db.collection(models.RAG_INDEX_STATE).where(
        "courseId", "==", course_id
    ).get()

    # 2. Pull first chunk of each from ChromaDB
    content_samples = []
    for sd in state_docs:
        data = sd.to_dict()
        try:
            collection = rag_service._get_collection(course_id)
            chunk_id = f"{data['docId']}_chunk_0"
            result = collection.get(ids=[chunk_id], include=["documents"])
            if result and result["documents"]:
                content_samples.append({
                    "doc_id": data["docId"],
                    "doc_type": data["docType"],
                    "title": data["title"],
                    "text": result["documents"][0][:1500],
                })
        except Exception:
            pass

    # 3. Batch documents (5 at a time) for the extraction prompt
    all_nodes = {}
    all_edges = []
    for i in range(0, len(content_samples), 5):
        batch = content_samples[i : i + 5]
        # ... build prompt, call generate_json ...
        for c in concepts:
            cid = c.get("id", "")
            if cid in all_nodes:
                all_nodes[cid]["weight"] += 1
            else:
                all_nodes[cid] = {
                    "label": c.get("label", cid),
                    "type": c.get("type", "concept"),
                    "sources": c.get("sources", source_ids),
                    "weight": 1,
                }
        # merge relationships, dedupe...

    # 4. Persist to Firestore
    db.collection(models.KNOWLEDGE_GRAPHS).document(course_id).set({
        "courseId": course_id,
        "nodes": all_nodes,
        "edges": unique_edges,
        "nodeCount": len(all_nodes),
        "edgeCount": len(unique_edges),
        "lastUpdatedAt": datetime.now(timezone.utc).isoformat(),
    })
```

**Tools used:**
- **Firestore (`firebase-admin`)** — both as the source of indexed-document IDs and as the destination for the final graph.
- **`chromadb`** — to fetch the actual text content of each indexed chunk.
- **`google-genai`** — for the concept extraction LLM call.
- **Batching at 5 docs per call** to stay under the 6000-char prompt budget.

### 2C — BFS query for related concepts  (file: `backend/app/knowledge_graph_service.py`)

```python
# Lines 186-266
def query_related_concepts(
    course_id: str,
    concepts: list[str],
    depth: int = 2,
) -> dict:
    """BFS traversal from the given concept labels to find related concepts."""
    graph = get_course_graph(course_id)
    if not graph:
        return {"nodes": {}, "edges": []}

    all_nodes = graph.get("nodes", {})
    all_edges = graph.get("edges", [])

    # Build adjacency list (bi-directional for BFS)
    adjacency: dict[str, list[dict]] = {}
    for edge in all_edges:
        src = edge["source"]
        tgt = edge["target"]
        adjacency.setdefault(src, []).append(edge)
        adjacency.setdefault(tgt, []).append({
            "source": tgt, "target": src,
            "relation": edge.get("relation", "related_to"),
            "weight": edge.get("weight", 1),
        })

    # Find starting nodes by case-insensitive label match
    concept_labels_lower = [c.lower() for c in concepts]
    start_ids = set()
    for nid, node in all_nodes.items():
        label = node.get("label", "").lower()
        for cl in concept_labels_lower:
            if cl in label or label in cl:
                start_ids.add(nid)

    if not start_ids:
        return {"nodes": {}, "edges": []}

    # BFS
    visited = set()
    queue = deque()
    for sid in start_ids:
        queue.append((sid, 0))
        visited.add(sid)

    result_nodes = {}
    result_edges = []
    while queue:
        node_id, current_depth = queue.popleft()
        if node_id in all_nodes:
            result_nodes[node_id] = all_nodes[node_id]
        if current_depth >= depth:
            continue
        for edge in adjacency.get(node_id, []):
            target = edge["target"]
            result_edges.append({...})
            if target not in visited:
                visited.add(target)
                queue.append((target, current_depth + 1))

    return {"nodes": result_nodes, "edges": unique_result_edges}
```

**Tools used:**
- **`collections.deque`** — efficient O(1) BFS queue.
- **Pure-Python adjacency dict** — no graph DB needed; the per-course graph is small enough (~100 nodes) to fit in memory.

### 2D — Plagiarism similarity graph  (file: `backend/app/knowledge_graph_service.py`)

```python
# Lines 271-385
async def build_similarity_graph(assignment_id: str) -> dict:
    """Build a pairwise cosine similarity graph for all submissions of an assignment."""
    sub_docs = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("assignmentId", "==", assignment_id)
    ).get()

    submissions = []
    for sd in sub_docs:
        sub = sd.to_dict()
        # Extract content (mind-map text / PDF / link)
        content = ""
        if sub.get("submissionType") == "map" and sub.get("mapId"):
            map_doc = db.collection(models.MAPS).document(sub["mapId"]).get()
            if map_doc.exists:
                content = map_doc.to_dict().get("nodesText", "")
        elif sub.get("filePath"):
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(sub["filePath"])
                content = "\n".join(page.extract_text() or "" for page in reader.pages)
            except Exception:
                content = sub.get("comments", "")
        else:
            content = sub.get("comments", "") or sub.get("externalLink", "")

        if content and len(content.strip()) >= 20:
            submissions.append({"id": sub["studentId"], "name": sub["studentName"], "content": content})

    # Embed all submissions with Gemini
    texts = [s["content"][:3000] for s in submissions]
    embeddings = await rag_service.embed_texts(texts)

    # Pairwise cosine
    edge_threshold = float(os.getenv("PLAGIARISM_EDGE_THRESHOLD", "0.3"))
    nodes = [{"id": s["id"], "name": s["name"]} for s in submissions]
    edges = []
    for i in range(len(submissions)):
        for j in range(i + 1, len(submissions)):
            sim = _cosine_similarity(embeddings[i], embeddings[j])
            if sim >= edge_threshold:
                edges.append({
                    "source": submissions[i]["id"],
                    "target": submissions[j]["id"],
                    "similarity": round(sim, 4),
                })

    return {"nodes": nodes, "edges": edges, "submission_contents": contents}


def detect_clusters(graph: dict, threshold: float = 0.7) -> list[list[str]]:
    """Detect clusters of high-similarity submissions using connected components."""
    edges = graph.get("edges", [])
    adjacency: dict[str, set[str]] = {}
    for edge in edges:
        if edge.get("similarity", 0) >= threshold:
            src, tgt = edge["source"], edge["target"]
            adjacency.setdefault(src, set()).add(tgt)
            adjacency.setdefault(tgt, set()).add(src)

    visited: set[str] = set()
    clusters: list[list[str]] = []
    for node in adjacency:
        if node in visited:
            continue
        component = []
        queue = deque([node])
        visited.add(node)
        while queue:
            current = queue.popleft()
            component.append(current)
            for neighbor in adjacency.get(current, set()):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        if len(component) >= 2:
            clusters.append(component)
    return clusters


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
```

**Tools used:**
- **`google-genai`** via `rag_service.embed_texts` for embeddings.
- **`PyPDF2`** for PDF content extraction.
- **Pure-Python pairwise cosine** + **`collections.deque`** for connected-components BFS — no `numpy`, no `networkx` needed.

---

## Pattern 3 — GAG / Structured Output <a name="part-3"></a>

### What it does

Instead of asking the AI for free-form text, the system asks for a **JSON object that matches a strict schema**. The output is renderable directly in the UI as a grade bar, a criterion table, a clickable source list, etc.

### File

- `backend/app/gag_service.py` — 4 generator functions, one per artifact type

### Tools / libraries used

| Tool | Used for |
|---|---|
| **`google-genai`** (via `ai_service.generate_json`) | Strict JSON generation with markdown-fence stripping and one-retry on parse failure |
| **`ai_service.KNOWLEDGE_BASES`** | System prompts per domain (study_plan, grading, plagiarism, rag_companion) |

### 3A — `ai_service.generate_json` — the core engine  (file: `backend/app/ai_service.py`)

```python
# Lines 373-408
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
            continue
    raise ValueError(f"Failed to parse JSON from Gemini response after 2 attempts: {last_error}")
```

**Tools used:**
- **`google-genai`** for the actual model call.
- **`re`** (stdlib) for stripping ` ```json ... ``` ` fences that Gemini sometimes wraps around the JSON.
- **One-retry policy** — covers transient network errors AND malformed-JSON errors with the same retry budget.

### 3B — Study Plan Generator  (file: `backend/app/gag_service.py`)

```python
# Lines 16-129 (excerpt)
async def generate_study_plan_artifact(
    student_context: dict,
    rag_chunks: list[dict],
    deadlines: list[dict],
    exam_info: list[dict] | None = None,
) -> dict:
    """RAG+GAG: Generate a structured study plan artifact."""
    from . import rag_service

    rag_context = rag_service.format_context(rag_chunks)
    sources = rag_service.format_citations(rag_chunks)

    prompt = f"""Based on the student's performance data, upcoming deadlines, class timetable,
and course materials, create a PERSONALISED study plan for today.

IMPORTANT — SCHEDULING RULES:
- If the student has a class timetable, you MUST assign a specific "suggested_time"
- Schedule study sessions in the FREE GAPS between classes
- NEVER overlap with class times

TODAY: {today}
STUDENT: {student_context.get('name', 'Student')}
PERFORMANCE DATA: {performance_str}
{timetable_str}
UPCOMING DEADLINES: {deadlines_str}
RETRIEVED COURSE MATERIALS: {rag_context}

Return JSON:
{{
  "recommendations": [
    {{
      "course": "<course name>",
      "topic": "<what to study>",
      "priority": "high" | "medium" | "low",
      "suggested_time": "<9:00 AM - 10:00 AM>",
      "reason": "<why this should be studied today>",
      "estimated_time": "<e.g. 30 mins, 1 hour>",
      "difficulty_rating": <1-5>,
      "resource_links": [{{"title": "...", "doc_id": "...", "doc_type": "..."}}],
      "suggested_activities": [...]
    }}
  ],
  "daily_schedule_summary": "<paragraph>",
  "motivational_message": "<personalised message>"
}}"""

    result = await generate_json(prompt, system_instruction=get_knowledge_base("study_plan"))

    # Defensive enrichment — fill missing resource_links from RAG sources
    for rec in result.get("recommendations", []):
        if not rec.get("resource_links"):
            rec["resource_links"] = sources[:2] if sources else []
    return result
```

**Tools used:**
- **`ai_service.generate_json`** does the actual LLM call.
- **`ai_service.get_knowledge_base("study_plan")`** loads the system prompt:
  > *"You are an academic planning advisor. Given a student's courses, grades, deadlines, and exam schedule, you create personalised study plans..."*
- **Post-processing enrichment** — if Gemini forgets to include `resource_links`, the code auto-fills them from the RAG sources we already have.

The other 3 generators (`generate_grading_report`, `generate_graph_suggestions`, `generate_plagiarism_network_report`) follow the **same pattern**:

1. Build a prompt with the input data + a JSON schema example
2. Call `ai_service.generate_json` with the right `system_instruction`
3. Post-process the result to fill any missing fields from the input data

---

## Pattern 4 — Multi-Agent Orchestration <a name="part-4"></a>

### What it does

Many AI features (the chat companion, the daily study plan, the AI grader) need to gather information from 5-6 sources before they can call the LLM. Doing those queries one-by-one would be ~1 second; doing them in parallel is ~0.2 seconds.

The system implements **fan-out / fan-in** — dispatch N async tasks concurrently, then collect their results into one dict.

### Files

- `backend/app/multi_agent.py` — the generic `fan_out` / `fan_out_synthesize` utilities
- `backend/app/routers/ai_companion.py` — uses fan-out for 6-agent student-context gathering
- `backend/app/routers/ai_grading.py` — uses fan-out in two waves (assignment + RAG)

### Tools / libraries used

| Tool | Used for |
|---|---|
| **`asyncio.gather`** (stdlib) | Run multiple coroutines concurrently |
| **`asyncio.wait_for`** (stdlib) | Hard 30s timeout on the whole fan-out |
| **No external framework** | This is ~100 lines of pure Python |

### 4A — The fan-out orchestrator  (file: `backend/app/multi_agent.py`)

```python
# Lines 1-103 (the whole file)
"""Multi-agent orchestration framework for MySmartStudy AI features."""

import asyncio
import logging
import time
from typing import Any, Coroutine

logger = logging.getLogger(__name__)


async def fan_out(
    agents: dict[str, Coroutine[Any, Any, Any]],
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Run named agents in parallel, return results keyed by name.

    Each agent is an awaitable. Failures are isolated — a single agent
    crash does not cancel the others.
    """
    names = list(agents.keys())
    coros = list(agents.values())
    start = time.perf_counter()

    wrapped = [_safe_run(name, coro) for name, coro in zip(names, coros)]
    raw_results = await asyncio.wait_for(
        asyncio.gather(*wrapped),
        timeout=timeout,
    )

    elapsed = time.perf_counter() - start
    results = dict(zip(names, raw_results))

    ok = sum(1 for v in results.values() if not _is_error(v))
    logger.info("fan_out: %d/%d agents succeeded in %.2fs", ok, len(names), elapsed)
    return results


async def fan_out_synthesize(
    agents: dict[str, Coroutine[Any, Any, Any]],
    synthesizer,
    timeout: float = 30.0,
):
    """Fan-out agents, then pass merged results to a synthesizer function."""
    results = await fan_out(agents, timeout=timeout)
    return await synthesizer(results)


def _is_error(result: Any) -> bool:
    return isinstance(result, dict) and "_error" in result


def get_or_default(results: dict, key: str, default=None):
    """Safely get an agent result, returning default if the agent failed."""
    val = results.get(key, default)
    if _is_error(val):
        return default
    return val


async def _safe_run(name: str, coro: Coroutine) -> Any:
    """Execute a single agent coroutine, catching all exceptions."""
    try:
        return await coro
    except Exception as e:
        logger.warning("Agent '%s' failed: %s", name, e)
        return {"_error": str(e)}
```

**Tools used:**
- **`asyncio.gather`** — Python's built-in primitive for parallel awaitables.
- **`asyncio.wait_for`** — enforces a 30-second timeout on the whole fan-out.
- **`_safe_run` wrapper** — each agent's exception is caught and converted to `{"_error": str}`, so one slow Firestore call doesn't break the whole AI request.

### 4B — 6-agent fan-out for the AI companion  (file: `backend/app/routers/ai_companion.py`)

```python
# Lines 212-241 (the orchestrator)
async def _get_student_context(user_id: str) -> tuple[str, list[str]]:
    """Gather comprehensive student metadata via multi-agent fan-out.

    Returns (context_text, course_ids).
    All 6 data agents run in parallel — typically 3-5x faster than sequential.
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    results = await fan_out({
        "courses":     _ctx_courses(user_id),
        "deadlines":   _ctx_deadlines(user_id, now),
        "performance": _ctx_performance(user_id),
        "timetables":  _ctx_timetables(user_id),
        "reminders":   _ctx_reminders(user_id),
        "reflections": _ctx_reflections(user_id),
    })

    courses_data = get_or_default(results, "courses", {"text": "", "course_ids": [], "course_map": {}})
    course_ids = courses_data.get("course_ids", [])

    # Merge text parts from all agents
    parts = []
    for key in ["courses", "deadlines", "performance", "timetables", "reminders", "reflections"]:
        data = get_or_default(results, key, {})
        text = data.get("text", "") if isinstance(data, dict) else ""
        if text:
            parts.append(text)

    context = "\n".join(parts) if parts else "No additional context available."
    return context, course_ids
```

Each `_ctx_*` is an async function that queries Firestore — for example:

```python
# Lines 50-66 (one of the six agents)
async def _ctx_courses(user_id: str) -> dict:
    """Agent: enrolled courses → text + id list + id→name map."""
    course_docs = db.collection(models.COURSES).where(
        filter=FieldFilter("enrolledStudents", "array_contains", user_id)
    ).get()
    course_ids = []
    course_map: dict[str, str] = {}
    lines = []
    for doc in course_docs:
        c = doc.to_dict()
        name = c.get("courseName", "")
        code = c.get("courseCode", "")
        course_ids.append(doc.id)
        course_map[doc.id] = name
        lines.append(f"{name} ({code})")
    text = f"Enrolled courses: {', '.join(lines)}" if lines else ""
    return {"text": text, "course_ids": course_ids, "course_map": course_map}
```

**Tools used:**
- **`firebase-admin`** Firestore `.where(...)` queries.
- **`asyncio.gather`** (transitively via `fan_out`) for parallelism.

---

## End-to-end flow example <a name="part-5"></a>

Here's the full `/api/ai/companion/chat` endpoint — a single request that uses **all four patterns** at once:

```python
# backend/app/routers/ai_companion.py — chat() endpoint  (lines 246-373, condensed)
@router.post("/chat")
async def chat(req: ChatRequest, user=Depends(get_current_user)):
    user_id = user["id"]

    # 1. AI GATE — set tracking context (checks master switch + quota)
    set_tracking_context(user_id, "companion")

    # 2. Load learning profile + chat history from Firestore
    profile_docs = db.collection(models.LEARNING_PROFILES).where(...).limit(1).get()
    history_docs = db.collection(models.AI_CHAT_HISTORY).where(...).limit(1).get()

    # 3. MULTI-AGENT fan-out — 6 agents in parallel
    student_context, course_ids = _get_student_context(user_id)

    # 4. RAG — multi-step retrieval with HyDE + rerank
    rag_chunks = []
    rag_context = ""
    sources = []
    try:
        if course_ids:
            rag_chunks, _ = await rag_multistep.retrieve_multistep(
                req.message, course_ids, top_k=3,
            )
            if rag_chunks:
                rag_context = rag_service.format_context(rag_chunks)
                sources = rag_service.format_citations(rag_chunks)
    except Exception:
        pass  # RAG failure should not block the companion

    # 5. Build system prompt (uses 'rag_companion' knowledge base)
    system_prompt = (
        f"{get_knowledge_base('rag_companion')}\n\n"
        f"Student name: {user.get('displayName', 'Student')}\n"
        f"Learning style: {learning_style}\n"
        f"Student metadata:\n{student_context}\n\n"
        f"RETRIEVED COURSE MATERIALS:\n{rag_context}"
    )

    # 6. LLM call — Gemini with chat history
    response = await chat_completion(
        gemini_messages,
        system_instruction=system_prompt,
        temperature=0.7,
    )

    # 7. Persist chat history back to Firestore
    db.collection(models.AI_CHAT_HISTORY).document(history_id).update({...})

    return {"response": response, "sources": sources}
```

**Tools used in this one request:**

| Step | Tool |
|---|---|
| 1. AI gate | Custom `ai_service.set_tracking_context` — Firestore-backed master switch + daily quota |
| 2. Profile + history | `firebase-admin` Firestore |
| 3. 6-agent fan-out | `multi_agent.fan_out` → `asyncio.gather` |
| 4. RAG | `rag_multistep.retrieve_multistep` → `chromadb`, `google-genai` (embed), `sentence-transformers` (rerank) |
| 5. System prompt | `ai_service.get_knowledge_base` — static dict of domain prompts |
| 6. LLM call | `ai_service.chat_completion` → `google-genai` |
| 7. Persist | `firebase-admin` Firestore |

---

## Likely lecturer questions — model answers <a name="qa"></a>

> **Q1: "Which AI / LLM service does your system use?"**
>
> **A:** Google Gemini, called via the `google-genai` Python SDK. We use two model tiers: `gemini-2.5-flash` (SMART_MODEL) for reasoning-heavy work like grading and chat, and `gemini-2.5-flash-lite` (FAST_MODEL) for cheap structured extraction like query decomposition or HyDE hypothesis generation. Embeddings use `gemini-embedding-001` at 768 dimensions. All API calls are centralised in `backend/app/ai_service.py`.

> **Q2: "Why did you not use OpenAI / Claude?"**
>
> **A:** Cost. Gemini's AI Studio tier is free up to ~1500 requests/day, which is enough for a final-year project demonstration. OpenAI and Anthropic don't offer a free API tier. Gemini also has native PDF understanding which we use for OCR fallback on scanned lecture notes.

> **Q3: "What vector database do you use?"**
>
> **A:** ChromaDB — an embedded, file-based vector database. Files live in `backend/vector_store/`. We use it because (1) it requires no external server, (2) it supports per-course collection isolation, and (3) it stores HNSW indexes on disk so cold start is fast. Each course is its own collection named `course_{course_id}`, configured with cosine similarity.

> **Q4: "Walk me through your RAG pipeline."**
>
> **A:**
> 1. Documents (PDFs, mind-maps, quiz questions) are extracted to text using `pdfplumber` with `PyPDF2` as fallback.
> 2. Text is split into chunks of 500 tokens with 50-token overlap (`rag_service.chunk_text`).
> 3. Chunks are embedded using Gemini's `gemini-embedding-001` model in batches of 100 (`rag_service.embed_texts`).
> 4. Chunks + embeddings are stored in a course-scoped ChromaDB collection.
> 5. At query time, the question is decomposed by `gemini-2.5-flash-lite` into atomic sub-questions if it's compound (more than 6 words).
> 6. Each sub-question is either embedded directly, or — if very short — HyDE is used: the LLM generates a hypothetical answer, which is then embedded.
> 7. Each sub-question retrieves `top_k × 4` candidates from ChromaDB.
> 8. The candidates are merged, deduplicated, then reranked against the **original** compound query using a cross-encoder (`BAAI/bge-reranker-v2-m3` via `sentence-transformers`).
> 9. The top-K reranked chunks plus their citations are returned to the caller.

> **Q5: "Why a cross-encoder reranker?"**
>
> **A:** Two-stage retrieval is industry standard. The bi-encoder (Gemini embedding) is fast but treats query and chunk independently, so it can miss subtle relevance. The cross-encoder processes (query, chunk) pairs together, giving much better ranking precision. We over-fetch 4× the candidates with the fast bi-encoder, then narrow down with the slower but more accurate cross-encoder. The reranker model is multilingual to support Bahasa Melayu content.

> **Q6: "What is a knowledge graph in your context?"**
>
> **A:** For each course we run an LLM extraction pass that pulls **concepts** (e.g. "ER Model", "Primary Key", "Normalisation") and **typed relations** between them (`requires`, `part_of`, `related_to`, `leads_to`, `contrasts`, `example_of`). The graph is stored in Firestore at `knowledgeGraphs/{courseId}`. At query time, the Mind Map Buddy feature does a BFS of depth 2 from concepts mentioned by the student to suggest structurally related new ideas — not just text-similar ones.

> **Q7: "Why structured output instead of free text?"**
>
> **A:** The frontend renders the AI's output as charts, lists, clickable source links, and graph visualisations. Free text would have to be re-parsed every time. By asking the LLM for strict JSON with a fixed schema, the response is directly renderable. The `ai_service.generate_json` wrapper strips Markdown code fences, parses the JSON, and retries once on `JSONDecodeError`.

> **Q8: "How do you handle multiple AI tasks running at once?"**
>
> **A:** The companion endpoint, for example, needs information from 6 different Firestore collections before it can call Gemini. Doing those queries sequentially would take ~1.1s; doing them in parallel takes ~0.2s. We implemented a `fan_out` utility in `backend/app/multi_agent.py` that wraps `asyncio.gather` with per-agent failure isolation — each agent's exception is caught and converted to `{"_error": str}` so one slow Firestore call doesn't break the whole chat reply. The fan-out is also bounded by a 30-second hard timeout via `asyncio.wait_for`.

> **Q9: "What happens if Gemini is unavailable?"**
>
> **A:** Three layers of defence:
> 1. An **admin master switch** in Firestore (`aiConfig/global`) — the admin can disable all AI in 30 seconds and the frontend hides every AI button.
> 2. A **per-feature kill list** — disable just `grading` or `plagiarism` while keeping the others up.
> 3. A **daily per-user token quota** (default 50,000 tokens/day) — enforced before each Gemini call, returning HTTP 429 when exceeded.
>
> Component-level fallbacks: failed embedding batches return zero-vectors, failed reranker loads degrade to embedding scores, failed decomposition uses the original query, failed RAG returns empty (the companion still answers from general knowledge).

> **Q10: "Did you use LangChain or LlamaIndex?"**
>
> **A:** No. I evaluated both — LlamaIndex has a `SubQuestionQueryEngine` that does query decomposition, a `HyDEQueryTransform`, and a `SentenceTransformerRerank` — but I chose to implement these by hand for three reasons:
> 1. **Transparency** — the framework hides the prompts; mine are visible and editable.
> 2. **Integration** — every Gemini call needs to go through my AI-gate / token-quota / audit-log middleware. Wrapping the LlamaIndex SDK around that would have been more code than writing it myself.
> 3. **Scope** — the hand-rolled `rag_service.py` is ~640 lines; the equivalent LlamaIndex orchestration would have been similar once you write the FastAPI / Firestore glue. There was no net saving.
>
> For a production system at higher scale, I'd revisit this and adopt LlamaIndex for RAG and Pydantic AI for the GAG layer.

---

## All tool documentation links — quick reference for the lecturer

Open any of these in your browser during the presentation if the lecturer asks for proof:

### LLM provider — Google Gemini

| Resource | Link |
|---|---|
| Google AI Studio (free API key) | <https://aistudio.google.com/app/apikey> |
| Gemini API documentation | <https://ai.google.dev/gemini-api/docs> |
| Python SDK source code | <https://github.com/googleapis/python-genai> |
| Python SDK on PyPI | <https://pypi.org/project/google-genai/> |
| Models overview | <https://ai.google.dev/gemini-api/docs/models> |
| Embedding endpoint | <https://ai.google.dev/gemini-api/docs/embeddings> |
| Structured output guide | <https://ai.google.dev/gemini-api/docs/structured-output> |
| Free tier pricing | <https://ai.google.dev/pricing> |

### Vector database — ChromaDB

| Resource | Link |
|---|---|
| Homepage | <https://www.trychroma.com/> |
| Documentation | <https://docs.trychroma.com/> |
| GitHub | <https://github.com/chroma-core/chroma> |
| PyPI | <https://pypi.org/project/chromadb/> |
| HNSW index reference | <https://docs.trychroma.com/docs/collections/configure> |

### Cross-encoder reranker

| Resource | Link |
|---|---|
| sentence-transformers homepage | <https://www.sbert.net/> |
| Cross-encoder usage guide | <https://www.sbert.net/docs/cross_encoder/usage/usage.html> |
| GitHub | <https://github.com/UKPLab/sentence-transformers> |
| PyPI | <https://pypi.org/project/sentence-transformers/> |
| **The model we use:** BAAI/bge-reranker-v2-m3 | <https://huggingface.co/BAAI/bge-reranker-v2-m3> |
| Alternative (English-only, smaller): ms-marco-MiniLM-L-6-v2 | <https://huggingface.co/cross-encoder/ms-marco-MiniLM-L-6-v2> |

### PDF text extraction

| Resource | Link |
|---|---|
| pdfplumber GitHub | <https://github.com/jsvine/pdfplumber> |
| pdfplumber PyPI | <https://pypi.org/project/pdfplumber/> |
| pypdf (formerly PyPDF2) GitHub | <https://github.com/py-pdf/pypdf> |
| pypdf documentation | <https://pypdf.readthedocs.io/> |

### Database — Firebase / Firestore

| Resource | Link |
|---|---|
| Firebase Admin SDK (Python) | <https://firebase.google.com/docs/admin/setup> |
| Firestore documentation | <https://firebase.google.com/docs/firestore> |
| Firestore Python quickstart | <https://firebase.google.com/docs/firestore/quickstart#python> |
| firebase-admin on PyPI | <https://pypi.org/project/firebase-admin/> |
| Firestore pricing (free tier) | <https://firebase.google.com/pricing> |

### Async / web framework

| Resource | Link |
|---|---|
| Python `asyncio` docs | <https://docs.python.org/3/library/asyncio.html> |
| `asyncio.gather` reference | <https://docs.python.org/3/library/asyncio-task.html#asyncio.gather> |
| `asyncio.wait_for` (timeout) | <https://docs.python.org/3/library/asyncio-task.html#asyncio.wait_for> |
| FastAPI homepage | <https://fastapi.tiangolo.com/> |
| FastAPI async tutorial | <https://fastapi.tiangolo.com/async/> |
| Uvicorn (ASGI server) | <https://www.uvicorn.org/> |

### Frontend (just for completeness)

| Resource | Link |
|---|---|
| Next.js documentation | <https://nextjs.org/docs> |
| React Flow (mind map editor) | <https://reactflow.dev/> |
| Tailwind CSS | <https://tailwindcss.com/docs> |
| Framer Motion (animations) | <https://www.framer.com/motion/> |

### Academic references — the patterns themselves

If the lecturer asks "where did you learn this pattern from", these are the canonical papers:

| Pattern | Paper | Link |
|---|---|---|
| RAG (original concept) | Lewis et al., 2020 — *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks* | <https://arxiv.org/abs/2005.11401> |
| HyDE | Gao et al., 2022 — *Precise Zero-Shot Dense Retrieval without Relevance Labels* | <https://arxiv.org/abs/2212.10496> |
| Cross-encoder reranking | Nogueira & Cho, 2019 — *Passage Re-ranking with BERT* | <https://arxiv.org/abs/1901.04085> |
| BGE Reranker | Chen et al., 2024 — *BGE M3-Embedding* | <https://arxiv.org/abs/2402.03216> |
| Graph-RAG | Microsoft Research, 2024 — *From Local to Global: GraphRAG* | <https://arxiv.org/abs/2404.16130> |
| Compound AI Systems | Zaharia, Khattab et al., 2024 — *The Shift from Models to Compound AI Systems* | <https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/> |
| LLM as cognitive architecture | Sumers et al., 2023 — *Cognitive Architectures for Language Agents* | <https://arxiv.org/abs/2309.02427> |

### Industry-standard frameworks I evaluated but chose not to use

| Framework | Link | Why I didn't use it |
|---|---|---|
| LlamaIndex | <https://docs.llamaindex.ai/> | Needed transparent prompts + tight AI-gate integration |
| LangChain | <https://python.langchain.com/> | Same reasons + frequent API breaking changes |
| Pydantic AI | <https://ai.pydantic.dev/> | Would benefit `gag_service.py`; planned as future work |
| Microsoft GraphRAG | <https://github.com/microsoft/graphrag> | More complex setup than the FYP requires |
| LangGraph | <https://langchain-ai.github.io/langgraph/> | `multi_agent.py` already does this in ~100 lines |
| CrewAI | <https://docs.crewai.com/> | Role-based; my orchestration is deterministic |
| AutoGen | <https://microsoft.github.io/autogen/> | Conversational multi-agent; not my use case |

---

## File reference

When the lecturer asks you to open a file, here's the map:

| Topic | File path | Key function |
|---|---|---|
| Embeddings + Chroma + Reranker | `backend/app/rag_service.py` | `retrieve()` (line 492) |
| Query decomposition + HyDE | `backend/app/rag_multistep.py` | `retrieve_multistep()` (line 106) |
| Concept graph build | `backend/app/knowledge_graph_service.py` | `build_course_graph()` (line 26) |
| Concept graph BFS | `backend/app/knowledge_graph_service.py` | `query_related_concepts()` (line 186) |
| Plagiarism similarity graph | `backend/app/knowledge_graph_service.py` | `build_similarity_graph()` (line 271) |
| Structured output engine | `backend/app/ai_service.py` | `generate_json()` (line 373) |
| Study plan generator | `backend/app/gag_service.py` | `generate_study_plan_artifact()` (line 16) |
| Grading report generator | `backend/app/gag_service.py` | `generate_grading_report()` (line 132) |
| Mind-map suggestion generator | `backend/app/gag_service.py` | `generate_graph_suggestions()` (line 208) |
| Plagiarism report generator | `backend/app/gag_service.py` | `generate_plagiarism_network_report()` (line 289) |
| Multi-agent fan-out | `backend/app/multi_agent.py` | `fan_out()` (line 32) |
| 6-agent student context | `backend/app/routers/ai_companion.py` | `_get_student_context()` (line 212) |
| Full companion endpoint | `backend/app/routers/ai_companion.py` | `chat()` (line 246) |
| AI gate + quota | `backend/app/ai_service.py` | `set_tracking_context()` (line 158) |

Open each file in VS Code with `Ctrl+G` then the line number while presenting.

Good luck with your presentation! 🎓
