# MySmartStudy — Demo Video Flow & Recording Plan

A scene-by-scene plan for the **3–5 minute** FYP demo video, grounded in features that
actually exist and run in this codebase. The **DEMONSTRATION** section (screen recording)
is the detailed core; the bookend sections (title/intro/impact/closing) can be slides.

> Target length: **~4:00** (safely inside 3–5 min). Time budget per scene is given so you
> can trim. Anything marked _(optional)_ is the first thing to cut if you run long.

---

## 0. Before you record — setup checklist

**Accounts / data (so the demo isn't empty):**
- [ ] One **lecturer** account with a course that has: a few **resources/PDFs uploaded** (so RAG has content to ground on), at least one **tutorial-type assignment** with a **rubric**, and **3–5 student submissions** already in.
- [ ] One **student** account enrolled in that course, with **1–2 mind maps** and some points/streak so the dashboard looks alive.
- [ ] For plagiarism: make **2 submissions deliberately similar** (copy a paragraph between them) so the report has something to flag.
- [ ] For grading: leave **1 submission ungraded** so you can run the AI grader live.

**Environment:**
- [ ] Backend running: `cd backend && uvicorn main:app --port 8000`
- [ ] Frontend running: `cd frontend-web && npm run dev` → `http://localhost:3000`
- [ ] Confirm `GEMINI_API_KEY` is set and AI features are enabled (admin → AI settings) so live AI calls work.
- [ ] Browser at **1920×1080**, zoom 100%, bookmarks bar hidden, light **or** dark theme chosen and consistent. (Dark glassmorphism films best.)
- [ ] Pre-open the two accounts in **two browser profiles/windows** so switching student↔lecturer is instant (don't film logging in twice).

**Tools (pick one path):**
- **All-in-one (recommended):** [Descript](https://www.descript.com) — record screen, auto-subtitles, delete filler words by deleting text, AI voiceover.
- **Free:** [OBS Studio](https://obsproject.com) to capture, + [CapCut](https://www.capcut.com)/[Veed](https://veed.io) for captions, + [ElevenLabs](https://elevenlabs.io) for AI narration.
- Bookend slides: Gamma / Canva / PowerPoint.

**Recording hygiene:**
- Record each scene as a **separate clip** — easier to re-take.
- Move the mouse **slowly and deliberately**; pause ~1s before each click.
- Pre-type long text into a notepad and paste it (don't film slow typing).
- Hide notifications / use Do-Not-Disturb.

---

## 1. Full video timeline (overview)

| # | Section | Type | Time | Cumulative |
|---|---------|------|------|------------|
| 1 | Title | Slide | 0:00–0:12 | 0:12 |
| 2 | Introduction | Slide / voiceover | 0:12–0:35 | 0:35 |
| 3 | Problem Statement | Slide | 0:35–0:55 | 0:55 |
| 4 | Objectives & Target Users | Slide | 0:55–1:15 | 1:15 |
| 5 | **DEMONSTRATION** | **Screen recording** | **1:15–3:35** | 3:35 |
| 6 | Impact & Future Scope | Slide | 3:35–3:50 | 3:50 |
| 7 | Closing & Acknowledgements | Slide | 3:50–4:05 | 4:05 |

The rest of this file details **Section 5 (the recording)** plus copy-paste narration for the bookends.

---

## 2. DEMONSTRATION — scene-by-scene shot list (the part you RECORD)

Total ≈ **2:20**. Two personas: **Student** (uses AI to learn) → **Lecturer** (uses AI to assess).

### Scene A — First impression: login → student dashboard  ·  ~15s
**Record:**
1. Land on the login page (auth screen, animated gradient background).
2. Log in as the student → the **student dashboard** loads with its animation.
3. Slowly pan over: greeting, **points/streak**, **Quick Actions**, **Recent Maps** cards.

**On-screen callout:** "Student Dashboard"
**Narration:**
> "MySmartStudy is an AI-powered learning platform. Students land on a personalised
> dashboard — tracking progress, recent mind maps, and one-tap access to AI study tools."

---

### Scene B — AI Study Materials (RAG innovation)  ·  ~30s
**Record:**
1. From the dashboard click **"AI Materials"** (Quick Action) — the generation wizard opens.
2. Pick a course/topic, choose **Flashcards** (and mention Summary / Quiz options on screen).
3. Click generate — show the loading state, then the **flashcard viewer** flipping a card.

**On-screen callout:** "AI Study Materials — grounded in YOUR course content (RAG)"
**Narration:**
> "Instead of generic AI answers, MySmartStudy uses Retrieval-Augmented Generation —
> it reads the lecturer's actual uploaded materials, then generates summaries, flashcards,
> and practice quizzes grounded in that content. Here, flashcards are created in seconds."

---

### Scene C — Mind Map editor + Mind Map Buddy (innovation)  ·  ~35s
**Record:**
1. Open a mind map (or **Create Map**) — show the **React Flow canvas**, drag a node, show shapes/colours.
2. Open the **Mind Map Buddy / recommendation sidebar** — request suggestions.
3. Show AI-suggested next concepts appearing; **add one suggested node** to the map.
4. Briefly show **auto-save** indicator (and mention real-time collaboration).

**On-screen callout:** "Mind Map Buddy — suggests the RIGHT next concept (knowledge-graph grounded)"
**Narration:**
> "Students build mind maps on an interactive canvas. The Mind Map Buddy doesn't suggest
> random ideas — it traverses a knowledge graph built from the course material to recommend
> the most relevant next concepts. Changes auto-save and maps can be shared for live collaboration."

---

### Scene D — SmartBuddy AI Companion  ·  ~20s _(optional — cut first if long)_
**Record:**
1. Open the floating **AI Companion** widget.
2. Ask a course question (pre-decide the question); show the grounded answer + any **suggested actions**.

**On-screen callout:** "SmartBuddy — your study companion"
**Narration:**
> "SmartBuddy answers questions using the same grounded knowledge, and suggests follow-up
> actions like generating notes on a weak topic."

---

### Scene E — Student submits work → switch to lecturer  ·  ~10s
**Record:**
1. Student opens an **assignment**, submits the **mind map** (show the submit confirmation).
2. **Cut** to the lecturer window.

**Narration:**
> "When a student submits an assignment, the lecturer's AI assessment tools take over."

---

### Scene F — Lecturer: AI Grading Assistant (innovation + functionality)  ·  ~45s ⭐
> ⭐ This is a flagship differentiator — give it room.

**Record:**
1. Lecturer → **course → Assignments** → open the tutorial assignment's submissions.
2. On an **ungraded** submission, click **"AI Suggest Grade"**.
3. Show the result panel: **advisory banner** ("recommendation, not a final grade"),
   the **grade**, the **measured confidence** ("agreement across N passes"), and the
   **per-criterion breakdown with quoted evidence**.
4. Click **"Accept & Pre-fill"** → the grade modal opens; show you can **override** with a reason.
5. Point to the **"AI Grading Accuracy" card** (QWK / agreement with the lecturer's own grades).

**On-screen callouts:** "Rubric-decomposed scoring" · "Measured confidence (self-consistency)" · "Human accepts or overrides — always" · "QWK: measured agreement with the lecturer"
**Narration:**
> "For grading, the AI scores each rubric criterion independently and quotes evidence from
> the submission. It grades several times and reports a real confidence based on how much
> those runs agree — not a made-up number. Crucially, the AI never sets the final grade:
> the lecturer accepts or overrides every recommendation, and the system measures its own
> agreement with the lecturer over time using Quadratic Weighted Kappa."

---

### Scene G — Lecturer: Plagiarism Detection (innovation + functionality)  ·  ~45s ⭐
**Record:**
1. From the assignment, open **"Full Plagiarism Report"**.
2. Show the **overview**: risk verdict, flagged pairs, severity stats.
3. **Expand a flagged pair** → show the **side-by-side matched passages highlighted**
   and the **score breakdown** (TF-IDF + fingerprint + combined).
4. Show the **Confirm / Dismiss review** controls (human-in-the-loop).
5. _(optional)_ Switch to the **Cross-Submission Similarity** network graph view.

**On-screen callouts:** "Multi-signal: TF-IDF + winnowing fingerprint" · "Exact matched passages as evidence" · "Screening signal — lecturer decides"
**Narration:**
> "Plagiarism detection combines two methods: term-frequency similarity and winnowing
> fingerprinting — the algorithm behind MOSS. It doesn't just give a percentage; it
> highlights the exact overlapping passages as evidence. The lecturer reviews each pair
> and confirms or dismisses it, and a similarity network reveals copying clusters across
> the whole class."

---

### Scene H — Analytics / AI governance  ·  ~10s _(optional)_
**Record:** Lecturer **Analytics** page, or Admin **AI Usage/Settings** (token quotas, feature kill-switches).
**Narration:**
> "Lecturers get class analytics, and administrators control AI usage, cost, and feature access."

---

## 3. What to RECORD vs. what can be a SLIDE

| Make it a screen recording | Make it a slide (faster, cleaner) |
|---|---|
| Scenes A–H above (the live app) | Title, Introduction, Problem Statement |
| Any animation/interaction | Objectives & Target Users (bullets) |
| The two AI flagship features (F, G) | Impact & Future Scope |
| | Closing & Acknowledgements |

You only need to capture **~2.5 minutes of real screen footage**. Everything else is slides + voiceover.

---

## 4. Bookend narration (copy-paste into TTS or read aloud)

**(1) Title** — _slide: "MySmartStudy — An AI-Powered Learning & Assessment Platform"_
> "MySmartStudy — an AI-powered learning and assessment platform for universities."

**(2) Introduction**
> "Students are overwhelmed with material and generic AI tools that don't know their course.
> Lecturers, meanwhile, spend hours grading and checking for plagiarism. MySmartStudy brings
> both sides together with AI that's grounded in each course's own content."

**(3) Problem Statement**
> "Generic AI gives ungrounded, sometimes wrong answers. Manual grading is slow and
> inconsistent, and existing plagiarism tools give a number without evidence — and no
> human oversight."

**(4) Objectives & Target Users**
> "Our objectives: ground AI in real course material, give students active study tools,
> and give lecturers trustworthy, human-in-the-loop assessment. Target users: university
> students and lecturers."

**(6) Impact & Future Scope**
> "MySmartStudy saves lecturers time while keeping them in control, and helps students learn
> actively. Next: deeper learning analytics, external source matching for plagiarism, and
> mobile expansion."

**(7) Closing & Acknowledgements** — _slide_
> "Thank you for watching. This project was developed by **[YOUR NAME]**, supervised by
> **[SUPERVISOR NAME]**."

> ✏️ Replace **[YOUR NAME]** and **[SUPERVISOR NAME]**.

---

## 5. Editing & subtitle checklist

- [ ] Assemble in order: bookend slides + the recorded scenes (A→H).
- [ ] Add **voiceover** (AI TTS or your own) per the narration above.
- [ ] Generate **auto-subtitles** and proofread them (the rubric explicitly wants narration **or** subtitles — do both for safety).
- [ ] Add the **on-screen callouts** as text overlays at each scene.
- [ ] Add a subtle zoom/highlight when clicking the two AI features (F, G) so the viewer's eye follows.
- [ ] Trim to land between **3:00 and 5:00**. If long, cut Scenes D and H first.
- [ ] Export **1080p, MP4**.

---

## 6. One-line summary of the "story" you're telling
**A student uses grounded AI to study and build mind maps → submits work → the lecturer uses
AI that scores with evidence and flags plagiarism with evidence, but always makes the final
call.** Grounded AI + human-in-the-loop is the innovation thread — keep repeating it.
