# Refactor Plan — Make the Backend Use LangChain + CrewAI

**Goal:** Replace the hand-rolled AI code in `backend/app/` so the *deployed* backend genuinely uses LangChain (RAG, Graph-RAG, GAG) and CrewAI (Multi-Agent), then redeploy to Cloud Run.

**Status:** PLAN ONLY — nothing has been changed yet. Read the risks first; they may change your decision.

---

## ⚠️ Read this first — 5 critical risks

### Risk 1 — CrewAI will make the AI Companion chat 10–20× slower

This is the biggest one.

Your current `multi_agent.py` agents are **Firestore data-fetchers** — 6 database queries run in parallel with `asyncio.gather`, finishing in **~200 ms**.

CrewAI agents are **LLM-reasoning agents** — each one makes its own Gemini call to "think". Replacing 6 fast database queries with 6 LLM agents means:

| | Now (hand-rolled) | After CrewAI |
|---|---|---|
| Companion chat response time | ~1–2 seconds | **~15–40 seconds** |
| LLM calls per chat message | 1 | 7+ |
| Gemini tokens per chat message | ~2,000 | ~10,000+ |

A 30-second wait for a chat reply is a **bad live-demo experience** and burns your daily token quota ~5× faster. → See "Multi-Agent options" below for how to handle this.

### Risk 2 — Dependency conflicts (could cost a full day)

CrewAI is a heavy package. It pins specific versions of `chromadb`, `pydantic`, `litellm`, `openai`, `tiktoken`, `onnxruntime`, and more. Your backend already uses `chromadb`, `google-genai`, `pydantic`, `fastapi` at their own versions.

There is a real chance `pip install -r requirements.txt` fails to resolve, or installs versions that break the existing code. **This must be tested in isolation before any code is written.**

### Risk 3 — The AI gate / token quota can silently stop working

Your master switch, per-feature kill list, and daily token quota are enforced inside `ai_service.py`. If LangChain and CrewAI create **their own** Gemini clients (they do), they **bypass `ai_service`** entirely.

Unless we re-wire the gate, the admin "turn AI off" switch would stop working and token usage would stop being logged — without any error. This must be deliberately handled in the refactor.

### Risk 4 — Docker image bloat → slower builds, more memory

Your backend already builds in ~28 min because of `torch` + `sentence-transformers`. Adding LangChain + CrewAI (~250 MB of extra dependencies) will:

- Push build time toward **40+ minutes**
- Grow the container image significantly
- Likely require **raising the Cloud Run memory limit** (more libraries loaded = more RAM)

### Risk 5 — Higher running cost

More LLM calls per request = more Gemini tokens = faster free-tier exhaustion and higher cost if you exceed it.

---

## Honest recommendation before you commit

Your hand-rolled implementation is **not a weakness** — re-implementing these patterns from scratch is arguably *more* impressive academically than importing a framework. The grep proof is clean and defensible.

**If your only reason for this refactor is "the lecturer wants framework names":** consider keeping the backend as-is and presenting the `langchain_integration/` + `crewai_integration/` playgrounds as "I evaluated and prototyped both frameworks." That's honest and zero-risk.

**If you genuinely want the deployed product to run on the frameworks:** proceed with this plan, but follow the **feature-flag strategy** below so you can never break production.

---

## Recommended strategy — feature flag, phased, reversible

Do **not** delete the old code. Instead:

1. Add an environment variable `AI_BACKEND` with values `legacy` (current) or `framework` (new).
2. Build the new LangChain/CrewAI code in **new files** alongside the old ones.
3. A thin dispatcher in each service picks the implementation based on `AI_BACKEND`.
4. Deploy with `AI_BACKEND=legacy` first (no behaviour change), then flip to `framework` once tested.
5. If anything breaks in production, flip the env var back — **instant rollback, no redeploy**.

```
gcloud run services update mysmartstudy-api \
  --region asia-southeast1 \
  --update-env-vars AI_BACKEND=framework      # or legacy to roll back
```

This is the professional way to ship a risky refactor.

---

## Phase-by-phase plan

### Phase 0 — Decisions & setup (½ day)

- [ ] **Decide the Multi-Agent approach** (see options below) — needed before Phase 5
- [ ] Create a working branch: `git checkout -b refactor/langchain-crewai`
- [ ] Confirm you accept the latency / cost trade-offs

### Phase 1 — Dependency resolution (½–1 day) — DO THIS BEFORE WRITING CODE

