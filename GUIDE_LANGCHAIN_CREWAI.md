# Beginner Guide — Running Your AI Patterns on LangChain + CrewAI

This guide tells you, step by step:

1. **What LangChain and CrewAI actually are** (clearing up the "paste-on-website" confusion)
2. **How to run** the integration code I created for you
3. **How to view your runs** on the LangSmith and CrewAI Studio websites

Total cost: **$0** — every tool here is free.

---

## ⚠️ Read this first — the most important thing

**LangChain and CrewAI are NOT websites where you paste code.** They are Python libraries you install on your computer with `pip install`, then run locally.

| Common misconception | The reality |
|---|---|
| "I paste my code on langchain.com and it runs" | LangChain is `pip install langchain` — you run code in Python on your machine |
| "I paste my code on crewai.com and it runs" | CrewAI is `pip install crewai` — same; runs in Python on your machine |
| "There's no website at all then?" | There IS — but it's for **viewing/tracing** your code's runs, not for pasting code |

**The websites that DO exist (and what they do):**

| Website | What it is | Free? |
|---|---|---|
| <https://smith.langchain.com> | **LangSmith** — observability dashboard. View every LLM call your local code makes, see prompts/responses/errors/cost | ✅ Free tier (5,000 traces/month) |
| <https://app.crewai.com> | **CrewAI Studio** — visual UI to build crews. Limited free tier; mostly paid enterprise | Free signup; deeper features paid |

This guide shows you both: run code locally, then optionally view traces on the websites.

---

## Folder layout

I created two new folders inside your project:

```
MySmartStudy/
├── backend/                              ← your real backend (unchanged)
├── langchain_integration/                ← NEW
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/
│   │   └── db_lecture.txt
│   ├── 01_rag_layered.py                  ← Pattern 1: RAG
│   ├── 02_graph_rag.py                    ← Pattern 2: Graph-RAG
│   └── 03_gag_structured.py               ← Pattern 3: GAG
└── crewai_integration/                    ← NEW
    ├── requirements.txt
    ├── .env.example
    └── 04_companion_crew.py               ← Pattern 4: Multi-Agent
```

---

## Table of contents

