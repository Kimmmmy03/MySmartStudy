# Testing the LangChain + CrewAI Path — and Going Live

The refactor is built and committed on branch `refactor/langchain-crewai`. The
backend now has **two** AI implementations, chosen by one environment variable:

| `AI_BACKEND` value | What runs |
|---|---|
| `legacy` (default) | The original hand-rolled AI services — unchanged |
| `framework` | LangChain (RAG, Graph-RAG, GAG) + CrewAI (AI Grading) |

**Production currently runs `legacy`** — nothing has changed for live users yet.
This guide takes you from here to going live on the framework path safely.

---

## Step 1 — Test locally first (do NOT skip this)

The framework path has not been run against a live Gemini key yet. Test it on
your own machine before touching production.

```powershell
cd "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\backend"
.\venv\Scripts\Activate.ps1

# Point the backend at the framework implementation
$env:AI_BACKEND = "framework"

# Make sure your Gemini key is set (same key the app already uses)
$env:GEMINI_API_KEY = "AIzaSy_your_real_key"

# Start the backend
uvicorn main:app --reload
```

Then start the web frontend in another terminal (`cd frontend-web; npm run dev`)
and exercise each AI feature, OR hit the API directly.

### What to test

| Feature | How | Expected |
|---|---|---|
| RAG — AI Companion chat | Student dashboard → AI chat → ask "what is normalisation?" | Answer with `[Source N]` citations |
| RAG multi-step | Ask a compound question ("compare X and Y") | Coherent answer covering both |
| Graph-RAG | Admin/lecturer → rebuild knowledge graph for a course | `knowledgeGraphs/{courseId}` doc updates in Firestore |
| GAG — Study plan | Student → Daily study guide | Structured plan with time slots |
| GAG — Mind Map Buddy | Map editor → Suggest nodes | Node suggestions with parent labels |
| **CrewAI — AI Grading** | Lecturer → a tutorial submission → "AI Grade" | Structured grade in ~8–15 s |
| Plagiarism | Lecturer → assignment → plagiarism network | Clusters + narrative |

### Things to watch for

- **AI Grading latency** — the CrewAI crew makes 2+ LLM calls. ~8–15 s is
  normal; if it exceeds ~30 s, see Troubleshooting below.
- **The admin AI master switch** — toggle it off, confirm AI features return
  503. This proves the gate still works on the framework path.
- **Token usage** — after a few AI calls, check the admin AI usage dashboard;
  `aiDailyUsage` should still be incrementing.

---

## Step 2 — Compare quality

Run the same query on both backends and compare:

```powershell
# legacy
$env:AI_BACKEND = "legacy";    uvicorn main:app --port 8000
# framework (separate terminal / after stopping the first)
$env:AI_BACKEND = "framework"; uvicorn main:app --port 8001
```

If the framework answers are clearly worse, stay on `legacy` — that is a
perfectly valid outcome and the feature flag exists exactly for this.

---

## Step 3 — Go live (only after Steps 1–2 pass)

The new deps are already in the deployed image (the `AI_BACKEND=legacy` deploy
built them in). Switching to the framework path is then just an env-var flip —
**no rebuild, ~10 seconds:**

```powershell
$env:Path += ";C:\Users\ASUS\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"

gcloud run services update mysmartstudy-api `
  --region asia-southeast1 `
  --update-env-vars AI_BACKEND=framework
```

Smoke-test production, then watch logs for ~24 h.

---

## Instant rollback

If anything misbehaves in production, flip back — again ~10 s, no rebuild:

```powershell
gcloud run services update mysmartstudy-api `
  --region asia-southeast1 `
  --update-env-vars AI_BACKEND=legacy
```

---

## Step 4 — Merge to main

Once the framework path is proven in production, merge the branch so `main`
reflects reality:

```powershell
cd "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy"
git checkout main
git merge refactor/langchain-crewai
git push origin main
```

---

## Troubleshooting

**AI Grading takes 30 s+** — CrewAI is doing extra reasoning loops. In
`backend/app/crew_service.py`, lower `max_iter` from `2` to `1` on both agents,
or set both agents to the FAST model.

**`litellm.AuthenticationError` on the framework path** — CrewAI reads
`GEMINI_API_KEY` from the environment. Confirm it is set in the Cloud Run
service (it already is for the legacy path, so this should be fine).

**Framework RAG returns no results** — the LangChain retriever reads the same
ChromaDB collections the legacy indexer wrote, using a vector-compatible
embedding adapter. If results are empty, the course may simply have no indexed
content yet — trigger a re-index from the RAG admin page.

**`with_structured_output` returns partial data** — Gemini occasionally drops
optional fields. The Pydantic models in `gag_service_lc.py` give every field a
default, so this degrades gracefully rather than erroring.

**Want to abandon the refactor entirely** — just keep `AI_BACKEND` unset /
`legacy` everywhere and delete the `refactor/langchain-crewai` branch. The new
files are inert when the flag is off.
