# Quiz Workflow

## Overview
Full quiz lifecycle: creation with question types, student attempts with timer, auto-grading, results display, and integration with gradebook.

## Flowchart

```mermaid
flowchart TD
    subgraph Lecturer Creates Quiz
        L_START([Lecturer opens quiz creation]) --> L_META[Fill: title, description, time limit, deadline]
        L_META --> L_OPTIONS[Set options: shuffle questions, show results]
        L_OPTIONS --> L_SAVE[POST /api/quizzes/ - Save quiz metadata]
        L_SAVE --> L_QUESTIONS[Add questions to quiz]

        L_QUESTIONS --> Q_TYPE{Question type?}
        Q_TYPE -->|MCQ| Q_MCQ[Add options + correct answer index]
        Q_TYPE -->|True/False| Q_TF[Set correct answer: true/false]
        Q_TYPE -->|Short Answer| Q_SA[Set expected answer text]

        Q_MCQ --> Q_POINTS[Set points value]
        Q_TF --> Q_POINTS
        Q_SA --> Q_POINTS

        Q_POINTS --> Q_SAVE[POST /api/quizzes/qid/questions]
        Q_SAVE --> Q_MORE{More questions?}
        Q_MORE -->|Yes| Q_TYPE
        Q_MORE -->|No| L_DONE[Quiz ready, notify students]
        L_DONE --> L_RAG[Index quiz questions in RAG]
    end

    subgraph Question Bank Integration
        L_QUESTIONS -->|Import from bank| QB_BROWSE[GET /api/question-bank/ - Browse saved questions]
        QB_BROWSE --> QB_SELECT[Select questions to import]
        QB_SELECT --> QB_IMPORT[POST /api/question-bank/import-to-quiz]
        QB_IMPORT --> Q_SAVE
    end

    subgraph Student Takes Quiz
        S_VIEW([Student opens quiz page]) --> S_CHECK{Already attempted?}
        S_CHECK -->|Yes| S_RESULTS[Show previous attempt results]
        S_CHECK -->|No| S_DEADLINE{Before deadline?}
        S_DEADLINE -->|No| S_EXPIRED[Show: quiz expired]
        S_DEADLINE -->|Yes| S_START[Click Start Quiz]
        S_START --> S_TIMER[Start countdown timer - timeLimitMinutes]
        S_TIMER --> S_QUESTION[Display question with options]
        S_QUESTION --> S_ANSWER[Student selects/types answer]
        S_ANSWER --> S_NEXT{More questions?}
        S_NEXT -->|Yes| S_QUESTION
        S_NEXT -->|No| S_REVIEW[Review answers before submit]
        S_TIMER -->|Time up| S_AUTO_SUBMIT[Auto-submit current answers]
        S_REVIEW --> S_SUBMIT[POST /api/quizzes/qid/attempt]
        S_AUTO_SUBMIT --> S_SUBMIT
    end

    subgraph Auto-Grading
        S_SUBMIT --> GRADE_START[Backend receives answers dict]
        GRADE_START --> GRADE_LOOP[For each question]
        GRADE_LOOP --> GRADE_CHECK{Question type?}
        GRADE_CHECK -->|MCQ| GRADE_MCQ[Compare answer index to correctAnswer]
        GRADE_CHECK -->|True/False| GRADE_TF[Compare boolean to correctAnswer]
        GRADE_CHECK -->|Short Answer| GRADE_SA[Case-insensitive comparison]
        GRADE_MCQ --> GRADE_SCORE[Add points if correct]
        GRADE_TF --> GRADE_SCORE
        GRADE_SA --> GRADE_SCORE
        GRADE_SCORE --> GRADE_NEXT{More questions?}
        GRADE_NEXT -->|Yes| GRADE_LOOP
        GRADE_NEXT -->|No| GRADE_CALC[Calculate: score, totalPoints, percentage]
        GRADE_CALC --> GRADE_SAVE[Save quizAttempt to Firestore]
        GRADE_SAVE --> BADGE_CHECK[Check auto-badges: quiz_whiz, top_marks]
    end

    subgraph Results Display
        GRADE_SAVE --> SHOW_RESULTS{showResults enabled?}
        SHOW_RESULTS -->|Yes| SHOW_DETAIL[Show per-question results with correct answers]
        SHOW_RESULTS -->|No| SHOW_SCORE[Show only total score/percentage]

        SHOW_DETAIL --> GRADEBOOK[Update gradebook with quiz score]
        SHOW_SCORE --> GRADEBOOK
    end

    subgraph Lecturer Views Results
        L_RESULTS([Lecturer opens quiz results]) --> L_ATTEMPTS[GET /api/quizzes/qid/attempts - All attempts]
        L_ATTEMPTS --> L_STATS[Display: average, highest, lowest, distribution]
        L_ATTEMPTS --> L_PER_STUDENT[Per-student score breakdown]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/course/[cid]/quizzes/page.tsx` — Student quiz view
- `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/quizzes/page.tsx` — Lecturer quiz management
- `frontend-mobile/lib/screens/quizzes_screen.dart` — Mobile quiz screen
- `backend/app/routers/quizzes.py` — Quiz CRUD, questions, attempts, results
- `backend/app/routers/question_bank.py` — Reusable question pool
- `backend/app/routers/gradebook.py` — Gradebook integration
