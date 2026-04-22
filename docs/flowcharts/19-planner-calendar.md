# Planner & Calendar Flow

## Overview
Unified calendar aggregating assignment deadlines, quiz deadlines, personal reminders/tasks, class events from saved timetables, and recommended study time slots. Task management with priority levels and completion tracking.

## Flowchart

```mermaid
flowchart TD
    START([Student opens /student/planner]) --> MOUNT[Page mounts]

    subgraph Load Calendar Events
        MOUNT --> GET_MONTH[Determine current month - YYYY-MM]
        GET_MONTH --> API_CALENDAR[GET /api/progress/calendar?month=YYYY-MM]

        subgraph Backend - Aggregate Events
            API_CALENDAR --> LOAD_COURSES[Get enrolled courses for student]

            LOAD_COURSES --> LOAD_ASSIGNMENTS[Query assignments for enrolled courses]
            LOAD_ASSIGNMENTS --> FILTER_ASSIGN[Filter by deadline in month range]
            FILTER_ASSIGN --> CREATE_ASSIGN_EVENTS[Create assignment events: title, date, type=assignment, course_name]

            LOAD_COURSES --> LOAD_QUIZZES[Query quizzes for enrolled courses]
            LOAD_QUIZZES --> FILTER_QUIZ[Filter by deadline in month range]
            FILTER_QUIZ --> CREATE_QUIZ_EVENTS[Create quiz events: title, date, type=quiz, course_name]

            MOUNT --> LOAD_REMINDERS_CAL[Query reminders for student in month]
            LOAD_REMINDERS_CAL --> CREATE_REMINDER_EVENTS[Create reminder events: title, date, type=reminder, is_completed]

            MOUNT --> LOAD_TIMETABLES[Query savedTimetables for student]
            LOAD_TIMETABLES --> GENERATE_CLASS_EVENTS[For each weekday match in month range]

            subgraph Timetable Event Generation
                GENERATE_CLASS_EVENTS --> FOR_EACH_TT[For each saved timetable]
                FOR_EACH_TT --> FOR_EACH_DAY[For each day entry in parsed_schedule]
                FOR_EACH_DAY --> FIND_DATES[Find all dates in month matching weekday]
                FIND_DATES --> CREATE_CLASS[Create class event: subject, time, location, type=class]
                FOR_EACH_TT --> FOR_EACH_STUDY[For each recommended_study_time]
                FOR_EACH_STUDY --> FIND_STUDY_DATES[Find matching weekday dates]
                FIND_STUDY_DATES --> CREATE_STUDY[Create study_time event: title, time, duration, type=study_time]
            end

            CREATE_ASSIGN_EVENTS --> MERGE_ALL[Merge all events]
            CREATE_QUIZ_EVENTS --> MERGE_ALL
            CREATE_REMINDER_EVENTS --> MERGE_ALL
            CREATE_CLASS --> MERGE_ALL
            CREATE_STUDY --> MERGE_ALL

            MERGE_ALL --> SORT_EVENTS[Sort by date then by time]
        end

        SORT_EVENTS --> RETURN_EVENTS[Return CalendarEventOut array]
    end

    subgraph Display Calendar Grid
        RETURN_EVENTS --> RENDER_CALENDAR[Render month calendar grid]
        RENDER_CALENDAR --> DATE_DOTS[Show colored dots on dates with events]

        subgraph Event Type Colors
            DATE_DOTS --> DOT_ASSIGN[Blue dot = assignment]
            DATE_DOTS --> DOT_QUIZ[Purple dot = quiz]
            DATE_DOTS --> DOT_REMIND[Amber dot = reminder]
            DATE_DOTS --> DOT_CLASS[Green dot = class]
            DATE_DOTS --> DOT_STUDY[Cyan dot = study time]
        end

        RENDER_CALENDAR --> SELECT_DATE[Student clicks a date]
        SELECT_DATE --> FILTER_DATE[Filter events for selected date]
        FILTER_DATE --> SHOW_EVENTS[Display event cards for selected date]

        subgraph Event Card Display
            SHOW_EVENTS --> CARD_ICON[Event type icon]
            CARD_ICON --> CARD_TITLE[Event title]
            CARD_TITLE --> CARD_TIME[Time slot if available - AM/PM]
            CARD_TIME --> CARD_LOCATION[Location if available - class events]
            CARD_LOCATION --> CARD_COURSE[Course name]
            CARD_COURSE --> CARD_BADGE[Type badge: assignment / quiz / class / study time]
            CARD_BADGE --> CARD_STATUS{Completed?}
            CARD_STATUS -->|Yes| SHOW_CHECK[Show green checkmark]
        end
    end

    subgraph Upcoming Events Sidebar
        RETURN_EVENTS --> FILTER_UPCOMING[Filter events after today, limit 10]
        FILTER_UPCOMING --> SORT_UPCOMING[Sort chronologically]
        SORT_UPCOMING --> RENDER_UPCOMING[Render upcoming events list]
        RENDER_UPCOMING --> UP_ITEM[Each item: dot color + title + time + date]
    end

    subgraph Task Management - Reminders
        MOUNT --> LOAD_TASKS[GET /api/reminders/?date=YYYY-MM-DD]
        LOAD_TASKS --> SHOW_TASKS[Display tasks for selected date]

        SHOW_TASKS --> ADD_TASK[Click Add Task]
        ADD_TASK --> TASK_FORM[Fill: title, type, priority, date]

        subgraph Task Types and Priorities
            TASK_FORM --> TASK_TYPE{Type?}
            TASK_TYPE --> TYPE_STUDY[study]
            TASK_TYPE --> TYPE_ASSIGNMENT[assignment]
            TASK_TYPE --> TYPE_EXAM[exam]
            TASK_TYPE --> TYPE_PERSONAL[personal]

            TASK_FORM --> TASK_PRIO{Priority?}
            TASK_PRIO --> PRIO_HIGH[high - red]
            TASK_PRIO --> PRIO_MED[medium - amber]
            TASK_PRIO --> PRIO_LOW[low - green]
        end

        TASK_FORM --> SAVE_TASK[POST /api/reminders/]
        SAVE_TASK --> REFRESH_TASKS[Refresh task list]

        SHOW_TASKS --> TOGGLE_DONE[Toggle task completion]
        TOGGLE_DONE --> UPDATE_TASK[PATCH /api/reminders/rid with isCompleted]
        UPDATE_TASK --> REFRESH_TASKS

        SHOW_TASKS --> DELETE_TASK[Delete task]
        DELETE_TASK --> DELETE_API[DELETE /api/reminders/rid]
        DELETE_API --> REFRESH_TASKS
    end

    subgraph Month Navigation
        RENDER_CALENDAR --> PREV_MONTH[Click previous month arrow]
        PREV_MONTH --> RECALC[Recalculate month, refetch events]
        RENDER_CALENDAR --> NEXT_MONTH[Click next month arrow]
        NEXT_MONTH --> RECALC
        RECALC --> API_CALENDAR
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/planner/page.tsx` — Student planner page
- `frontend-web/src/app/(dashboard)/student/calendar/page.tsx` — Redirect to planner
- `frontend-web/src/lib/api.ts` — progressApi.calendar(), remindersApi
- `frontend-mobile/lib/screens/calendar_screen.dart` — Mobile calendar
- `frontend-mobile/lib/screens/tasks_screen.dart` — Mobile task/planner
- `backend/app/routers/progress.py` — GET /api/progress/calendar with timetable injection
- `backend/app/routers/reminders.py` — Reminder CRUD
