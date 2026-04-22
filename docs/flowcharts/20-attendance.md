# Attendance Flow

## Overview
Session-based attendance tracking. Lecturers create attendance sessions, students check in, and attendance records are maintained per session. Supports bulk recording and student attendance history.

## Flowchart

```mermaid
flowchart TD
    subgraph Lecturer Creates Session
        L_START([Lecturer opens course attendance]) --> L_LIST[GET /api/attendance/course/cid - List sessions]
        L_LIST --> L_DISPLAY[Display existing sessions with dates]

        L_DISPLAY --> L_CREATE[Click Create New Session]
        L_CREATE --> L_FORM[Enter: date, title/label]
        L_FORM --> L_SAVE[POST /api/attendance/course/cid]

        subgraph Backend - Create Session
            L_SAVE --> CREATE_DOC[Create attendance doc: courseId, date, title, createdAt]
            CREATE_DOC --> INIT_RECORDS[Initialize attendanceRecords for enrolled students]
            INIT_RECORDS --> SET_DEFAULT[Default status: absent for all students]
        end

        SET_DEFAULT --> L_SESSION[Session created, ready for recording]
    end

    subgraph Lecturer Records Attendance
        L_SESSION --> L_OPEN[Open session detail]
        L_OPEN --> L_STUDENTS[Display student list with status toggles]
        L_STUDENTS --> L_MARK{Mark each student}
        L_MARK -->|Present| STATUS_PRESENT[Set status: present]
        L_MARK -->|Absent| STATUS_ABSENT[Set status: absent]
        L_MARK -->|Late| STATUS_LATE[Set status: late]
        L_MARK -->|Excused| STATUS_EXCUSED[Set status: excused]

        STATUS_PRESENT --> L_SAVE_RECORD[PATCH /api/attendance/session/sid/record]
        STATUS_ABSENT --> L_SAVE_RECORD
        STATUS_LATE --> L_SAVE_RECORD
        STATUS_EXCUSED --> L_SAVE_RECORD

        L_SAVE_RECORD --> UPDATE_RECORD[Update attendanceRecord: sessionId, studentId, status]

        L_STUDENTS --> BULK_UPDATE[Bulk update: mark all present/absent]
        BULK_UPDATE --> BULK_API[PATCH /api/attendance/session/sid/bulk]
        BULK_API --> UPDATE_ALL[Update all records at once]
    end

    subgraph Student Check-In
        S_START([Student opens attendance page]) --> S_HISTORY[GET /api/attendance/student/my - Attendance summary]
        S_HISTORY --> S_DISPLAY[Display attendance per course: present/total counts]

        S_START --> S_CHECKIN[Navigate to check-in page]
        S_CHECKIN --> S_ACTIVE[Show active sessions for today]
        S_ACTIVE --> S_SELECT[Select session to check in]
        S_SELECT --> S_CONFIRM[Confirm check-in]
        S_CONFIRM --> S_RECORD[Backend marks student as present]
    end

    subgraph Student Attendance View
        S_DISPLAY --> S_COURSE_SELECT[Select course]
        S_COURSE_SELECT --> S_COURSE_SESSIONS[Show all sessions for course]
        S_COURSE_SESSIONS --> S_SESSION_CARD[Each session: date, title, status badge]

        subgraph Status Badges
            S_SESSION_CARD --> BADGE_PRESENT[Green: Present]
            S_SESSION_CARD --> BADGE_ABSENT[Red: Absent]
            S_SESSION_CARD --> BADGE_LATE[Amber: Late]
            S_SESSION_CARD --> BADGE_EXCUSED[Blue: Excused]
        end

        S_DISPLAY --> S_STATS[Attendance statistics per course]
        S_STATS --> S_PERCENTAGE[Attendance percentage]
        S_STATS --> S_STREAK[Consecutive present streak]
    end

    subgraph Lecturer Session Management
        L_LIST --> L_DELETE[Delete session button]
        L_DELETE --> DELETE_CONFIRM{Confirm delete?}
        DELETE_CONFIRM -->|Yes| DELETE_SESSION[DELETE /api/attendance/session/sid]
        DELETE_SESSION --> DELETE_RECORDS[Also delete all attendanceRecords for session]
        DELETE_RECORDS --> REFRESH[Refresh session list]
    end

    subgraph Lecturer Analytics
        L_LIST --> L_ANALYTICS[View attendance analytics]
        L_ANALYTICS --> COURSE_RATE[Overall course attendance rate]
        COURSE_RATE --> PER_STUDENT[Per-student attendance summary]
        PER_STUDENT --> TREND[Attendance trend over time]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/attendance/page.tsx` — Student attendance view
- `frontend-web/src/app/(dashboard)/student/attendance/check-in/page.tsx` — Student check-in
- `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/attendance/page.tsx` — Lecturer attendance
- `frontend-web/src/lib/api.ts` — attendanceApi namespace
- `frontend-mobile/lib/screens/attendance_screen.dart` — Mobile attendance
- `backend/app/routers/attendance.py` — Session CRUD, record marking, student summary
