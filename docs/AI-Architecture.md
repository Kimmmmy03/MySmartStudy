# MySmartStudy AI Architecture

## PlantUML Diagrams

### 1. High-Level AI System Architecture

```plantuml
@startuml AI_System_Overview

skinparam backgroundColor #1a1a2e
skinparam defaultFontColor #e0e0e0
skinparam componentBackgroundColor #2a2a4a
skinparam componentBorderColor #4a4a6a
skinparam packageBackgroundColor #22223a
skinparam packageBorderColor #4a4a6a
skinparam databaseBackgroundColor #1e3a5f
skinparam databaseBorderColor #3a6a9f
skinparam cloudBackgroundColor #3a2a5a
skinparam cloudBorderColor #6a4a9a
skinparam arrowColor #8888cc
skinparam actorBorderColor #8888cc

title MySmartStudy - AI Architecture Overview

actor "Student" as student
actor "Lecturer" as lecturer

package "Frontend (Next.js)" {
  component "AI Companion Widget" as companion_ui
  component "Exam Planner" as exam_ui
  component "Study Materials" as materials_ui
  component "Mindmap Buddy" as buddy_ui
  component "Study Guide" as guide_ui
  component "Timetable Upload" as timetable_ui
  component "AI Grading Panel" as grading_ui
  component "Plagiarism Checker" as plagiarism_ui
  component "Course Import" as import_ui
  component "AI Image Gen" as image_ui
}

package "Backend (FastAPI)" {
  component "ai_service.py" as ai_core
  component "rag_service.py" as rag
  component "gag_service.py" as gag

  package "Routers" {
    component "ai_study_plan.py" as r_plan
    component "ai_study_materials.py" as r_materials
    component "ai_companion.py" as r_companion
    component "ai_mindmap_buddy.py" as r_buddy
    component "ai_grading.py" as r_grading
    component "ai_plagiarism.py" as r_plagiarism
    component "ai_images.py" as r_images
    component "ai_import.py" as r_import
  }
}

cloud "Google Gemini API" {
  component "gemini-2.5-flash" as model_smart
  component "text-embedding-004" as model_embed
  component "image-generation" as model_image
}

database "ChromaDB" as chroma
database "SQLite" as sqlite
database "Firestore" as firestore

student --> companion_ui
student --> exam_ui
student --> materials_ui
student --> buddy_ui
student --> guide_ui
student --> timetable_ui
student --> image_ui
lecturer --> grading_ui
lecturer --> plagiarism_ui
lecturer --> import_ui

companion_ui --> r_companion
exam_ui --> r_plan
materials_ui --> r_materials
buddy_ui --> r_buddy
guide_ui --> r_plan
timetable_ui --> r_plan
grading_ui --> r_grading
plagiarism_ui --> r_plagiarism
import_ui --> r_import
image_ui --> r_images

r_plan --> ai_core
r_materials --> ai_core
r_companion --> ai_core
r_buddy --> ai_core
r_grading --> ai_core
r_plagiarism --> ai_core
r_images --> ai_core
r_import --> ai_core

r_plan --> gag
r_grading --> gag
r_buddy --> gag
r_plagiarism --> gag

r_companion --> rag
r_buddy --> rag
r_materials --> rag
r_grading --> rag
r_plan --> rag

ai_core --> model_smart
rag --> model_embed
r_images --> model_image

rag --> chroma
ai_core --> sqlite
r_plan --> firestore
r_companion --> firestore
r_buddy --> firestore
r_materials --> firestore
r_grading --> firestore
r_plagiarism --> firestore
r_images --> firestore
r_import --> firestore

@enduml
```

### 2. Data Flow Per AI Feature

