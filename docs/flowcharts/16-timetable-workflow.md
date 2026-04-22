# Timetable Workflow

## Overview
Students upload or paste class timetables, AI extracts structured schedules and recommends study time slots. Timetables are saved with semester labels and feed into the Daily Guide and Calendar/Planner.

## Flowchart

```mermaid
flowchart TD
    subgraph Upload and Extract
        START([Student opens Timetable Analysis tab]) --> INPUT_METHOD{Input method?}

        INPUT_METHOD -->|Paste text| TEXT_INPUT[Paste timetable text into textarea]
        INPUT_METHOD -->|Upload PDF| PDF_INPUT[Select PDF file from device]

        TEXT_INPUT --> VALIDATE_TEXT{Text length >= 10 chars?}
        VALIDATE_TEXT -->|No| TEXT_ERROR[Error: Please provide timetable text]
        VALIDATE_TEXT -->|Yes| ANALYZE_TEXT[POST /api/ai/study-plan/timetable-analyze]

        PDF_INPUT --> VALIDATE_PDF{Valid PDF and under 5MB?}
        VALIDATE_PDF -->|No| PDF_ERROR[Error: Invalid file]
        VALIDATE_PDF -->|Yes| UPLOAD_PDF[POST /api/ai/study-plan/timetable-upload - multipart form]

        subgraph Backend - AI Extraction
            ANALYZE_TEXT --> AI_PARSE
            UPLOAD_PDF --> PDF_EXTRACT[PyPDF2: extract text from PDF pages]
            PDF_EXTRACT --> AI_PARSE

            AI_PARSE[Build extraction prompt with timetable text]
            AI_PARSE --> GEMINI[Gemini 2.5 Flash: generate_json with study_plan knowledge base]

            GEMINI --> PARSE_RESULT[Parse JSON response]

            subgraph Extraction Output
                PARSE_RESULT --> SCHEDULE["parsed_schedule: [{day, classes: [{time, subject, location}]}]"]
                PARSE_RESULT --> STUDY_TIMES["recommended_study_times: [{day, time, duration_minutes, reason}]"]
            end

            SCHEDULE --> SORT_DAYS[Sort days: Monday through Sunday]
            SORT_DAYS --> SORT_CLASSES[Sort classes within each day by start time]
            STUDY_TIMES --> SORT_STUDY[Sort study times by day then time]
        end
    end

    subgraph Display Results
        SORT_CLASSES --> SHOW_TABLE[Display parsed schedule as day-by-day table]
        SORT_STUDY --> SHOW_SLOTS[Display recommended study time cards with reason]
    end

    subgraph Save Timetable
        SHOW_TABLE --> SAVE_SECTION[Show save section]
        SAVE_SECTION --> LABEL_INPUT[Enter semester label - e.g. Semester 2 2025/2026]
        LABEL_INPUT --> SAVE_BTN[Click Save Timetable]
        SAVE_BTN --> SAVE_API[POST /api/ai/study-plan/timetables]

        subgraph Backend - Save
            SAVE_API --> CREATE_DOC[Create doc in savedTimetables collection]
            CREATE_DOC --> STORE["Store: userId, semesterLabel, parsed_schedule, recommended_study_times, createdAt"]
        end

        STORE --> RETURN_SAVED[Return saved timetable with ID]
        RETURN_SAVED --> REFRESH[Refresh saved timetables list]
    end

    subgraph Manage Saved Timetables
        START --> LIST_SAVED[GET /api/ai/study-plan/timetables]
        LIST_SAVED --> DISPLAY_LIST[Display all saved timetables with semester labels]
        DISPLAY_LIST --> DELETE_BTN[Delete button per timetable]
        DELETE_BTN --> CONFIRM_DELETE{Confirm delete?}
        CONFIRM_DELETE -->|Yes| DELETE_API[DELETE /api/ai/study-plan/timetables/id]
        DELETE_API --> VERIFY_OWNER[Backend: verify userId matches]
        VERIFY_OWNER --> REMOVE_DOC[Delete from Firestore]
        REMOVE_DOC --> REFRESH
    end

    subgraph Feed to Daily Guide
        STORE --> DAILY_GUIDE_READ[Daily Guide endpoint reads ALL saved timetables]
        DAILY_GUIDE_READ --> BUILD_CONTEXT[Build timetable context for GAG prompt]
        BUILD_CONTEXT --> SCHEDULE_RULES["GAG scheduling rules: fit study in free gaps between classes"]
        SCHEDULE_RULES --> RECOMMENDATIONS[Study recommendations with suggested_time in AM/PM format]
    end

    subgraph Feed to Calendar and Planner
        STORE --> CALENDAR_READ[Calendar endpoint reads ALL saved timetables]
        CALENDAR_READ --> GENERATE_EVENTS[Generate recurring weekly events for the month]

        subgraph Event Generation
            GENERATE_EVENTS --> FOR_EACH_DAY[For each day in month range]
            FOR_EACH_DAY --> MATCH_WEEKDAY{Weekday matches timetable day?}
            MATCH_WEEKDAY -->|Yes| CREATE_CLASS_EVENT[Create class event with time + location + subject]
            MATCH_WEEKDAY -->|Yes| CREATE_STUDY_EVENT[Create study_time event with duration + reason]
            MATCH_WEEKDAY -->|No| SKIP[Skip date]
        end

        CREATE_CLASS_EVENT --> CALENDAR_DISPLAY[Display in calendar as green class dots]
        CREATE_STUDY_EVENT --> CALENDAR_DISPLAY2[Display in calendar as cyan study time dots]
    end

    subgraph Feed to SmartBuddy
        STORE --> COMPANION_READ[SmartBuddy _get_student_context reads timetables]
        COMPANION_READ --> COMPANION_CONTEXT[Include class schedule in student context for chat]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/study-guide/page.tsx` — Timetable tab UI
- `frontend-web/src/lib/api.ts` — aiStudyPlanApi: analyzeTimetable, uploadTimetablePdf, saveTimetable, listTimetables, deleteTimetable
- `frontend-mobile/lib/screens/ai_study_guide_screen.dart` — Mobile timetable UI
- `backend/app/routers/ai_study_plan.py` — Timetable analyze, upload, CRUD endpoints
- `backend/app/routers/progress.py` — Calendar endpoint injects timetable events
- `backend/app/routers/ai_companion.py` — _get_student_context includes timetables
- `backend/app/gag_service.py` — Timetable context in study plan prompt
