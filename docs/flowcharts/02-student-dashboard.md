# Student Dashboard Flow

## Overview
The student dashboard is the main landing page after login. It aggregates data from multiple API endpoints to display recent mind maps, enrolled courses, study activity stats, badges, and quick-access features.

## Flowchart

```mermaid
flowchart TD
    START([Student navigates to /student/dashboard]) --> AUTH_CHECK{Authenticated + role=student?}
    AUTH_CHECK -->|No| REDIRECT[Redirect to /login]
    AUTH_CHECK -->|Yes| MOUNT[Page mounts]

    MOUNT --> PARALLEL_LOAD[Load data in parallel]

    PARALLEL_LOAD --> LOAD_MAPS[GET /api/maps/ - Recent mind maps]
    PARALLEL_LOAD --> LOAD_COURSES[GET /api/courses/enrolled - Enrolled courses]
    PARALLEL_LOAD --> LOAD_STATS[GET /api/stats/study-activity - Study activity chart]
    PARALLEL_LOAD --> LOAD_MONTHLY[GET /api/stats/monthly-comparison - Month vs month]
    PARALLEL_LOAD --> LOAD_PROGRESS[GET /api/progress/courses - Course completion %]
    PARALLEL_LOAD --> LOAD_NOTIFS[GET /api/notifications/ - Unread notifications]
    PARALLEL_LOAD --> LOAD_PROFILE[GET /api/auth/me - User profile, points, streak, badges]

    LOAD_MAPS --> RENDER
    LOAD_COURSES --> RENDER
    LOAD_STATS --> RENDER
    LOAD_MONTHLY --> RENDER
    LOAD_PROGRESS --> RENDER
    LOAD_NOTIFS --> RENDER
    LOAD_PROFILE --> RENDER

    RENDER[Render Dashboard Sections]

    subgraph Dashboard Sections
        RENDER --> GREETING[Greeting banner with name + streak]
        RENDER --> QUICK_STATS[Quick stats: maps, courses, points, streak]
        RENDER --> RECENT_MAPS[Recent mind maps grid with thumbnails]
        RENDER --> COURSE_CARDS[Enrolled courses with progress bars]
        RENDER --> ACTIVITY_CHART[Study activity bar chart - past 7 days]
        RENDER --> MONTHLY_COMP[Monthly comparison - assignments, quizzes, maps]
        RENDER --> BADGE_SHELF[Badge display with earned badges]
        RENDER --> UPCOMING[Upcoming deadlines from calendar events]
    end

    subgraph User Actions
        RECENT_MAPS -->|Click map| OPEN_MAP[Navigate to /student/create-map?id=mapId]
        COURSE_CARDS -->|Click course| OPEN_COURSE[Navigate to /student/course/cid]
        BADGE_SHELF -->|Click badge| BADGE_DETAIL[Show badge detail modal]
        UPCOMING -->|Click event| NAV_EVENT[Navigate to relevant page]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/dashboard/page.tsx` — Main dashboard page
- `frontend-web/src/lib/api.ts` — mapsApi, coursesApi, statsApi, progressApi, notificationsApi
- `frontend-mobile/lib/screens/home_screen.dart` — Mobile dashboard
- `backend/app/routers/stats.py` — Study activity statistics
- `backend/app/routers/progress.py` — Course completion progress