```plantuml
@startuml AI_Data_Flows

skinparam backgroundColor #1a1a2e
skinparam defaultFontColor #e0e0e0
skinparam packageBackgroundColor #22223a
skinparam packageBorderColor #4a4a6a
skinparam componentBackgroundColor #2a2a4a
skinparam componentBorderColor #4a4a6a
skinparam arrowColor #8888cc
skinparam noteBorderColor #4a4a6a
skinparam noteBackgroundColor #2a2a3e

title AI Features - Data Sources and Outputs

package "1. AI Companion" {
  component "Enrolled courses\nQuiz scores\nAssignment grades\nTimetables\nReminders\nLearning profile (VARK)\nChat history (15 msgs)" as comp_in
  component "RAG retrieval\nSMART_MODEL chat\nLearning style adapt" as comp_proc
  component "Conversational response\nSource citations" as comp_out
}
comp_in --> comp_proc
comp_proc --> comp_out
note bottom of comp_out : Cache: 7d (non-course queries)

package "2. Exam Plan" {
  component "Selected courses\nExam dates\nTopics list" as exam_in
  component "FAST_MODEL\ngenerate_json\nSchedule optimization" as exam_proc
  component "Daily sessions\nDuration per session\nPersonalized tips" as exam_out
}
exam_in --> exam_proc
exam_proc --> exam_out
note bottom of exam_out : Cache: by exam hash

package "3. Daily Study Guide" {
  component "Enrolled courses\nQuiz scores / grades\nWeak topics\nTimetables\nDeadlines" as guide_in
  component "RAG weak topics\nGAG study plan\nTimetable scheduling" as guide_proc
  component "Time-slotted recs\nDifficulty ratings\nResource links\nMotivational message" as guide_out
}
guide_in --> guide_proc
guide_proc --> guide_out
note bottom of guide_out : Cache: 24 hours

package "4. Study Materials" {
  component "Resource content\nCourse materials (RAG)\nTopic query" as mat_in
  component "FAST_MODEL\ngenerate_json\nRAG grounding" as mat_proc
  component "Markdown summaries\nFlashcard arrays\nPractice quizzes" as mat_out
}
mat_in --> mat_proc
mat_proc --> mat_out
note bottom of mat_out : Cache: 7d dedup

package "5. Mindmap Buddy" {
  component "Map nodes/edges\nTask description\nEnrolled courses\nChat history\nUser preferences" as map_in
  component "SMART_MODEL\nRAG course content\nGAG graph suggestions\nKnowledge graph" as map_proc
  component "Rating (1-10)\nStrengths\nSuggested nodes\nStructure feedback" as map_out
}
map_in --> map_proc
map_proc --> map_out
note bottom of map_out : Cache: 2h analysis, 24h recs

package "6. AI Grading" {
  component "Submission content\nRubric criteria\nClass statistics\nSimilar submissions (RAG)" as grade_in
  component "SMART_MODEL via GAG\nComparative analysis\nPer-criterion scoring" as grade_proc
  component "Recommended grade\nPer-criterion report\nConfidence score\nImprovement tips" as grade_out
}
grade_in --> grade_proc
grade_proc --> grade_out
note bottom of grade_out : Cache: once per submission

package "7. Plagiarism Detection" {
  component "Submission text\nAll submissions\nKnowledge graph" as plag_in
  component "SMART_MODEL analysis\nGAG network analysis\nCluster detection" as plag_proc
  component "Plagiarism percentage\nSource types\nSimilarity edges\nCluster narrative" as plag_out
}
plag_in --> plag_proc
plag_proc --> plag_out
note bottom of plag_out : Cache: once per submission

package "8. AI Image Generation" {
  component "Text prompt\nStyle preset\nUser ID (quota)" as img_in
  component "SMART_MODEL elaboration\nImage generation model" as img_proc
  component "Generated image\nElaborated prompt" as img_out
}
img_in --> img_proc
img_proc --> img_out
note bottom of img_out : Quota: 1/day, dedup 7d

package "9. Timetable Extraction" {
  component "Timetable text\nor PDF upload" as tt_in
  component "FAST_MODEL\nstructured extraction" as tt_proc
  component "Parsed schedule\nRecommended study slots" as tt_out
}
tt_in --> tt_proc
tt_proc --> tt_out
note bottom of tt_out : Cache: 30 days

package "10. Course Import" {
  component "Google Sites URL\nCourse ID" as ci_in
  component "FAST_MODEL structuring\nWeb scraping" as ci_proc
  component "Modules with items\nCourse name/code" as ci_out
}
ci_in --> ci_proc
ci_proc --> ci_out
note bottom of ci_out : Cache: 24h per URL

@enduml
```

### 3. RAG + GAG Pipeline

```plantuml
@startuml RAG_GAG_Pipeline

skinparam backgroundColor #1a1a2e
skinparam defaultFontColor #e0e0e0
skinparam activityBackgroundColor #2a2a4a
skinparam activityBorderColor #4a4a6a
skinparam arrowColor #8888cc

title RAG + GAG Pipeline Architecture

start

partition "Document Ingestion" #1e3a5f {
  :Course resources uploaded\n(PDFs, URLs, Text);
  :Text chunking\n(500 tokens, 50 overlap);
  :Gemini Embeddings\n(text-embedding-004, batch 100);
  :Store in ChromaDB\n(course-scoped collection);
}

partition "RAG Retrieval" #2a2a4a {
  :Receive user query or context;
  :Embed query via\ntext-embedding-004;
  :Semantic search\n(top-k cosine similarity);
  :Format context and citations;
}

partition "GAG Generation" #3a2a5a {
  fork
    :Student performance data\n(quiz scores, grades, weak topics);
  fork again
    :External context\n(deadlines, timetables, rubrics);
  fork again
    :RAG context + citations;
  end fork
  :Gemini SMART_MODEL\ngenerate structured JSON;
}

partition "Structured Output" #1a3a2a {
  :Return artifact;
  note right
    Possible outputs:
    - Study Plan (difficulty ratings, resource links)
    - Grading Report (per-criterion, comparative)
    - Graph Suggestions (new nodes/edges)
    - Plagiarism Network (clusters, edges)
  end note
}

stop

@enduml
```

### 4. Caching and Storage Architecture