- [ ] In a throwaway venv, install the current `backend/requirements.txt`
- [ ] Add the new packages one group at a time and check resolution:
  ```
  langchain  langchain-google-genai  langchain-community
  langchain-chroma  langchain-experimental
  crewai  crewai-tools
  ```
- [ ] Run the existing backend test suite (`backend/tests/`) to confirm nothing broke
- [ ] **Gate:** if dependencies cannot resolve cleanly, STOP and reassess — do not proceed.
- [ ] Pin the resolved versions into `backend/requirements.txt`

### Phase 2 — Shared plumbing: keep the AI gate working (½ day)

- [ ] Add `AI_BACKEND` env var handling in `ai_service.py`
- [ ] Write a LangChain **callback handler** (`backend/app/ai_callbacks.py`) that:
  - calls `_log_token_usage()` after every LLM call (reads `response.usage_metadata`)
- [ ] Decide the gate-enforcement point: every new service function must call `ai_service._enforce_ai_gate(feature)` at its start, exactly like the legacy code does
- [ ] For CrewAI: configure its LLM through `litellm` with the same key, and call `_enforce_ai_gate` before `crew.kickoff()`

### Phase 3 — RAG refactor with LangChain (1 day)

New file `backend/app/rag_service_lc.py` — **same public function signatures** as `rag_service.py`:

| Keep identical signature | New internals |
|---|---|
| `init_chroma()` | `langchain_chroma.Chroma` per-course collection |
| `embed_texts(texts)` | `GoogleGenerativeAIEmbeddings` |
| `index_document(course_id, doc_id, doc_type, title, text, metadata)` | LangChain `RecursiveCharacterTextSplitter` + Chroma upsert; **keep** the `ragIndexState` content-hash skip |
| `retrieve(query, course_ids, top_k, doc_types, rerank)` | `MultiQueryRetriever` + `CrossEncoderReranker` (BGE) |
| `format_context()`, `format_citations()`, `remove_document()` | unchanged logic |

New file `backend/app/rag_multistep_lc.py`:
- `retrieve_multistep()` → `MultiQueryRetriever` (decomposition) + `HypotheticalDocumentEmbedder` (HyDE)
- Returns the same `(chunks, sub_questions)` tuple

**Must preserve:** per-course Chroma collection names (`course_{cid}`), the `{doc_id, doc_type, title, course_id}` metadata, content-hash incremental indexing, `_enforce_ai_gate()` calls.

### Phase 4 — Graph-RAG refactor with LangChain (½–1 day)

New file `backend/app/knowledge_graph_service_lc.py`:

| Function | Action |
|---|---|
| `build_course_graph()` | Rewrite with `LLMGraphTransformer`; convert its output back into the **exact** `knowledgeGraphs/{courseId}` Firestore shape (`nodes` map + `edges` list) |
| `query_related_concepts()` | **Keep the existing pure-Python BFS** — it operates on the Firestore shape, no framework needed |
| `build_similarity_graph()`, `detect_clusters()`, `_cosine_similarity()` | **Keep unchanged** — pure maths, no LLM, LangChain adds nothing |

### Phase 5 — Multi-Agent refactor with CrewAI (1–2 days)

**Pick ONE option in Phase 0:**

**Option A — Full CrewAI everywhere (purest, slowest)**
Every `_ctx_*` becomes a CrewAI agent with a Firestore tool. Companion chat ~15–40 s. Only choose this if latency genuinely doesn't matter for your demo.

**Option B — CrewAI where reasoning happens; async where it's just I/O (RECOMMENDED)**
- **AI Grading** → a real CrewAI `Crew`: *Submission Analyst → Rubric Scorer → Comparator → Grader* agents. This is genuine multi-step reasoning — a good CrewAI fit.
- **AI Plagiarism network** → a CrewAI `Crew` for cluster analysis.
- **AI Companion** → keep the 6 Firestore fetches as fast `asyncio.gather` (they are pure data I/O — no reasoning). You still legitimately "use CrewAI" in the project, just where it makes sense.

**Option C — CrewAI as a thin synthesis crew (lightest)**
Keep all data-gathering async; use a small 2–3 agent CrewAI crew only for the final answer composition. Minimal latency hit.

New file `backend/app/crew_service.py` holding the Crew/Agent/Task definitions. `crewai_integration/04_companion_crew.py` is your starting template.

### Phase 6 — Wire the dispatcher into routers (½ day)

