# MySmartStudy — Diagrams

All files are draw.io documents (`.drawio` XML). Open them at <https://app.diagrams.net> (or VS Code "Draw.io Integration" extension) — File → Open → pick the `.drawio` file.

| # | File | What it shows |
|---|------|---------------|
| 1 | `1_use_case_diagram.drawio` | UML use case diagram. Actors: Student, Lecturer, Admin + secondary actors (Gemini, Firebase, ChromaDB). Every AI feature and admin gate is included, with `«include»` links from AI use cases to the cross-cutting gate / quota / RAG / KG / multi-agent concerns. |
| 2 | `2_uml_class_diagram.drawio` | UML class / entity diagram of the Firestore document model (User, Map, Course, Assignment, Submission, Quiz, QuizQuestion, QuizAttempt, Module, ModuleItem, Discussion, Announcement, Reminder, Conversation, Message, LearningProfile, AIChatHistory, AIPlagiarismReport, AIGradeRecommendation, AIStudyPlan, RAGIndexState, KnowledgeGraph, Concept, Edge, Rubric, Attendance, PeerReview, AIConfig, AIDailyUsage, AIMindmapBuddyMemory) with multiplicities. |
| 3 | `3_system_architecture.drawio` | Layered system architecture — Client tier (Next.js 16, Flutter, Admin console), Application tier (FastAPI routers, AI gate, services), Data & external tier (Firestore, ChromaDB, SQLite, Firebase Storage, Gemini API, Cross-encoder reranker, Firebase Auth, Canva MCP), and Dev/Infra. |
| 4 | `4_rag_diagram.drawio` | RAG pipeline in two phases: **A. Ingestion** (source → text extraction → content-hash skip → chunk → Gemini embed → Chroma upsert + ragIndexState) and **B. Retrieval** (query → decompose → HyDE for terse subs → per-course Chroma query → merge & dedupe → cross-encoder rerank against ORIGINAL query → top-K → format_context → Gemini SMART_MODEL → grounded answer). |
| 5 | `5_rag_graph_diagram.drawio` | Knowledge-graph layer in three parts: **①** `build_course_graph` (Gemini concept extraction in batches of 5 → merge → Firestore `knowledgeGraphs`), **②** `query_related_concepts` (BFS with depth = N on labels → subgraph), **③** Plagiarism similarity graph (embeddings → pairwise cosine → connected-components clustering at ≥0.7 → GAG narrative). |
| 6 | `6_gag_diagram.drawio` | GAG (Generation-Augmented Generation) service — four generator functions (`study_plan`, `grading_report`, `graph_suggestions`, `plagiarism_network_report`) showing inputs, prompt rules, JSON output schema, the underlying `generate_json` call, post-processing enrichment, persistence collections, and the consumer routers. |
| 7 | `7_multi_agent_diagram.drawio` | `multi_agent.py` orchestration framework — `fan_out` / `fan_in` over `asyncio.gather` with `_safe_run` isolation. Two end-to-end examples: AI Companion (6 parallel agents) and AI Grading (two-wave fan-out because RAG depends on `courseId`). |
| 8 | `8_ai_features_interaction.drawio` | How **all 9 AI feature routers** talk to each other and to the shared primitives. Top row: every AI router. Middle: the **gatekeeper** (`set_tracking_context` → master switch + per-feature kill list + 50K/day token quota). Then the shared primitive layer (`multi_agent`, `rag_service`, `rag_multistep`, `knowledge_graph_service`, `gag_service`, `ai_service`, caches, `similarity`, `audit`). Then the data stores (Firestore, ChromaDB, file storage, Gemini API, reranker, Firebase Auth). Bottom row: the **admin control loop** that toggles features and observes spend. |

## Source code mapping

All diagrams are grounded in the current source tree:

- `backend/app/ai_service.py` — Gemini wrapper, AI gate, token logging
- `backend/app/rag_service.py` — Chroma + Gemini embeddings + reranker
- `backend/app/rag_multistep.py` — query decomposition + HyDE
- `backend/app/knowledge_graph_service.py` — KG build, BFS, similarity graph
- `backend/app/gag_service.py` — structured-artifact generators
- `backend/app/multi_agent.py` — fan_out / fan_in
- `backend/app/routers/ai_*.py` — 8 feature routers
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