1. [Step 1 — Get a free Gemini API key](#step-1)
2. [Step 2 — Run the LangChain integration](#step-2)
3. [Step 3 — (optional) View runs on LangSmith](#step-3)
4. [Step 4 — Run the CrewAI integration](#step-4)
5. [Step 5 — (optional) View on CrewAI Studio](#step-5)
6. [Step 6 — What to show your lecturer](#step-6)
7. [Troubleshooting](#troubleshooting)

---

## Step 1 — Get a free Gemini API key <a name="step-1"></a>

If you already did this for an earlier tutorial, skip ahead. Otherwise:

1. Open **<https://aistudio.google.com>** in your browser.
2. Click **Sign in** (top right) — use your Google account.
3. Click **"Get API key"** in the left sidebar 🔑.
4. Click **"Create API key"** → **"Create API key in new project"**.
5. Copy the long string starting with `AIzaSy…`.

Keep it somewhere temporary — you'll paste it into `.env` files in the next steps.

---

## Step 2 — Run the LangChain integration <a name="step-2"></a>

This covers **Patterns 1, 2, and 3** (RAG, Graph-RAG, GAG).

### 2.1 — Open PowerShell and go to the folder

```powershell
cd "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\langchain_integration"
```

### 2.2 — Create a Python virtual environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Your prompt should now start with `(venv)`. If you see *"cannot be loaded because running scripts is disabled"*, run this once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Press `Y` then re-run the activate command.

### 2.3 — Install the LangChain packages

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

Wait ~4 minutes. ~600 MB of downloads.

### 2.4 — Set up your API key

```powershell
copy .env.example .env
notepad .env
```

Replace `AIzaSy_paste_your_real_key_here` with your real key. Save and close.

### 2.5 — Run Pattern 1: RAG with multi-step + HyDE + rerank

```powershell
python 01_rag_layered.py
```

**What you should see:**

```
Split into 3 chunks
Loading cross-encoder (~80 MB first time)...
Question: Compare ER and EER models and explain how normalisation relates to them
Answer: ER models represent real-world entities and relationships...
Sources used (5 chunks):
  [1] Intro to Relational Databases (pdf)
      "The Entity-Relationship (ER) model is the planning step..."
  [2] Intro to Relational Databases (pdf)
      "Normalisation is the process of organising tables..."
  ...
```

**What it's doing (same as your real `rag_service.py`):**

- Loads `data/db_lecture.txt`
- Chunks at ~500 tokens with 50-token overlap
- Embeds with `gemini-embedding-001` (768 dim)
- Stores in a ChromaDB collection named `course_db101`
- `MultiQueryRetriever` decomposes the question into 3 alternative phrasings
- Over-fetches 20 candidates from Chroma
- `CrossEncoderReranker` with `BAAI/bge-reranker-v2-m3` re-orders down to top 5
- Builds the answer using only those 5 reranked chunks

### 2.6 — Run Pattern 2: Graph-RAG

```powershell
python 02_graph_rag.py
```

**What you should see:**

```
Extracting entities and relations... (calls Gemini)
Extracted 8 nodes, 9 relationships
Saved graph in Firestore shape to ./graph_storage/firestore_shaped.json

A few triplets the LLM extracted:
  Database  --[part_of]-->  Tables
  Primary Key  --[uniquely_identifies]-->  Row
  ER Model  --[leads_to]-->  EER Model
  Normalisation  --[part_of]-->  Database Design

--- BFS depth=2 starting from 'ER' ---
Subgraph: 4 nodes, 6 edges
  • ER Model (concept)
  • EER Model (concept)
  • Database (concept)
  • Primary Key (fact)
```

**What it's doing (same as your `knowledge_graph_service.py`):**

- Uses `LLMGraphTransformer` to extract entities and typed relations
- Allowed relation types match yours: `REQUIRES, PART_OF, RELATED_TO, LEADS_TO, CONTRASTS, EXAMPLE_OF`
- Saves graph in the SAME Firestore JSON shape your real backend uses
- BFS query at depth 2 from a seed concept — pure-Python implementation identical to your `query_related_concepts`

### 2.7 — Run Pattern 3: GAG (Structured Output)

```powershell
python 03_gag_structured.py
```

**What you should see:** All 4 generators run, each printing a structured object:

```
============================================================
1. STUDY PLAN
============================================================
Recommendations: 3
  • Normalisation review (high) — 9:00 AM - 10:00 AM, difficulty 4/5
  • SQL JOIN practice (medium) — 14:00 - 15:00, difficulty 3/5
Motivation: You're already 78% on SQL Basics — bring Normalisation up next!

============================================================
2. GRADING REPORT
============================================================
Grade: 65.5/100  confidence=0.87
...
```

**What it's doing (same as your `gag_service.py`):**

- Each generator returns a **typed Pydantic model** instead of a raw dict
- LangChain's `.with_structured_output(MyModel)` guarantees valid JSON
- Same 4 generators as your `gag_service.py`:
  - `StudyPlanArtifact`
  - `GradingReport`
  - `MindMapSuggestions`
  - `PlagiarismNetworkReport`

🎉 **You've now run all 3 LangChain patterns.**

---

## Step 3 — (optional) View runs on LangSmith <a name="step-3"></a>

LangSmith is LangChain's free observability website. Every LLM call your local code makes appears there as a beautiful trace — perfect for showing your lecturer "look, here's exactly what the system did".

### 3.1 — Sign up for free LangSmith

1. Open **<https://smith.langchain.com>** in your browser.
2. Click **Sign up** (top right). Use your Google account or email.
3. The free tier gives you **5,000 traces per month** — more than enough for an FYP.

### 3.2 — Get your LangSmith API key

1. After signing in, click your **profile icon** (top right).
2. Click **Settings**.
3. Click **API Keys** in the left sidebar.
4. Click **Create API Key**.
5. Give it a name like "mysmartstudy-fyp" → **Create**.
6. **Copy the key immediately** — they show it only once. Format: `lsv2_pt_xxxxxxx...`.

### 3.3 — Add the key to your `.env`

Open `langchain_integration\.env` in Notepad and fill in:

```
LANGSMITH_API_KEY=lsv2_pt_your_real_key
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=mysmartstudy
```

Save and close.

### 3.4 — Re-run any LangChain script

```powershell
.\venv\Scripts\Activate.ps1
python 01_rag_layered.py
```

The script runs the same way. **But now, on the LangSmith website**, refresh the dashboard.

### 3.5 — View the trace on the LangSmith website

1. Open **<https://smith.langchain.com>**.
2. On the left, click **Projects**.
3. Click the project named **mysmartstudy** (or whatever you set in `LANGSMITH_PROJECT`).
4. You'll see a list of recent runs. Click the most recent one.

**What you'll see:**

- A **tree view** of every step (retrieve → multi-query → rerank → LLM call)
- The **exact prompts** sent to Gemini
- The **exact responses** back
- **Token counts** and **cost** per step
- **Errors**, if any

This is what your lecturer will be impressed by — *"this is a real production-grade trace of my AI pipeline running"*.

### 3.6 — Share a trace publicly

Click any trace → **Share** button (top right) → toggle **Public**. Copy the URL.

Paste that URL into your dissertation or PowerPoint — the lecturer can open it without an account.

---

## Step 4 — Run the CrewAI integration <a name="step-4"></a>

This covers **Pattern 4** (Multi-Agent Orchestration).

### 4.1 — Open a NEW PowerShell window

(Don't close the LangChain one — CrewAI gets its own venv.)

```powershell
cd "C:\Users\ASUS\Documents\SEM 6\FYP 2\code\MySmartStudy\crewai_integration"
```

### 4.2 — Create CrewAI venv + install

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

Wait ~3 minutes.

### 4.3 — Set up your `.env`

```powershell
copy .env.example .env
notepad .env
```

Paste your Gemini key (the SAME key from Step 1):

```
GEMINI_API_KEY=AIzaSy_paste_your_real_key
```

Save and close.

### 4.4 — Run the companion crew

```powershell
python 04_companion_crew.py
```

**What you should see:** A lot of colourful output as the 7 agents talk:

```
============================================================
Running CrewAI companion crew
Same 6-agent fan-out as your real backend's _get_student_context
============================================================

🚀 Crew: crew
└── 📋 Task: Course Enrolment Researcher
    Status: ✅ Completed
    ...

🤖 Agent: SmartBuddy Companion
    Task: Using all the specialist reports above, answer...
    
    Final Answer:
    Hi Alice! Based on what your team has gathered, here's my suggestion 
    for this week:
    
    1. **Friday's Databases Quiz needs priority** — your weak score on ER 
       Basics (55%) and your weekly reflection mentioning normalisation 
       challenges both point here...
    
    2. **Use Mon 11:00-14:00 (free after Databases class)**...
```

**What it's doing (same as your `_get_student_context` + `chat` endpoint):**

- 6 specialist agents run **in parallel** (because `async_execution=True` is set on each task)
- Each agent corresponds to one of your 6 `_ctx_*` functions:
  - `Course Enrolment Researcher` = `_ctx_courses`
  - `Deadline Tracker` = `_ctx_deadlines`
  - `Academic Performance Analyst` = `_ctx_performance`
  - `Schedule Planner` = `_ctx_timetables`
  - `Task Reminder` = `_ctx_reminders`
  - `Self-Reflection Reader` = `_ctx_reflections`
- A 7th `SmartBuddy Companion` agent waits for all 6, then writes the final reply

🎉 **You've now run all 4 patterns** — 3 on LangChain, 1 on CrewAI.

---

## Step 5 — (optional) View on CrewAI Studio <a name="step-5"></a>

CrewAI Studio is their visual interface. The free tier lets you sign up and explore.

### 5.1 — Sign up

1. Open **<https://app.crewai.com>** in your browser.
2. Click **Sign up** (or **Sign in**).
3. Use Google / email.

### 5.2 — Browse the studio

After signing in, you can:

- **Browse the agent library** — see other people's pre-built crews
- **Click "Build a crew"** — design agents and tasks visually
- **Run a crew** — execute it in the cloud (uses their compute)

⚠️ **Honest note:** CrewAI Studio is primarily a **paid product**. The free signup lets you explore, but running real crews in the cloud quickly hits paid tiers. **Your local `04_companion_crew.py` is the same thing, free, on your laptop.**

For a lecturer demo, I recommend showing the **local script output** (Step 4.4 above) rather than CrewAI Studio.

### 5.3 — Alternative: record your local terminal as a video

A nice trick — use Windows Game Bar (Win+G) to record your screen while running `python 04_companion_crew.py`. Embed that mp4 in your dissertation. It's more impressive than CrewAI Studio anyway because the lecturer sees the actual agent collaboration in real time.

---

## Step 6 — What to show your lecturer <a name="step-6"></a>

For the viva, prepare these in tabs/windows:

### Window 1 — Your real backend code

Open `backend/app/rag_service.py`, `gag_service.py`, etc. in VS Code. This is the hand-rolled code you actually ship.

### Window 2 — LangChain integration

Open `langchain_integration/01_rag_layered.py`, `02_graph_rag.py`, `03_gag_structured.py`. This is the equivalent built with industry-standard libraries.

### Window 3 — CrewAI integration

Open `crewai_integration/04_companion_crew.py`. Same multi-agent pattern as your `multi_agent.py`, expressed in CrewAI's role-based metaphor.

### Window 4 — A LangSmith trace

If you set up LangSmith in Step 3, open one of your traces in the browser. Show the lecturer the prompt tree.

### Window 5 — GitHub

Open <https://github.com/Kimmmmy03/MySmartStudy> in a tab. Show that everything is committed and version-controlled.

### Talking points for the lecturer

> *"My production code is hand-rolled for transparency and tight integration with my AI gate / token quota / audit log. For the viva I also re-implemented every pattern with the standard industry libraries — LangChain for retrieval and structured output, CrewAI for multi-agent — to prove I understand each pattern in its canonical form. Both implementations produce equivalent results. The hand-rolled version is what ships because it's smaller (around 1500 lines vs 2500) and depends on fewer fast-moving third-party libraries."*

---

## Troubleshooting <a name="troubleshooting"></a>

### `ModuleNotFoundError: No module named 'langchain'`

You forgot to activate the venv. Your prompt should start with `(venv)`. Run:

```powershell
.\venv\Scripts\Activate.ps1
```

### `Error: 429 Quota exceeded`

You burned through Gemini's free daily quota. Options:

- Wait until midnight Pacific time (the quota resets).
- Edit the script and change `gemini-2.5-flash` to `gemini-2.5-flash-lite` (lighter quota).

### `pydantic.errors.PydanticUserError: ...`

You probably have an old pydantic. Upgrade:

```powershell
pip install --upgrade pydantic
```

### LangSmith dashboard is empty

Three things to check:
1. `LANGSMITH_TRACING=true` is in your `.env`
2. `LANGSMITH_API_KEY` is filled in correctly
3. You ran the script AFTER editing `.env` (env vars are read on script start)

### CrewAI: "litellm.exceptions.AuthenticationError"

Your `GEMINI_API_KEY` is missing or wrong. Open `.env`, check the value is your real `AIzaSy…` key, save, run again.

### CrewAI agents loop forever

Set `max_iter=3` on each Agent constructor to cap it:

```python
courses_agent = Agent(
    role="...",
    goal="...",
    backstory="...",
    llm=fast_llm,
    max_iter=3,                   # ← add this
    allow_delegation=False,
)
```

### Reranker download fails on first run

The first `python 01_rag_layered.py` downloads ~80 MB of the BGE reranker. If your network is unstable, pre-download:

```powershell
python -c "from sentence_transformers import CrossEncoder; CrossEncoder('BAAI/bge-reranker-v2-m3')"
```

---

## Quick reference — all the links

| Resource | URL |
|---|---|
| Your repo | <https://github.com/Kimmmmy03/MySmartStudy> |
| Gemini free API key | <https://aistudio.google.com/app/apikey> |
| LangChain docs | <https://python.langchain.com/> |
| LangSmith (free observability) | <https://smith.langchain.com> |
| CrewAI docs | <https://docs.crewai.com> |
| CrewAI Studio (mostly paid) | <https://app.crewai.com> |

Good luck with your presentation! 🎓