In each AI service module, add a dispatcher:

```python
def retrieve(*args, **kwargs):
    if os.getenv("AI_BACKEND") == "framework":
        return rag_service_lc.retrieve(*args, **kwargs)
    return _legacy_retrieve(*args, **kwargs)
```

Because signatures are preserved, **routers barely change** — they keep calling `rag_service.retrieve(...)`.

### Phase 7 — Testing (1 day)

Local, with `AI_BACKEND=framework`:

- [ ] Companion chat returns an answer with citations
- [ ] Mind Map Buddy returns node suggestions
- [ ] AI Grading returns a structured grade
- [ ] Plagiarism network returns clusters + narrative
- [ ] Study plan generates
- [ ] **Gate test:** toggle admin master switch → all AI returns 503
- [ ] **Quota test:** confirm `aiDailyUsage` still increments
- [ ] **Cache test:** repeat a query → served from cache
- [ ] Measure latency of each endpoint — confirm acceptable
- [ ] Re-run `backend/tests/`

### Phase 8 — Deploy (1–2 hrs, mostly waiting)

- [ ] Bump Cloud Run memory if needed:
  ```
  gcloud run services update mysmartstudy-api --region asia-southeast1 --memory 2Gi
  ```
- [ ] Deploy with `AI_BACKEND=legacy` first (zero behaviour change — proves the new deps don't break the old path):
  ```
  gcloud run deploy mysmartstudy-api --source backend/ --region asia-southeast1 \
    --update-env-vars AI_BACKEND=legacy
  ```
- [ ] Smoke-test production on legacy path
- [ ] Flip to framework path:
  ```
  gcloud run services update mysmartstudy-api --region asia-southeast1 \
    --update-env-vars AI_BACKEND=framework
  ```
- [ ] Smoke-test production on framework path
- [ ] Monitor logs + latency for 24 h

### Phase 9 — Rollback plan

- **Instant:** `--update-env-vars AI_BACKEND=legacy` (no redeploy, ~10 s)
- **Revision rollback:** Cloud Run console → Revisions → route 100% to the previous revision
- **Code rollback:** the `refactor/langchain-crewai` branch is separate; `main` is untouched until you merge

---

## Per-file change summary

| File | Action |
|---|---|
| `backend/requirements.txt` | Add LangChain + CrewAI packages (Phase 1) |
| `backend/app/ai_service.py` | Add `AI_BACKEND` flag + keep gate/quota/tracking |
| `backend/app/ai_callbacks.py` | **NEW** — LangChain token-usage callback |
| `backend/app/rag_service_lc.py` | **NEW** — LangChain RAG |
| `backend/app/rag_multistep_lc.py` | **NEW** — LangChain multi-step + HyDE |
| `backend/app/knowledge_graph_service_lc.py` | **NEW** — LangChain Graph-RAG |
| `backend/app/gag_service_lc.py` | **NEW** — LangChain structured output |
| `backend/app/crew_service.py` | **NEW** — CrewAI crews |
| `backend/app/rag_service.py` etc. | Add dispatcher; keep legacy code as `_legacy_*` |
| `backend/app/routers/ai_*.py` | Mostly unchanged (signatures preserved) |
| `knowledge_graph_service.py` plagiarism functions | Unchanged |

---

## Effort & timeline

| Phase | Effort |
|---|---|
| 0 — Decisions | ½ day |
| 1 — Dependencies | ½–1 day |
| 2 — Gate plumbing | ½ day |
| 3 — RAG | 1 day |
| 4 — Graph-RAG | ½–1 day |
| 5 — Multi-Agent | 1–2 days |
| 6 — Dispatcher | ½ day |
| 7 — Testing | 1 day |
| 8 — Deploy | ½ day |
| **Total** | **~6–8 working days** (more for a beginner) |

---

## Decision points I need from you before starting

1. **Multi-Agent option** — A (full CrewAI, slow), **B (recommended — CrewAI for grading/plagiarism, async companion)**, or C (thin synthesis crew)?
2. **Feature flag** — use the `AI_BACKEND` flag (recommended, safe) or hard cutover (simpler, riskier)?
3. **Scope** — all 4 patterns at once, or one at a time (e.g. ship RAG first, prove it, then the rest)?
4. **Go / no-go** — given Risk 1 (companion latency) and Risk 2 (dependency hell), do you still want to proceed?

Tell me your answers to these 4 and I'll start executing the plan phase by phase.