```plantuml
@startuml Caching_Architecture

skinparam backgroundColor #1a1a2e
skinparam defaultFontColor #e0e0e0
skinparam packageBackgroundColor #22223a
skinparam packageBorderColor #4a4a6a
skinparam componentBackgroundColor #1e3a5f
skinparam componentBorderColor #3a6a9f
skinparam databaseBackgroundColor #1e3a5f
skinparam databaseBorderColor #3a6a9f
skinparam arrowColor #8888cc

title AI Caching and Storage Strategy

package "Firestore Collections" {

  package "Study Plan Cache" {
    component "AI_DAILY_GUIDE_CACHE\nTTL: 24h" as dgc
    component "AI_EXAM_PLAN_CACHE\nhash-keyed" as epc
    component "AI_STUDY_PLANS\npersisted" as sp
    component "SAVED_TIMETABLES" as st
    component "AI_TIMETABLE_CACHE\nTTL: 30d" as tc
  }

  package "Materials Cache" {
    component "GENERATED_STUDY_MATERIALS\nTTL: 7d dedup" as gsm
  }

  package "Companion State" {
    component "AI_CHAT_HISTORY\n15 msgs per user" as ch
    component "AI_COMPANION_QUESTION_CACHE\nTTL: 7d" as qc
    component "LEARNING_PROFILES\nVARK style" as lp
  }

  package "Mindmap Buddy State" {
    component "AI_MAP_ANALYSIS_CACHE\nTTL: 2h" as mac
    component "AI_NODE_RECS_CACHE\nTTL: 24h" as nrc
    component "AI_SUGGEST_ALL_CACHE" as sac
    component "AI_MINDMAP_BUDDY_MEMORY\n30 msgs + prefs" as mbm
  }

  package "Grading and Plagiarism" {
    component "AI_GRADE_RECOMMENDATIONS\none per submission" as agr
    component "AI_PLAGIARISM_REPORTS\none per submission" as apr
  }

  package "Image Generation" {
    component "AI_IMAGE_CACHE\nTTL: 7d dedup" as ic
    component "AI_IMAGE_QUOTAS\n1/day per user" as iq
    component "AI_ELABORATION_CACHE\nTTL: 30d" as ec
  }

  package "Import" {
    component "AI_IMPORT_CACHE\nTTL: 24h per URL" as imc
  }

  package "Usage Tracking" {
    component "AI_USAGE_SUMMARY\ntokens per feature" as aus
  }
}

database "ChromaDB\nVector Store" as chroma
note right of chroma
  Per-course collections
  Embedded text chunks
  Cosine similarity search
end note

database "SQLite\nmysmartstudy.db" as sqlite
note right of sqlite
  Users, Courses
  Assignments, Submissions
  Quizzes, Grades
end note

@enduml
```

### 5. Token Usage Tracking Flow

```plantuml
@startuml Token_Tracking

skinparam backgroundColor #1a1a2e
skinparam defaultFontColor #e0e0e0
skinparam activityBackgroundColor #2a2a4a
skinparam activityBorderColor #4a4a6a
skinparam arrowColor #8888cc

title Token Usage Tracking Flow

start

:Router receives API request;

:Call set_tracking_context(\n  user_id, feature\n);
note right: e.g. feature = "exam_plan"

:ai_service processes request\nvia Gemini API;

:Gemini returns response\nwith usage metadata;

:Extract token counts:\n- input_tokens\n- output_tokens\n- total_tokens;

:Log to Firestore\nAI_USAGE_SUMMARY collection;
note right
  Document key: user_id + feature
  Fields:
  - total_input_tokens
  - total_output_tokens
  - call_count
  - last_used timestamp
end note

stop

@enduml
```

## Feature Summary Table

| # | Feature | Endpoint | Model | Data Sources | Cache TTL |
|---|---------|----------|-------|-------------|-----------|
| 1 | AI Companion | `POST /ai/companion/chat` | SMART | Courses, grades, timetables, learning profile, RAG | 7d (questions) |
| 2 | Exam Plan | `POST /ai/study-plan/exam-plan` | FAST | Exam dates, topics | By hash |
| 3 | Daily Guide | `GET /ai/study-plan/daily-guide` | FAST + GAG | Courses, grades, timetables, deadlines, RAG | 24h |
| 4 | Study Materials | `POST /ai/study-materials/generate` | FAST | Resource content, RAG | 7d dedup |
| 5 | Mindmap Buddy | `POST /ai/mindmap-buddy/*` | SMART | Map data, courses, RAG, preferences | 2h-24h |
| 6 | AI Grading | `POST /ai/grading/recommend/{id}` | SMART + GAG | Submission, rubric, class stats, RAG | Once |
| 7 | Plagiarism | `POST /ai/plagiarism/analyze/{id}` | SMART + GAG | Submissions, similarity graph | Once |
| 8 | Image Gen | `POST /ai/images/generate` | SMART + Image | Prompt, style | 7d dedup, 1/day |
| 9 | Timetable | `POST /ai/study-plan/timetable-*` | FAST | Text/PDF | 30d |
| 10 | Course Import | `POST /ai/import/google-sites` | FAST | Google Sites URL | 24h |
