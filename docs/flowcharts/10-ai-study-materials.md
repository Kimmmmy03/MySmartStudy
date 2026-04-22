# AI Study Materials Flow

## Overview
Students can generate AI-powered study materials (summaries, flashcards, practice quizzes) from course resources or by topic. Materials are persisted for later review.

## Flowchart

```mermaid
flowchart TD
    subgraph Generate from Resource
        START_R([Student views course resource]) --> CLICK_GEN[Click Generate Study Materials]
        CLICK_GEN --> CHOOSE_TYPE{Material type?}
        CHOOSE_TYPE -->|Summary| GEN_SUMMARY[POST /api/ai/study-materials/generate type=summary]
        CHOOSE_TYPE -->|Flashcards| GEN_FLASH[POST /api/ai/study-materials/generate type=flashcards]
        CHOOSE_TYPE -->|Practice Quiz| GEN_QUIZ[POST /api/ai/study-materials/generate type=quiz]
    end

    subgraph Generate by Topic
        START_T([Student opens study materials page]) --> TOPIC_INPUT[Enter topic + select course]
        TOPIC_INPUT --> GEN_TOPIC[POST /api/ai/study-materials/generate-by-topic]
    end

    subgraph Backend Generation
        GEN_SUMMARY --> EXTRACT[Extract resource content]
        GEN_FLASH --> EXTRACT
        GEN_QUIZ --> EXTRACT
        GEN_TOPIC --> RAG_TOPIC[RAG: retrieve materials for topic from course]
        RAG_TOPIC --> EXTRACT

        EXTRACT --> BUILD_PROMPT{Material type?}

        BUILD_PROMPT -->|Summary| PROMPT_SUM[Prompt: Create comprehensive summary with key concepts, definitions, examples]
        BUILD_PROMPT -->|Flashcards| PROMPT_FLASH[Prompt: Create 10-15 flashcards with front/back in JSON]
        BUILD_PROMPT -->|Quiz| PROMPT_QUIZ[Prompt: Create 10 practice questions - MCQ, T/F, short answer in JSON]

        PROMPT_SUM --> GEMINI[Gemini 2.5 Flash with study_materials knowledge base]
        PROMPT_FLASH --> GEMINI
        PROMPT_QUIZ --> GEMINI

        GEMINI --> PARSE{Parse response}
        PARSE -->|Summary| PARSE_MD[Parse as markdown text]
        PARSE -->|Flashcards| PARSE_CARDS[Parse JSON: cards with front + back]
        PARSE -->|Quiz| PARSE_QUESTIONS[Parse JSON: questions with options + answers]

        PARSE_MD --> SAVE[Save to Firestore generatedStudyMaterials collection]
        PARSE_CARDS --> SAVE
        PARSE_QUESTIONS --> SAVE
    end

    subgraph Display Materials
        SAVE --> RETURN[Return generated material]

        RETURN -->|Summary| VIEW_SUM[Render formatted markdown summary]
        RETURN -->|Flashcards| VIEW_FLASH[Interactive flashcard viewer]
        RETURN -->|Quiz| VIEW_QUIZ[Interactive practice quiz]

        subgraph Flashcard Viewer
            VIEW_FLASH --> FLIP[Tap card to flip front/back]
            FLIP --> NEXT_CARD[Swipe or navigate to next card]
            NEXT_CARD --> PROGRESS[Show progress: card N of total]
        end

        subgraph Practice Quiz Viewer
            VIEW_QUIZ --> SHOW_Q[Display question with options]
            SHOW_Q --> SELECT_A[Student selects answer]
            SELECT_A --> IMMEDIATE_FB[Show immediate feedback: correct/incorrect + explanation]
            IMMEDIATE_FB --> NEXT_Q{More questions?}
            NEXT_Q -->|Yes| SHOW_Q
            NEXT_Q -->|No| QUIZ_SCORE[Show final score summary]
        end
    end

    subgraph Material Management
        START_T --> LIST_SAVED[GET /api/ai/study-materials/ - List saved materials]
        LIST_SAVED --> BROWSE[Browse by course, type, date]
        BROWSE --> OPEN_SAVED[Open previously generated material]
        BROWSE --> DELETE_MAT[DELETE /api/ai/study-materials/id]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/study-materials/page.tsx` — Study materials page
- `frontend-web/src/components/ai-study-materials/` — Viewers for summaries, flashcards, quizzes
- `frontend-mobile/lib/screens/ai_study_materials_screen.dart` — Mobile study materials
- `frontend-mobile/lib/screens/ai_summary_viewer.dart` — Mobile summary viewer
- `frontend-mobile/lib/screens/ai_flashcard_viewer.dart` — Mobile flashcard viewer
- `frontend-mobile/lib/screens/ai_practice_quiz_screen.dart` — Mobile practice quiz
- `backend/app/routers/ai_study_materials.py` — Generate, list, delete endpoints
- `backend/app/ai_service.py` — generate_json(), get_knowledge_base("study_materials")
