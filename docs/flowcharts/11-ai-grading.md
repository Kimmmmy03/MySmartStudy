# AI Grading Flow

## Overview
AI-assisted grading for lecturers using RAG-retrieved similar submissions, rubric criteria, class statistics, and GAG structured report generation with per-criterion scores and improvement suggestions.

## Flowchart

```mermaid
flowchart TD
    START([Lecturer views student submission]) --> CLICK_AI[Click Get AI Grade Recommendation]
    CLICK_AI --> API_CALL[POST /api/ai/grading/recommend/submission_id]

    subgraph Backend Processing
        API_CALL --> CHECK_CACHE{Cached recommendation exists?}
        CHECK_CACHE -->|Yes| RETURN_CACHED[Return cached result from Firestore]
        CHECK_CACHE -->|No| FETCH_SUB[Fetch submission from Firestore]

        FETCH_SUB --> EXTRACT_CONTENT{Submission type?}
        EXTRACT_CONTENT -->|Mind map| EXTRACT_MAP[Extract nodesText from linked map]
        EXTRACT_CONTENT -->|External link| EXTRACT_LINK[Use submission comments as content]
        EXTRACT_CONTENT -->|Text/Comments| EXTRACT_TEXT[Use comments field directly]

        EXTRACT_MAP --> LOAD_ASSIGNMENT
        EXTRACT_LINK --> LOAD_ASSIGNMENT
        EXTRACT_TEXT --> LOAD_ASSIGNMENT

        LOAD_ASSIGNMENT[Load assignment details]
        LOAD_ASSIGNMENT --> LOAD_RUBRIC[Load rubric criteria from Firestore]

        LOAD_RUBRIC --> CALC_STATS[Calculate class statistics]

        subgraph Class Statistics
            CALC_STATS --> GET_ALL_SUBS[Get all graded submissions for assignment]
            GET_ALL_SUBS --> COMPUTE_MEAN[Compute mean grade]
            COMPUTE_MEAN --> COMPUTE_MEDIAN[Compute median grade]
            COMPUTE_MEDIAN --> STATS_OBJ[Build stats: mean, median, count]
        end

        STATS_OBJ --> RAG_RETRIEVE[RAG: retrieve similar past submissions]

        subgraph RAG Retrieval
            RAG_RETRIEVE --> EMBED_CONTENT[Embed submission content]
            EMBED_CONTENT --> SEARCH_COURSE[Search ChromaDB for course collection]
            SEARCH_COURSE --> TOP_3[Return top 3 similar chunks]
        end

        TOP_3 --> GAG_CALL[GAG: generate_grading_report]

        subgraph GAG Report Generation
            GAG_CALL --> BUILD_PROMPT[Build prompt with submission, rubric, stats, RAG context]
            BUILD_PROMPT --> GEMINI[Gemini 2.5 Flash with grading knowledge base]
            GEMINI --> PARSE_JSON[Parse JSON response]
        end

        PARSE_JSON --> RESULT[Structured result]

        subgraph Result Structure
            RESULT --> RES_GRADE[recommended_grade: float 0-100]
            RESULT --> RES_CRITERIA[criterion_scores: per-criterion breakdown]
            RESULT --> RES_JUSTIFY[justification: paragraph explaining grade]
            RESULT --> RES_CONFIDENCE[confidence: float 0-1]
            RESULT --> RES_COMPARE[comparative_analysis: vs class and similar submissions]
            RESULT --> RES_IMPROVE[improvement_suggestions: with resource links]
        end

        RESULT --> CACHE_RESULT[Cache in Firestore aiGradeRecommendations collection]
        CACHE_RESULT --> RETURN_NEW[Return result]
    end

    RETURN_CACHED --> DISPLAY
    RETURN_NEW --> DISPLAY

    subgraph Display to Lecturer
        DISPLAY[Render AI Recommendation Card]
        DISPLAY --> SHOW_GRADE[Show recommended grade with confidence bar]
        SHOW_GRADE --> SHOW_CRITERIA[Show per-criterion score breakdown]
        SHOW_CRITERIA --> SHOW_JUSTIFY[Show justification text]
        SHOW_JUSTIFY --> SHOW_COMPARE[Show comparative analysis]
        SHOW_COMPARE --> SHOW_IMPROVE[Show improvement suggestions with resource links]
    end

    subgraph Lecturer Decision
        DISPLAY --> ACCEPT{Accept AI grade?}
        ACCEPT -->|Yes| USE_GRADE[Apply recommended_grade to submission]
        ACCEPT -->|Adjust| MANUAL_GRADE[Lecturer enters own grade + feedback]
        USE_GRADE --> SAVE_GRADE[PATCH /api/assignments/aid/submissions/sid/grade]
        MANUAL_GRADE --> SAVE_GRADE
        SAVE_GRADE --> NOTIFY_STUDENT[Notify student of graded submission]
    end
```

## Key Files
- `frontend-web/src/components/ai-grade-recommendation.tsx` — AI grade recommendation UI
- `frontend-web/src/lib/api.ts` — aiGradingApi.recommend(), aiGradingApi.getRecommendation()
- `backend/app/routers/ai_grading.py` — POST /api/ai/grading/recommend, GET recommendation
- `backend/app/gag_service.py` — generate_grading_report()
- `backend/app/rag_service.py` — retrieve() for similar submissions
