# Assignment Workflow

## Overview
Complete lifecycle from lecturer creating an assignment, students submitting work, grading (manual or AI-assisted), peer reviews, and feedback delivery.

## Flowchart

```mermaid
flowchart TD
    subgraph Lecturer Creates Assignment
        L_CREATE([Lecturer opens assignment form]) --> L_FILL[Fill: title, description, deadline, type]
        L_FILL --> L_TYPE{Assignment type?}
        L_TYPE -->|assignment| L_STANDARD[Standard submission]
        L_TYPE -->|tutorial| L_TUTORIAL[Tutorial submission]
        L_TYPE -->|project| L_PROJECT[Project submission]
        L_STANDARD --> L_RUBRIC{Add rubric?}
        L_TUTORIAL --> L_RUBRIC
        L_PROJECT --> L_RUBRIC
        L_RUBRIC -->|Yes| L_CRITERIA[Define rubric criteria + max points]
        L_RUBRIC -->|No| L_SAVE
        L_CRITERIA --> L_SAVE[POST /api/assignments/ - Save to Firestore]
        L_SAVE --> L_NOTIFY[Notify enrolled students]
        L_SAVE --> L_RAG_INDEX[Index assignment in RAG - ChromaDB]
    end

    subgraph Student Submits
        S_VIEW([Student views assignment]) --> S_DEADLINE{Before deadline?}
        S_DEADLINE -->|No| S_LATE[Show: deadline passed]
        S_DEADLINE -->|Yes| S_SUBMIT_TYPE{Submission type?}
        S_SUBMIT_TYPE -->|Mind map| S_MAP[Select existing mind map]
        S_SUBMIT_TYPE -->|External link| S_LINK[Enter URL]
        S_SUBMIT_TYPE -->|Comments| S_TEXT[Write text submission]
        S_MAP --> S_POST[POST /api/assignments/aid/submissions]
        S_LINK --> S_POST
        S_TEXT --> S_POST
        S_POST --> S_SAVED[Submission saved in Firestore]
        S_SAVED --> S_BADGE_CHECK[Check auto-badge: assignments_submitted, early_bird]
    end

    subgraph Grading - Manual
        G_VIEW([Lecturer views submissions list]) --> G_SELECT[Select student submission]
        G_SELECT --> G_CONTENT[View submission content - map/link/text]
        G_CONTENT --> G_GRADE[Enter grade 0-100 + feedback text]
        G_GRADE --> G_SAVE[PATCH /api/assignments/aid/submissions/sid/grade]
        G_SAVE --> G_NOTIFY_S[Notify student of grade]
    end

    subgraph Grading - AI Assisted
        G_SELECT --> G_AI[Click Get AI Recommendation]
        G_AI --> AI_CHECK{Cached recommendation?}
        AI_CHECK -->|Yes| AI_CACHED[Return cached result]
        AI_CHECK -->|No| AI_EXTRACT[Extract submission content]
        AI_EXTRACT --> AI_RUBRIC[Load rubric criteria]
        AI_RUBRIC --> AI_STATS[Compute class statistics - mean, median]
        AI_STATS --> AI_RAG[RAG: retrieve similar past submissions]
        AI_RAG --> AI_GAG[GAG: generate_grading_report]
        AI_GAG --> AI_RESULT[Return: recommended_grade, criterion_scores, justification, confidence, comparative_analysis, improvement_suggestions]
        AI_RESULT --> AI_DISPLAY[Display AI recommendation to lecturer]
        AI_CACHED --> AI_DISPLAY
        AI_DISPLAY --> G_OVERRIDE[Lecturer can accept or override grade]
        G_OVERRIDE --> G_SAVE
    end

    subgraph Peer Review
        PR_ENABLE([Lecturer enables peer review]) --> PR_ASSIGN[Students see reviewable submissions]
        PR_ASSIGN --> PR_REVIEW[Student writes review: rating 1-5 + comment]
        PR_REVIEW --> PR_SAVE[POST /api/peer-reviews/submission/sid]
        PR_SAVE --> PR_BADGE[Check auto-badge: peer_reviews count]
    end

    subgraph Grade Release
        G_SAVE --> GRADEBOOK[Update gradebook aggregation]
        GRADEBOOK --> GB_CALC[Calculate weighted grade: assignment_weight + quiz_weight]
        GB_CALC --> GB_DISPLAY[Show in student gradebook]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/course/[cid]/assignments/page.tsx` — Student assignments
- `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/assignments/page.tsx` — Lecturer assignments
- `frontend-web/src/components/ai-grade-recommendation.tsx` — AI grading UI
- `frontend-mobile/lib/screens/assignments_tab.dart` — Mobile assignments
- `frontend-mobile/lib/screens/student_submit_screen.dart` — Mobile submission
- `backend/app/routers/assignments.py` — Assignment CRUD + submissions
- `backend/app/routers/ai_grading.py` — AI grade recommendation
- `backend/app/gag_service.py` — generate_grading_report()
- `backend/app/routers/peer_review.py` — Peer review system
