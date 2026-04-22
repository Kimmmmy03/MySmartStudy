# Lecturer Dashboard Flow

## Overview
The lecturer dashboard provides an overview of teaching activities, class analytics, recent submissions, and management shortcuts.

## Flowchart

```mermaid
flowchart TD
    START([Lecturer navigates to /lecturer/dashboard]) --> AUTH{Authenticated + role=lecturer?}
    AUTH -->|No| REDIRECT[Redirect to /login]
    AUTH -->|Yes| MOUNT[Page mounts]

    MOUNT --> PARALLEL[Load data in parallel]

    PARALLEL --> LOAD_COURSES[GET /api/courses/teaching - Teaching courses]
    PARALLEL --> LOAD_ANALYTICS[GET /api/analytics/ - Summary analytics]
    PARALLEL --> LOAD_NOTIFS[GET /api/notifications/ - Notifications]
    PARALLEL --> LOAD_PROFILE[GET /api/auth/me - Profile]

    LOAD_COURSES --> PROCESS_COURSES[For each course]
    PROCESS_COURSES --> LOAD_SUBS[GET /api/assignments/ - Recent submissions per course]
    PROCESS_COURSES --> LOAD_STUDENTS[GET /api/courses/cid/students - Enrollment counts]

    LOAD_ANALYTICS --> RENDER
    LOAD_SUBS --> RENDER
    LOAD_STUDENTS --> RENDER
    LOAD_NOTIFS --> RENDER
    LOAD_PROFILE --> RENDER

    RENDER[Render Dashboard]

    subgraph Dashboard Sections
        RENDER --> STATS_ROW[Stats: total students, courses, assignments, avg grade]
        RENDER --> COURSE_LIST[Teaching courses with enrollment counts]
        RENDER --> RECENT_SUBS[Recent ungraded submissions]
        RENDER --> ANALYTICS_CHARTS[Submission rate, grade distribution charts]
        RENDER --> QUICK_ACTIONS[Quick actions: create course, create assignment, review maps]
    end

    subgraph Lecturer Actions
        COURSE_LIST -->|Click course| COURSE_PAGE[Navigate to /lecturer/course/cid]
        RECENT_SUBS -->|Click submission| GRADE_PAGE[Navigate to grading view]
        QUICK_ACTIONS -->|Create course| NEW_COURSE[Navigate to class-management]
        QUICK_ACTIONS -->|Review maps| REVIEW[Navigate to /lecturer/review-maps]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/lecturer/dashboard/page.tsx` — Lecturer dashboard
- `frontend-web/src/lib/api.ts` — coursesApi.teaching, analyticsApi
- `frontend-mobile/lib/screens/home_screen.dart` — Mobile home (role-aware)
- `backend/app/routers/analytics.py` — Analytics aggregation
- `backend/app/routers/courses.py` — Teaching courses endpoint
