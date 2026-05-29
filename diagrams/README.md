# MySmartStudy — Diagrams

All files are draw.io documents (`.drawio` XML). Open them at <https://app.diagrams.net> (or VS Code "Draw.io Integration" extension) — File → Open → pick the `.drawio` file.

> **May 2026 update** — the SmartBuddy chat is now sourced through three tiers and exposes generate-flashcards / summary / quiz CTAs. The conceptual changes are documented in the root `README.md` under **"What's New (May 2026)"**. The drawio XMLs in this folder have been updated in place:
>
> - `3_system_architecture.drawio` — adds an OpenAlex external-API cloud next to the Gemini cloud, pointing at `backend/app/services/external_lookup.py`.
> - `8_ai_features_interaction.drawio` — adds the **May 2026 source tier pipeline** band at the bottom (course RAG → OpenAlex → Gemini general knowledge) plus the `suggested_actions[]` → `generate-by-topic` loop and the em-dash strip note.
> - `diagrams_simple/1_system_architecture_simple.drawio` — new layer ④ "What it talks to outside MySmartStudy" with Gemini + OpenAlex clouds.
> - `diagrams_simple/6_ai_features_interaction_simple.drawio` — new row ⑤ describing the three source tiers and the three CTA buttons in plain English.
>
> Open them in draw.io to re-export PNG/PDF for the report.

| # | File | What it shows |
|---|------|---------------|
| 1 | `1_use_case_diagram.drawio` | UML use case diagram inside the `MySmartStudy LMS` boundary. Primary actors Student / Lecturer / Admin and secondary actors Gemini AI / Firebase Auth / ChromaDB. ~75 use cases grouped by subject area (Auth & Profile, Mind Maps, Courses & Learning, Assessment, Social, Student/Lecturer AI, Course Management, Grading, Admin Console) with `«extend»` links between dependent cases. |
| 2 | `2_uml_class_diagram.drawio` | Domain class diagram of the Firestore document model, organised into eight colour-coded subject areas: **A** User & Identity, **B** Course & Learning Content, **C** Mind Maps & Map-Social, **D** Communication, **E** Assessment, **F** Activities/Groups/CMS, **G** CLP (Course Learning Plan), **H** AI/RAG/Knowledge Graph. `«entity»` / `«value»` / `«enumeration»` / `«projection»` stereotypes, composition diamonds and multiplicities; cross-area references travel by foreign-key id fields. |
| 3 | `3_system_architecture.drawio` | System architecture as a Firebase / Cloud Run network topology — clients (browser, mobile), public route (CDN, load balancer), Firebase foundation, FastAPI gateway, eight backend services, and the **AI Pipelines cluster (RAG, RAG Knowledge Graph, GAG, Multi-Agent)** with the `AI_BACKEND` legacy ↔ LangChain+CrewAI dispatch, database services (Firestore, ChromaDB, Knowledge Graph, Question Cache, File Storage) and the external Gemini API. |
| 4 | `4_rag_diagram.drawio` | RAG pipeline in two phases: **A. Ingestion** (source → text extraction → content-hash skip → chunk → Gemini embed → Chroma upsert + ragIndexState) and **B. Retrieval** (query → decompose → HyDE for terse subs → per-course Chroma query → merge & dedupe → cross-encoder rerank against ORIGINAL query → top-K → format_context → Gemini SMART_MODEL → grounded answer). |
| 5 | `5_rag_graph_diagram.drawio` | Knowledge-graph layer in three parts: **①** build the course graph — `build_course_graph`, shown for both backends (legacy Gemini concept extraction vs the LangChain `LLMGraphTransformer`) → merge → Firestore `knowledgeGraphs`; **②** `query_related_concepts` (pure-Python BFS, depth = 2 → subgraph); **③** plagiarism similarity graph (embeddings → pairwise cosine → connected-components clustering at ≥0.7 → GAG narrative). |
| 6 | `6_gag_diagram.drawio` | GAG (Generation-Augmented Generation) service — four generator functions (`study_plan`, `grading_report`, `graph_suggestions`, `plagiarism_network_report`) showing inputs, prompt rules, JSON output schema, the underlying `generate_json` call, post-processing enrichment, persistence collections, and the consumer routers. |
| 7 | `7_multi_agent_diagram.drawio` | `multi_agent.py` orchestration framework — `fan_out` / `fan_in` over `asyncio.gather` with `_safe_run` isolation. Two end-to-end examples: AI Companion (6 parallel agents) and AI Grading (two-wave fan-out because RAG depends on `courseId`). |
| 8 | `8_ai_features_interaction.drawio` | How **all 9 AI feature routers** talk to each other and to the shared primitives. Top row: every AI router. Middle: the **gatekeeper** (`set_tracking_context` → master switch + per-feature kill list + 50K/day token quota). Then the shared primitive layer (`multi_agent`, `rag_service`, `rag_multistep`, `knowledge_graph_service`, `gag_service`, `ai_service`, caches, `similarity`, `audit`). Then the data stores (Firestore, ChromaDB, file storage, Gemini API, reranker, Firebase Auth). Bottom row: the **admin control loop** that toggles features and observes spend. **May 2026 addition (not yet reflected in the XML)** — Mind Map Buddy `chat` and AI Study Materials `generate-by-topic` now branch through a three-tier source pipeline (course RAG → `external_lookup.lookup_openalex` → Gemini general knowledge), and the chat surfaces `suggested_actions[]` that loop back into `generate-by-topic` with an `evidence_tier` parameter. |

## Source code mapping

All diagrams are grounded in the current source tree:

- `backend/app/ai_service.py` — Gemini wrapper, AI gate, token logging
- `backend/app/rag_service.py` — Chroma + Gemini embeddings + reranker
- `backend/app/rag_multistep.py` — query decomposition + HyDE
- `backend/app/knowledge_graph_service.py` — KG build, BFS, similarity graph
- `backend/app/gag_service.py` — structured-artifact generators
- `backend/app/multi_agent.py` — fan_out / fan_in
- `backend/app/services/external_lookup.py` — **OpenAlex peer-reviewed-source client (May 2026)**; recency filter, polite-pool email, 1h in-process LRU
- `backend/app/routers/ai_*.py` — 9 feature routers (the `chat` handler in `ai_mindmap_buddy.py` is the entry point for the three-tier source pipeline)
- `backend/app/routers/admin.py` + `backend/app/routers/rag_admin.py` — control plane
- `backend/app/models.py` — Firestore collection names + helpers
- `backend/main.py` — app startup, `/api/ai/status`

## Editing tips

- `.drawio` files are plain XML — they round-trip cleanly through git.
- For PDF / PNG export: open in draw.io → `File → Export As → PDF` (or PNG).
- The colour key inside each diagram is consistent across the set:
  - Blue = student
  - Purple = lecturer / course
  - Orange = AI feature / Gemini-powered
  - Red = RAG / KG infra / external heavy
  - Green = admin / governance
  - Yellow = persistent store, cache, or note
