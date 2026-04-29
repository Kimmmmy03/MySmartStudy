# MySmartStudy

> **An AI-Enhanced Collaborative Learning Management System with Mind Map Integration**
> Final Year Project (FYP) developed at **Universiti Kuala Lumpur Malaysian Institute of Information Technology (UniKL MIIT)** for the client **IPG Kampus Perempuan Melayu Melaka**.

A full-stack, AI-enhanced LMS (Learning Management System) built for the client IPG Kampus Perempuan Melayu Melaka — students and lecturers there are the target users. Provides feature-complete course management, real-time collaborative mind mapping, AI study companion (Google Gemini 2.5 Flash + RAG pipeline), gamification with automated badge engine, quizzes, grading rubrics, peer reviews, discussion forums, attendance tracking, certificates, private messaging, a student-only social graph (follow / feed / explore / map likes & comments), group tasks with auto-assigned subgroups, lecturer Course Learning Plan (CLP) generator, admin broadcast email announcements with per-user AI token quotas, and a dark/light glassmorphism UI across web and mobile platforms (mobile admin console included) with bilingual support (English/Bahasa Melayu). AI token usage is optimised through multi-tier caching, per-user/global token caps, and nightly RAG batch re-indexing.

## Project Context (Academic Overview)

**Project Title:** MySmartStudy — An AI-Enhanced Collaborative Learning Management System with Mind Map Integration
**Developed at:** Universiti Kuala Lumpur Malaysian Institute of Information Technology (UniKL MIIT)
**Client:** IPG Kampus Perempuan Melayu Melaka (the target deployment institution — its students and lecturers are the end users)
**Type:** Final Year Project (FYP)
**Date:** April 2026

### Problem Statement

Traditional LMS platforms (Moodle, Google Classroom) deliver content and accept submissions but lack: (1) collaborative visual learning tools — mind maps and concept diagrams are not native, (2) AI personalisation — no adaptive study planning, learning style detection, or AI study companion, (3) gamification depth beyond grades, (4) real-time co-editing of student work, (5) integrated plagiarism / grading intelligence (assessment support tools are absent or require third-party systems), and (6) cross-platform offline capability with responsive mobile support. MySmartStudy addresses all six gaps in a single coherent platform tailored for Malaysian teacher education institutions.

### Objectives

1. Full-stack LMS with role-based dashboards for student / lecturer / admin
2. Real-time collaborative mind map editor with annotation, export, AI node suggestions
3. Google Gemini 2.5 Flash integration for study assistance, study material generation, plagiarism detection, and grading support
4. RAG pipeline (ChromaDB + Gemini embeddings) with a knowledge graph for context-aware recommendations
5. Automated badge engine with 9 criteria for sustained engagement
6. Cross-platform access — Next.js web + Flutter mobile (Android/iOS)
7. Bilingual mobile UI (English / Bahasa Melayu)
8. Advanced course management — quizzes, rubrics, peer reviews, attendance, certificates, gradebook
9. Student-only social graph (follow / feed / explore / map likes & comments)
10. Lecturer-facing automation — Course Learning Plan (CLP) Excel generator from PDF syllabi
11. Admin governance — broadcast email announcements, per-user AI token quotas, badge catalog editor

### Limitations & Future Work

**Current limitations:** last-write-wins conflict resolution on collaborative maps may lose data under simultaneous high-frequency edits; single-region Firestore (no multi-region replication); Gemini rate limits + 1/user/day image quota; no native video conferencing (Meet etc. used externally); Flutter app needs connectivity for most operations.

**Proposed future work:** OT or CRDT for conflict-free collaborative editing; WebRTC for synchronous classrooms; LTI 1.3 compliance to embed in institutional Moodle; adaptive assessment engine (dynamic quiz difficulty); additional Malaysian languages (Tamil, Mandarin); native offline mode on Flutter with SQLite sync queue; xAPI / Tin Can statement generation; parent / guardian portal.

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│  ┌──────────────────────────────┐   ┌─────────────────────────────────┐     │
│  │  Next.js 16 Web App          │   │  Flutter Mobile App             │     │
│  │  TypeScript · Tailwind v4    │   │  Dart · Material Design 3       │     │
│  │  React Flow · Framer Motion  │   │  ~61 screens · Bilingual EN/BM  │     │
│  └──────────────┬───────────────┘   └─────────────────┬───────────────┘     │
└─────────────────┼─────────────────────────────────────┼─────────────────────┘
                  │       HTTPS + Bearer Firebase ID token
                  └─────────────────────┬───────────────┘
                                        │       (Firebase Auth login is direct from clients)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       API LAYER — FastAPI (Python)                          │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  40 mounted routers                                                  │   │
│  │  auth · users · courses · maps · assignments · quizzes · gradebook   │   │
│  │  rubrics · peer_review · discussions · forum · resources · attendance│   │
│  │  certificates · groups · group_tasks · social · admin · clp · …      │   │
│  │  9× ai_*  (companion · study_plan · materials · grading · plagiarism │   │
│  │            · mindmap_buddy · images · import · rag_admin)            │   │
│  └────────┬─────────────────────────────────────────────────┬───────────┘   │
│           │                                                 │               │
│  ┌────────▼─────────────────────────┐   ┌──────────────────▼──────────┐     │
│  │  Services                        │   │  APScheduler                │     │
│  │  email_service · canva_service   │   │  2 AM — RAG re-index        │     │
│  │  clp/ · storage · multi_agent    │   │  3 AM — Knowledge graph     │     │
│  │  rag_multistep                   │   │         rebuild              │     │
│  └────────┬─────────────────────────┘   └──────┬──────────────────────┘     │
└───────────┼────────────────────────────────────┼────────────────────────────┘
            │                                    │
   ┌────────┴────────┬──────────┬─────────┬────┴────────┐
   ▼                 ▼          ▼         ▼             ▼
┌─────────┐   ┌────────────┐ ┌─────┐ ┌──────────┐ ┌────────────┐
│ PERSIST │   │ EXTERNAL   │ │ FCM │ │ Firebase │ │ ChromaDB   │
├─────────┤   │ CLOUD      │ │push │ │ Storage  │ │ per-course │
│Firestore│   ├────────────┤ │     │ │AI images │ │ vector DB  │
│ 60+ cols│   │Firebase    │ └─────┘ └──────────┘ └────────────┘
│         │   │ Auth (JWT) │
│GCS bkt /│   │Gemini API  │
│local    │   │  2.5 Flash │
│uploads/ │   │  2.0 Image │
│         │   │  embed-004 │
│         │   │SMTP server │
└─────────┘   └────────────┘
```

### Authentication Sequence

```
  User       Client            Firebase Auth      FastAPI            Firestore
   │           │                    │                │                   │
   │ email +   │                    │                │                   │
   │ password  │                    │                │                   │
   │──────────▶│                    │                │                   │
   │           │ signInWith…()      │                │                   │
   │           │───────────────────▶│                │                   │
   │           │   ID token (JWT)   │                │                   │
   │           │◀───────────────────│                │                   │
   │           │ store in           │                │                   │
   │           │ localStorage /     │                │                   │
   │           │ SecureStorage      │                │                   │
   │           │                    │                │                   │
   │           │ GET /api/auth/me                   │                   │
   │           │ Authorization: Bearer <id_token>   │                   │
   │           │───────────────────────────────────▶│                   │
   │           │                    │ verify_id_token(token) Admin SDK │
   │           │                    │◀───────────────│                   │
   │           │                    │ decoded claims │                   │
   │           │                    │  (uid, email)  │                   │
   │           │                    │───────────────▶│                   │
   │           │                    │                │ get user doc      │
   │           │                    │                │──────────────────▶│
   │           │                    │                │ [if missing →     │
   │           │                    │                │  create default,  │
   │           │                    │                │  role=student]    │
   │           │                    │                │ profile (role,    │
   │           │                    │                │  badges, prefs)   │
   │           │                    │                │◀──────────────────│
   │           │ UserOut JSON (role-aware)          │                   │
   │           │◀───────────────────────────────────│                   │
   │           │ hydrate AuthProvider,              │                   │
   │           │ route by role                      │                   │
   │◀──────────│                                    │                   │
```

| Layer | Technology | Directory |
|-------|-----------|-----------|
| **Web Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 | `frontend-web/` |
| **Mobile Frontend** | Flutter (Dart), Firebase SDK, Material Design 3 | `frontend-mobile/` |
| **Backend API** | FastAPI (Python), Firebase Admin SDK | `backend/` |
| **AI Engine** | Gemini 2.5 Flash (all tasks — SMART_MODEL + FAST_MODEL) | Cloud |
| **Image Generation** | Gemini 2.0 Flash Image / Imagen 3 → Firebase Storage | Cloud |
| **Vector Store** | ChromaDB (persistent, on-disk) | `backend/vector_store/` |
| **Embeddings** | Gemini `text-embedding-004` | Cloud |
| **Database** | Firebase Firestore (NoSQL) | Cloud |
| **File Storage** | Firebase Storage (AI images) + Google Cloud Storage (admin/homepage uploads in prod via `GCS_BUCKET`) + local disk (dev fallback) | Cloud / `uploads/` |
| **Email** | SMTP (transactional notifications + admin broadcasts) — fire-and-forget threaded sends, gracefully no-ops if unconfigured | `app/services/email_service.py` |
| **Auth** | Firebase Authentication (email/password) | Cloud |

### How It Works

1. **Firebase Auth** handles user registration and login on all platforms
2. The **FastAPI backend** (40 mounted routers across 41 router files) verifies Firebase ID tokens and serves a REST API
3. **Google Gemini** powers AI features using **Gemini 2.5 Flash** for both SMART_MODEL (companion chat, grading, plagiarism, mindmap buddy) and FAST_MODEL (study materials, timetable parsing, course import, exam plans). All features are enhanced with **RAG** (Retrieval-Augmented Generation via ChromaDB), **GAG** for structured artifacts, and **multi-tier Firestore caching** to avoid redundant API calls
4. **AI image generation** uses Gemini 2.0 Flash Preview Image Generation (with Imagen 3 fallback) and stores images in **Firebase Storage** for cloud persistence, with a 1-image/day quota and 7-day prompt deduplication
5. The **Next.js web app** calls the backend API with Bearer token headers
6. The **Flutter mobile app** (46 screens) calls the same FastAPI backend via HTTP with Firebase ID tokens, sharing the same data layer
7. Both frontends support **dark/light theme** toggling with animated transitions, persisted per user
8. The mobile app supports **bilingual UI** (English / Bahasa Melayu) with a first-time tutorial overlay

### AI Token Optimisation

The system uses several strategies to minimise Gemini API token consumption:

| Strategy | Detail |
|---|---|
| **Model routing** | `gemini-2.5-flash` for all tasks — both SMART_MODEL and FAST_MODEL now use the same model (previously FAST used gemini-2.0-flash, now deprecated) |
| **Multi-tier Firestore cache** | 10+ cache collections with TTLs ranging from 1 day (daily guide) to permanent (grading, plagiarism) |
| **Global question dedup** | Non-course-specific companion questions cached 7 days and shared across all users |
| **Elaboration cache** | Image prompt elaboration results cached 30 days — retries don't re-call Gemini |
| **Reduced RAG context** | Companion retrieves 3 chunks (not 5); each chunk capped at 2,000 chars |
| **Trimmed chat history** | Companion history window: 12 messages loaded, 15 stored (was 20/50) |
| **Condensed system prompts** | `study_companion` and `rag_companion` prompts reduced ~65% in token length |
| **Nightly RAG indexing** | Course re-embedding runs once at 2 AM UTC to minimise API usage |
| **7-day image dedup** | Same prompt+style reuses the cached image without consuming quota or API credits |

---

## Project Structure

```
MySmartStudy/
  backend/
    app/
      routers/                 # 41 router files (40 mounted; auto_badges.py = helper only)
        auth.py                # Firebase token verification + user sync
        users.py               # Profile + avatar + cover photo upload
        maps.py                # Mind map CRUD + collaboration + presence + annotations + view tracking + history
        courses.py             # Course CRUD + enrollment + student search + recently-viewed
        assignments.py         # Assignment CRUD + conditional access
        quizzes.py             # Quiz CRUD + auto-grading + attempts
        gradebook.py           # Weighted gradebook + student reports + CSV export
        rubrics.py             # Grading rubrics + rubric-based grading
        peer_review.py         # Peer review submissions
        discussions.py         # Real-time class chat + threaded replies
        discussion_topics.py   # Topic-based forum with pinning
        announcements.py       # Course announcements
        resources.py           # Resource modules + file uploads + progress tracking
        attendance.py          # Session-based attendance tracking
        certificates.py        # Course completion certificates
        groups.py              # Student groups + auto-assign
        group_tasks.py         # Per-course group-task containers with auto-assigned subgroups
        completion.py          # Course completion tracking + analytics
        auto_badges.py         # Automatic badge engine (helper functions, no endpoints)
        badges.py              # Manual badge award/revoke
        messaging.py           # Private messaging + conversations
        notifications.py       # In-app notifications + FCM tokens + grouped feed
        activity.py            # Activity feed + reflections
        analytics.py           # Lecturer analytics dashboard
        progress.py            # Course progress + calendar events
        reminders.py           # Personal planner tasks
        participation.py       # Participation scoring
        social.py              # Followers, feed, explore, suggested, map likes & comments (students only)
        admin.py               # User mgmt + audit logs + homepage CMS + AI usage/quotas + broadcast announcements (SMTP)
        stats.py               # Study activity + monthly comparison
        ai_companion.py        # AI study companion chat + learning profile
        ai_study_plan.py       # AI daily guide + exam planner + timetable analysis
        ai_study_materials.py  # AI-generated summaries, flashcards, practice quizzes
        ai_plagiarism.py       # AI plagiarism detection for submissions + assignment-wide network analysis
        ai_grading.py          # AI grade recommendations for lecturers
        ai_images.py           # AI educational image generation — Firebase Storage, 1/day quota, prompt dedup + history
        ai_import.py           # AI content import helpers
        ai_mindmap_buddy.py    # AI mind map buddy — RAG + knowledge graph node suggestions
        rag_admin.py           # RAG indexing triggers + status
        clp.py                 # Course Learning Plan — PDF upload → AI parse → Excel generation
        site_import.py         # Google Site / external LMS preview + execute + course KB
      services/
        email_service.py       # SMTP transactional emails (broadcast + notifications) — fire-and-forget threads, no-op without SMTP env vars
        canva_service.py       # Canva integration helper
        clp/
          parser.py            # PDF syllabus → structured weeks
          gemini_service.py    # Gemini-powered topic extraction
          excel_generator.py   # Build downloadable .xlsx
          storage.py           # CLP draft persistence
          config.py            # CLP feature config
      auth.py                  # Firebase token verification
      firestore.py             # Firebase Admin SDK init + Firestore client
      storage.py               # Unified upload helper — GCS bucket in prod (GCS_BUCKET), local uploads/ in dev
      models.py                # Collection constants, helpers
      schemas.py               # Pydantic request/response schemas
      audit.py                 # Audit logging helper
      ai_service.py            # Google Gemini configuration + initialization
      rag_service.py           # ChromaDB vector store, embedding, chunking, retrieval (RAG)
      rag_multistep.py         # Multi-step retrieval — cross-encoder rerank, query decomposition, HyDE
      gag_service.py           # Generation-Augmented Generation — structured artifact output
      knowledge_graph_service.py # Course concept graphs, BFS traversal, similarity graphs
      multi_agent.py           # Fan-out / fan-in helper for parallel agents (asyncio.gather + per-agent error isolation)
      gamification.py          # Badge logic + milestone triggers
      file_validation.py       # Magic number validation for file uploads
      similarity.py            # Text similarity detection for plagiarism
      scheduler.py             # Background task scheduler (APScheduler) — nightly RAG indexing 2 AM, KG rebuild 3 AM
      site_importer/           # Google Site importer internals
      site_importer_learning/  # ML-assisted importer variants
    main.py                    # FastAPI app entry point — mounts 40 routers + public homepage endpoints
    seed.py                    # Seed test accounts
    requirements.txt
    serviceAccountKey.json     # Firebase Admin credentials (not committed)

  frontend-web/
    src/
      app/
        icon.png               # App Router favicon (IPG logo on white circle, auto-served at /icon.png)
        (auth)/                # Login, Register, Forgot Password, Logout
        (dashboard)/
          student/             # 21 student pages
            dashboard/         # Activity heatmap, upcoming deadlines, stats
            my-maps/           # Mind map gallery with search
            create-map/        # React Flow map editor
            courses/           # Enrolled courses list
            course/[cid]/      # Course detail + tools (assignments, quizzes, discussions, forum, resources, peer-reviews, announcements, groups)
            gradebook/         # Unified gradebook across courses
            grades/            # Per-course grades
            messages/          # Private messaging
            notifications/     # Notification center
            calendar/          # Calendar view with events
            attendance/        # Attendance records per course (with QR/code check-in)
            activity/          # Activity log timeline
            certificates/      # Earned certificates + claim
            planner/           # Personal task planner
            achievements/      # Badge showcase (auto-awarded badges)
            study-guide/       # AI daily study recommendations
            study-materials/   # AI-generated study materials library
            exam-planner/      # AI exam study plan generator
            feed/              # Social feed — public maps from people you follow
            explore/           # Trending maps + suggested users
            profile/           # Profile editor + avatar + cover photo
          lecturer/            # 12 lecturer pages
            dashboard/         # Analytics overview
            class-management/  # Course list + create
            course/[cid]/      # Course detail + tools (assignments, quizzes, gradebook, discussions, forum, announcements, resources, attendance, groups, completion, plagiarism)
            review-maps/       # Review student mind maps
            view-map/[id]/     # Annotate maps
            analytics/         # Engagement heatmap, at-risk students
            manage-badges/     # Award/revoke badges
            learning-plan/     # Course Learning Plan (CLP) wizard — upload syllabus PDF → configure → generate Excel
            messages/          # Private messaging
            notifications/     # Notification center
            planner/           # Personal planner
            profile/           # Profile editor
          admin/               # 8 admin pages
            dashboard/         # Admin overview
            users/             # User management + role changes
            homepage-editor/   # CMS for landing page
            audit-logs/        # System audit trail
            announcements/     # Broadcast email composer (audience: all/students/lecturers/specific) → SMTP fanout
            ai-usage/          # Per-user/feature token consumption + global + per-user token caps + image quotas
            usage-analytics/   # Top users, time-on-app, feature visit stats, monthly comparisons
            manage-badges/     # Admin badge catalog editor (definitions, criteria, icons)
      components/              # Shared UI components
        ui/                    # Modal, LoadingSpinner, AnimatedBg
        map-editor/            # React Flow mind map editor
        ai-import-modal.tsx     # AI content import dialog
        fcm-provider.tsx       # Firebase Cloud Messaging push notification provider
        map-library-modal.tsx  # Mind map selection modal for submissions
        similarity-report.tsx  # Plagiarism similarity report viewer
        navbar.tsx             # Top navigation with theme toggle
        sidebar.tsx            # Side navigation with role-based links
      contexts/                # AuthProvider, ThemeProvider
      hooks/                   # useAuth hook
      lib/
        api.ts                 # Typed API client (40+ namespaces)
        firebase.ts            # Firebase client SDK init
        utils.ts               # Shared utilities
        export-map.ts          # PNG/PDF map export
      types/                   # TypeScript interfaces

  frontend-mobile/
    lib/
      models/                  # Dart model classes (announcement, app_user, assignment, discussion, mind_map, subject, subject_member, submission, task, user_profile)
      screens/                 # ~61 Flutter screen widgets
        main_shell.dart        # Tab navigation shell (5 tabs) + AI FAB overlay
        home_screen.dart       # Dashboard + shimmer loading + deadlines + today's tasks + tutorial
        welcome_screen.dart    # First-time welcome/onboarding screen
        login_screen.dart      # Login with Rive animation
        register_screen.dart   # Registration with role selection
        # ── Courses & subjects
        subjects_screen.dart   # Course list (student enrolled / lecturer teaching)
        subject_detail_screen.dart  # Course detail with tool cards
        subject_form_screen.dart    # Create/edit course form
        join_subject_screen.dart    # Join course by code
        lecturer_class_management_screen.dart # Lecturer class list + bulk actions
        # ── Assessments
        assignments_tab.dart, assignment_form_screen.dart, student_submit_screen.dart
        lecturer_submissions_screen.dart  # View + grade + AI plagiarism + AI grade suggest
        rubric_grading_screen.dart        # Per-criterion rubric grading
        quizzes_screen.dart, quiz_course_picker_screen.dart
        peer_reviews_screen.dart, completion_screen.dart, student_report_screen.dart
        # ── Course tools
        forum_screen.dart, gradebook_screen.dart, grades_screen.dart
        attendance_screen.dart, attendance_session_detail_screen.dart, attendance_checkin_screen.dart
        groups_screen.dart, group_task_detail_screen.dart
        announcements_screen.dart, announcement_form_screen.dart
        resources_screen.dart, discussion_chat_screen.dart
        plagiarism_screen.dart, plagiarism_report_screen.dart
        # ── Personal & social
        tasks_screen.dart, calendar_screen.dart, calendar_planner_screen.dart
        mind_maps_screen.dart, mind_map_viewer.dart
        notifications_screen.dart, messaging_screen.dart
        activity_screen.dart, certificates_screen.dart, achievements_screen.dart
        feed_screen.dart            # Social feed (followed users)
        explore_screen.dart         # Trending maps + suggested users
        public_profile_screen.dart  # Other student's public profile + their public maps
        # ── Lecturer
        review_maps_screen.dart, manage_badges_screen.dart, lecturer_analytics_screen.dart
        learning_plan_screen.dart   # CLP wizard (PDF → AI parse → Excel download)
        # ── Profile
        profile_screen.dart         # Profile editor + avatar + cover photo + theme toggle + language picker
        # ── AI
        ai_companion_screen.dart, ai_learning_style_screen.dart
        ai_study_guide_screen.dart, ai_exam_planner_screen.dart
        ai_study_materials_screen.dart, ai_flashcard_viewer.dart
        ai_summary_viewer.dart, ai_practice_quiz_screen.dart
        ai_image_generator_screen.dart  # AI image generation interface (1/day quota)
        # ── Admin (mobile admin console)
        admin/
          admin_dashboard_screen.dart      # Platform stats + quick links
          user_management_screen.dart      # List/search users + role changes
          audit_logs_screen.dart           # Audit trail with filters
          ai_usage_screen.dart             # Per-user/feature AI token usage
          badge_definitions_screen.dart    # Edit badge catalog
          homepage_editor_screen.dart      # CMS for landing page
      services/
        api_service.dart           # HTTP API client (~1,500 LOC, 200+ methods including all AI/social/CLP)
        auth_service.dart          # Firebase Auth wrapper + session lifecycle
        notification_service.dart  # FCM token registration + foreground notification handling
      widgets/                 # Shared widget components (avatar_widget, badge_chip, brain_icon, charts/, confirmation_dialog, empty_state, fade_slide_in, floating_nav_bar, follow_button, glass_app_bar, glass_bottom_sheet, glass_card, gradient_button, loading_overlay, map_thumbnail, mind_map_shapes, mindmap_buddy_sheet, participation_score_card, rive_nav_icon, search_bar_widget, section_header, shimmer_box, skeletons, stat_card, theme_switcher, tutorial_overlay, visibility_badge, weekly_reflection_modal, ai_companion_fab, animated_splash, app_background, app_drawer, app_logo, animated_list_item, open_container_wrapper)
      utils/
        app_theme.dart, app_colors.dart, app_theme_ext.dart
        app_constants.dart      # IPG department + class/unit dropdown options (mirrors frontend-web constants.ts)
        badge_utils.dart        # Badge display names + emojis
        locale_provider.dart    # Locale state (English/Malay)
        theme_provider.dart     # Theme state + persistence
        tutorial_prefs.dart, companion_prefs.dart
        auth_events.dart        # Cross-screen auth lifecycle event bus
      l10n/
        app_strings.dart        # Bilingual strings (English/Bahasa Melayu)

  start-backend.sh             # Start backend server only
  start-frontend-web.sh        # Start web frontend only
  start-frontend-mobile.sh     # Start Flutter mobile app only
  start-dev.sh                 # Start all servers together
  start-dev-mobile.sh          # Start all + USB device
  start-dev-mobile-wireless.sh # Start all + wireless device
```

---

## Features

### Student Features (32 features)

| # | Feature | Web | Mobile | Description |
|---|---------|:---:|:------:|-------------|
| 1 | **Dashboard** | Yes | Yes | Study activity heatmap, upcoming deadlines, course cards, stats, quick access row |
| 2 | **Mind Map Editor** | Yes | - | React Flow-based editor with custom nodes, shapes, templates, collaboration, PNG/PDF export |
| 3 | **Mind Map Viewer** | Yes | Yes | View mind map details, share codes |
| 4 | **Course Enrollment** | Yes | Yes | Browse and join courses via 6-character join code |
| 5 | **Assignments** | Yes | Yes | Submit via mind map, file upload, or external link; view grades and feedback |
| 6 | **Quizzes** | Yes | Yes | Timed quizzes with MCQ, True/False, Short Answer; auto-grading; result review |
| 7 | **Peer Reviews** | Yes | Yes | View peer reviews on classmates' submissions per assignment |
| 8 | **Gradebook** | Yes | Yes | Unified weighted grades across all courses, per-course grade view |
| 9 | **Discussion Forum** | Yes | Yes | Topic-based forum with threaded discussions, create topics, reply |
| 10 | **Class Chat** | Yes | Yes | Real-time messaging with 5s polling, role badges |
| 11 | **Resources** | Yes | Yes | Course materials with modules, progress tracking, map template cloning |
| 12 | **Attendance** | Yes | Yes | View attendance records with present/late/absent status per session |
| 13 | **Certificates** | Yes | Yes | Claim completion certificates when 100% progress, view earned certs |
| 14 | **Activity Log** | Yes | Yes | Timeline of all actions grouped by date with type icons |
| 15 | **Notifications** | Yes | Yes | In-app notifications with type badges, mark-read, mark-all-read |
| 16 | **Private Messaging** | Yes | Yes | Direct messages with any user, conversation list, user search |
| 17 | **Calendar** | Yes | Yes | Monthly calendar view with event dots, day filtering, assignments/quizzes/reminders |
| 18 | **Planner** | Yes | Yes | Personal task manager with priorities, types, date-based organization |
| 19 | **Achievements** | Yes | Yes | 12 auto-awarded badges (cartographer, quiz_whiz, helper, etc.) |
| 20 | **Profile** | Yes | Yes | Edit name, class, year, semester, department, avatar, theme toggle, language picker |
| 21 | **AI Study Companion** | Yes | Yes | Conversational AI chat for learning support, context-aware responses, persistent chat history |
| 22 | **AI Learning Profile** | Yes | Yes | Learning style assessment quiz, personalized strengths/weaknesses tracking |
| 23 | **AI Daily Study Guide** | Yes | Yes | Personalized daily study recommendations ranked by priority with estimated time |
| 24 | **AI Timetable Analysis** | Yes | Yes | Paste timetable text or upload PDF; AI identifies conflicts and suggests study slots |
| 25 | **AI Exam Planner** | Yes | Yes | Generate multi-day exam study plans with distributed sessions and review periods |
| 26 | **AI Study Materials** | Yes | Yes | Generate summaries, flashcards, and practice quizzes from course resources |
| 27 | **AI Flashcard Viewer** | Yes | Yes | Interactive flip-card viewer with navigation and shuffle for AI-generated flashcards |
| 28 | **AI Mind Map Buddy** | Yes | - | Context-aware AI assistant during map editing — suggests nodes, connections, and improvements in real-time |
| 29 | **AI Image Generator** | Yes | Yes | Generate educational diagrams/images via Gemini 2.0 Flash Image (Imagen 3 fallback) — 1/day quota, 7-day prompt dedup, history |
| 30 | **Social Feed** | Yes | Yes | Public mind maps from people you follow, newest first, with likes & comments |
| 31 | **Explore** | Yes | Yes | Trending public maps + suggested users to follow (students-only graph) |
| 32 | **Public Profile + Follow** | Yes | Yes | View other students' public profiles & maps, follow/unfollow, follower / following lists |

### Lecturer Features (17 features)

| # | Feature | Web | Mobile | Description |
|---|---------|:---:|:------:|-------------|
| 1 | **Dashboard** | Yes | Yes | Analytics overview, pending reviews, at-risk students |
| 2 | **Class Management** | Yes | Yes | Create/edit/delete courses, manage enrollment, share join codes |
| 3 | **Assignments** | Yes | Yes | Create with conditional access, rubric-based grading, view submissions |
| 4 | **Quizzes** | Yes | Yes | Create/edit quizzes, view all student attempts and results |
| 5 | **Gradebook** | Yes | Yes | Class-wide grade table, configurable weights, per-student reports |
| 6 | **Grading Rubrics** | Yes | Yes | Create rubrics with criteria, grade submissions with per-criterion scores |
| 7 | **Discussion Forum** | Yes | Yes | Topic-based forum with pin/delete moderator controls |
| 8 | **Completion Tracking** | Yes | Yes | Per-student progress (assignments, quizzes, resources), at-risk identification, summary stats |
| 9 | **Attendance** | Yes | Yes | Create sessions, mark present/late/absent, bulk update, delete sessions |
| 10 | **Groups** | Yes | Yes | Create student groups, add/remove members, auto-assign via round-robin |
| 11 | **Group Tasks** | Yes | Yes | Per-course group-task containers; auto-assign students into named subgroups via round-robin |
| 12 | **Analytics** | Yes | Yes | Engagement heatmap, submission trends, map type popularity |
| 13 | **Manage Badges** | Yes | Yes | Award/revoke badges to students |
| 14 | **Map Review** | Yes | Yes | Browse and annotate student mind maps |
| 15 | **AI Plagiarism Detection** | Yes | Yes | Analyze submissions for potential plagiarism with similarity scoring and flagged sections; assignment-wide network/clustering view |
| 16 | **AI Grading Assistant** | Yes | Yes | AI-recommended grades with suggested feedback, score breakdown, one-click apply |
| 17 | **Course Learning Plan (CLP)** | Yes | Yes | Upload syllabus PDF → AI extracts week-by-week topics → configure attendance/exceptions → download generated Excel plan |

### Admin Features (7 features)

| # | Feature | Web | Mobile | Description |
|---|---------|:---:|:------:|-------------|
| 1 | **Admin Dashboard** | Yes | Yes | Platform stats overview + quick links |
| 2 | **User Management** | Yes | Yes | List/search users, change roles (student/lecturer/admin), per-user analytics drill-down |
| 3 | **Audit Logs** | Yes | Yes | Full system audit trail with filtering by user/resource type |
| 4 | **Homepage Editor** | Yes | Yes | CMS for landing page news and posters with image upload |
| 5 | **Manage Badge Definitions** | Yes | Yes | Edit the badge catalog (name, criteria text, icon, points) |
| 6 | **Broadcast Announcements** | Yes | - | Compose subject/body and send to audience (all / students / lecturers / specific) — fans out via threaded SMTP, history persisted |
| 7 | **AI Usage & Quotas** | Yes | Yes | Per-user/per-feature token consumption, set global default + per-user token limits, image generation quotas, usage analytics (top users, time-on-app, feature visits) |

### Cross-Cutting Features

| Feature | Description |
|---------|-------------|
| **Dark/Light Theme** | Toggle between dark glassmorphism and light mode with expanding circle animation (mobile), persisted per user via Firebase |
| **Bilingual UI (i18n)** | English and Bahasa Melayu language support on mobile, switchable from profile settings |
| **First-Time Tutorial** | Spotlight overlay guide for new users on mobile with skip option |
| **Registration Parity (Web ↔ Mobile)** | Both platforms share the same IPG-specific dropdown options (11 departments, 38 PISMP/PPISMP/DPLI programs) via `frontend-mobile/lib/utils/app_constants.dart` ↔ `frontend-web/src/lib/constants.ts`, with a free-text "Other" fallback on both. Password strength meter (5-check heuristic: length, lowercase, uppercase, number, symbol) on mobile matches web. Welcome email dispatched post-registration on both platforms |
| **AI Engine (Gemini 2.5 Flash)** | Powers 11 AI features: companion chat, study guide, timetable analysis, exam planner, study materials, plagiarism detection (single + assignment-wide network), grading assistant, mind map buddy, image generation, course import. See the **RAG / GAG Architecture** section below for the full per-feature breakdown |
| **Auto-Badge Engine** | 9 badge criteria automatically checked after key actions (submissions, quizzes, reviews) |
| **Conditional Access** | Date-based and prerequisite-based restrictions on assignments |
| **Weighted Gradebook** | Configurable assignment/quiz weight ratios per course |
| **Similarity Detection** | Assignment plagiarism detection via text similarity |
| **Role-Based Access** | Dashboard layout guards with role-based routing (student/lecturer/admin) |
| **Real-Time Polling** | Discussions (5s), announcements (10s), map collaboration (4s), forum posts (5s), messages (4s) |
| **Social Graph (students-only)** | Follow/unfollow, follower/following counters maintained via `Increment(±1)`, single-doc edge in `follows/` collection, server-side enforced student-only boundary, suggested users + trending maps for cold-start discovery |
| **Map Likes & Comments** | Per-(map, user) like edges in `mapLikes`, threaded `mapComments`, denormalised counts on map docs |
| **SMTP Email Notifications** | Best-effort transactional emails for new follower, broadcast announcements, etc.; fire-and-forget per-recipient daemon thread; gracefully no-ops when SMTP env vars are unset |
| **Per-User AI Token Quotas** | Global default token budget + per-user override (`aiConfig`, `aiUserSettings`); daily counter per user (`aiDailyUsage`), feature-level aggregates (`aiUsageSummary`); 1/day image generation quota |
| **Recently-Viewed** | Tracked via `courseViews` and `mapViews` for quick "recent" lists on dashboards |
| **Cloud Storage** | Production uploads route through `app/storage.py` to a GCS bucket (`GCS_BUCKET`); local dev writes to `uploads/`. Same `save_upload(data, subdir, filename, content_type)` helper either way |

---

## Firestore Collections (60+ collections)

All data is stored in flat top-level Firestore collections with **camelCase** field names. Many-to-many links are stored as arrays on the parent doc (`enrolledStudents` on `courses`, `collaborators` on `maps`, `members` on `courseGroups`, `badges` on `users`) — no association tables.

### Core Data Model (logical relationships)

```
                                  ┌──────────┐
                                  │  USERS   │ ──teaches──▶ COURSES (1..*)
                                  │ id, role,│ ──owns─────▶ MAPS    (1..*)
                                  │  email…  │ ──submits──▶ SUBMISSIONS
                                  └────┬─────┘ ──attempts─▶ QUIZ_ATTEMPTS
                                       │       ──follower / followed▶ FOLLOWS
                                       │       ──likes────▶ MAP_LIKES
                                       │       ──authors──▶ MAP_COMMENTS
                                       │       ──receives─▶ NOTIFICATIONS
                                       │       ──sends────▶ MESSAGES
                                       │       ──earns────▶ CERTIFICATES
                                       │       ──tokens───▶ AI_USAGE_SUMMARY
                                       │       ──participant▶ CONVERSATIONS
                                       │
                                       ▼ (lecturerId)
                              ┌─────────────────┐
                              │     COURSES     │
                              │ id, courseName, │
                              │ joinCode,       │
                              │ enrolledStudents│
                              └────────┬────────┘
                                       │
        ┌──────────────┬───────────────┼─────────────┬──────────────┬──────────────┐
        ▼              ▼               ▼             ▼              ▼              ▼
  ┌───────────┐  ┌──────────┐   ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ASSIGNMENTS│  │ QUIZZES  │   │ANNOUNCE-   │  │DISCUSSION│  │  COURSE  │  │ COURSE   │
  │           │  │          │   │  MENTS     │  │S +TOPICS │  │ MODULES  │  │ GROUPS   │
  └─────┬─────┘  └─────┬────┘   └────────────┘  └──────────┘  └────┬─────┘  └────┬─────┘
        │              │                                            │             │
        ▼              ▼                                            ▼             ▼
  ┌───────────┐  ┌─────────────┐ ┌──────────────┐            ┌────────────┐  ┌──────────┐
  │SUBMISSIONS│  │QUIZ_QUESTIONS│ │QUIZ_ATTEMPTS│            │MODULE_ITEMS│  │GROUP_TASKS│ ──┐
  └─────┬─────┘  └─────────────┘ └──────────────┘            └─────┬──────┘  └──────────┘   │
        │                                                          │             ▲          │
        ├──▶ PEER_REVIEWS                                          ▼             │ subgroups│
        ├──▶ RUBRICS (1:0..1)                                ┌─────────────┐     │          │
        ├──▶ AI_GRADE_RECOMMENDATIONS (1:0..1)               │RESOURCE_    │     └──────────┘
        └──▶ AI_PLAGIARISM_REPORTS (1:0..1)                  │ PROGRESS    │
                                                             └─────────────┘
        ┌──────────┐                                          ┌──────────────────┐
        │  MAPS    │ ──likes──▶ MAP_LIKES                     │KNOWLEDGE_GRAPHS │
        │          │ ──comments─▶ MAP_COMMENTS                │ (per course,    │
        │          │ ──versions─▶ MAP_HISTORY                 │  nightly 3 AM)  │
        │          │ ──viewed───▶ MAP_VIEWS                   └──────────────────┘
        └──────────┘
        ┌──────────────┐                ┌──────────────────────┐
        │CONVERSATIONS │ ──thread─▶     │      MESSAGES        │
        └──────────────┘                └──────────────────────┘
        ┌──────────┐                    ┌──────────────────────┐
        │ATTENDANCE│ ──per student─▶    │ATTENDANCE_RECORDS    │
        └──────────┘                    └──────────────────────┘

  Legend:  ──relation─▶  one-to-many   (many-to-many stored as arrays on parent doc:
                                        enrolledStudents, collaborators, members, badges)
```

### Collection Catalog

| Collection | Purpose | Key Fields |
|---|---|---|
| `users` | User profiles | `displayName`, `email`, `role`, `className`, `photoURL`, `points`, `streak`, `badges` |
| `maps` | Mind maps | `ownerId`, `ownerEmail`, `title`, `graphData`, `graphFormat`, `shareCode`, `collaborators` |
| `courses` | Courses/subjects | `lecturerId`, `lecturerName`, `courseName`, `courseCode`, `joinCode`, `enrolledStudents` |
| `assignments` | Assignments | `courseId`, `lecturerId`, `title`, `deadline`, `availableFrom`, `availableUntil`, `prerequisiteId`, `minGrade` |
| `submissions` | Student submissions | `assignmentId`, `studentId`, `submissionType`, `grade`, `feedback` |
| `quizzes` | Quizzes | `courseId`, `lecturerId`, `title`, `timeLimitMinutes`, `deadline`, `shuffleQuestions`, `showResults` |
| `quizQuestions` | Quiz questions | `quizId`, `type`, `text`, `options`, `correctAnswer`, `points`, `order` |
| `quizAttempts` | Quiz attempts | `quizId`, `studentId`, `answers`, `score`, `totalPoints`, `percentage` |
| `announcements` | Course announcements | `courseId`, `title`, `content`, `senderName`, `senderId` |
| `discussions` | Chat messages + forum posts | `courseId`, `text`, `senderId`, `senderRole`, `topicId` (for forum), `parentId` (for replies) |
| `discussionTopics` | Forum topics | `courseId`, `title`, `description`, `pinned`, `authorId`, `replyCount`, `lastActivity` |
| `courseModules` | Resource modules | `courseId`, `title`, `description` |
| `moduleItems` | Module items | `moduleId`, `title`, `type`, `url`, `fileType`, `unlockDate` |
| `resourceProgress` | Resource tracking | `resourceId`, `userId`, `openedAt` |
| `reminders` | Personal planner | `ownerId`, `title`, `date`, `type`, `priority`, `isCompleted` |
| `peerReviews` | Peer reviews | `submissionId`, `reviewerId`, `rating`, `comment` |
| `rubrics` | Grading rubrics | `assignmentId`, `title`, `criteria` |
| `attendance` | Attendance sessions | `courseId`, `date`, `title` |
| `attendanceRecords` | Attendance records | `sessionId`, `studentId`, `status` |
| `certificates` | Completion certificates | `studentId`, `courseId`, `certificateNumber`, `completionPercentage` |
| `courseGroups` | Student groups | `courseId`, `name`, `description`, `members` |
| `gradeSettings` | Grade weights | `courseId`, `assignmentWeight`, `quizWeight` |
| `messages` | Private messages | `conversationId`, `senderId`, `text` |
| `conversations` | Chat conversations | `participants`, `lastMessage`, `lastMessageAt` |
| `notifications` | In-app notifications | `userId`, `title`, `message`, `type`, `link`, `read` |
| `activityFeed` | Activity log | `userId`, `action`, `resourceType`, `resourceId`, `title` |
| `reflections` | Weekly reflections | `ownerId`, `confidence`, `notes`, `weekLabel` |
| `fcmTokens` | Push notification tokens | `userId`, `token`, `platform` |
| `homepageContent` | CMS content for landing page | `section`, `title`, `content`, `imageUrl` |
| `participationScores` | Student engagement metrics | `courseId`, `studentId`, `score`, `breakdown` |
| `groupTasks` | Group task containers (per course) | `courseId`, `title`, `description`, `dueDate` |
| `badgeDefinitions` | Admin-editable badge catalog | `id`, `name`, `criteriaText`, `icon`, `points` |
| `adminAnnouncements` | Admin broadcast email records | `audience`, `subject`, `body`, `recipientCount`, `recipientIds`, `sentBy`, `sentByName`, `createdAt` |
| **Social** | | |
| `follows` | Follow edges (students-only) | doc id `{followerId}_{followedId}`; fields `followerId`, `followedId`, `createdAt` |
| `mapLikes` | Map likes | doc id `{mapId}_{userId}`; fields `mapId`, `userId`, `createdAt` |
| `mapComments` | Map comments | `mapId`, `authorId`, `text`, `createdAt` |
| `courseViews` | Recently-viewed courses | `userId`, `courseId`, `viewedAt` |
| `mapViews` | Recently-viewed maps | `userId`, `mapId`, `viewedAt` |
| **Usage analytics** | | |
| `userSessions` | Daily time + feature visits | doc id `{userId}_YYYY-MM-DD`; fields `userId`, `date`, `seconds`, `features` |
| `userActivityAggregate` | Lifetime totals (fast top-users queries) | `userId`, `totalSeconds`, `totalVisits`, `lastActiveAt` |
| **AI / RAG** | | |
| `aiPlagiarismReports` | AI plagiarism results | `submissionId`, `similarityScore`, `flaggedSections` |
| `aiGradeRecommendations` | AI grade suggestions | `submissionId`, `suggestedGrade`, `feedback` |
| `learningProfiles` | Student learning styles | `userId`, `style`, `strengths`, `weaknesses` |
| `aiChatHistory` | AI companion conversations | `userId`, `messages`, `context` |
| `generatedStudyMaterials` | AI-generated content | `userId`, `type`, `topic`, `content` |
| `studyQuizAttempts` | Attempts on AI-generated practice quizzes | `userId`, `materialId`, `answers`, `score` |
| `aiStudyPlans` | AI daily guides + exam plans | `userId`, `type`, `plan`, `createdAt` |
| `savedTimetables` | Stored timetable analyses | `userId`, `subjects`, `schedule` |
| `examSchedules` | Exam timetable analysis | `userId`, `subjects`, `schedule` |
| `aiMindmapBuddyMemory` | AI map assistant context | `userId`, `mapId`, `memory`, `preferences` |
| `mapHistory` | Map version tracking | `mapId`, `version`, `graphData`, `editedBy` |
| `ragIndexState` | RAG indexing state | `docId`, `courseId`, `contentHash`, `lastIndexedAt`, `chunkCount` |
| `knowledgeGraphs` | Course concept graphs | `courseId`, `nodes`, `edges`, `nodeCount`, `lastUpdatedAt` |
| **AI quotas / config** | | |
| `aiUsageSummary` | Per-user feature-level token aggregates | `userId`, `features.{key}.tokens`, `total` |
| `aiUserSettings` | Per-user AI overrides | `userId`, `tokenLimit`, `imageQuota` |
| `aiDailyUsage` | Daily token counter | doc id `{userId}_YYYY-MM-DD`; fields `userId`, `date`, `tokens` |
| `aiConfig` | Global AI config (singleton "global" doc) | `defaultTokenLimit`, `defaultImageQuota` |
| **AI caches (TTL'd)** | | |
| `aiDailyGuideCache`, `aiMapAnalysisCache`, `aiNodeRecsCache`, `aiSuggestAllCache`, `aiImageQuotas`, `aiImageCache`, `aiExamPlanCache` (permanent), `aiTimetableCache` (30d), `aiImportCache` (24h), `aiCompanionQuestionCache` (7d global Q&A dedup), `aiElaborationCache` (30d image-prompt elaboration) | Cache layers — see "AI Token Optimisation" | various |
| **CLP** | | |
| `clpDrafts` | In-progress CLP sessions | `userId`, `metadata`, `weeks`, `createdAt` |
| `clpFileHashes` | PDF hash → cached extraction | `hash`, `extraction`, `createdAt` |
| `clpFailedUploads` | Failed PDF uploads (for debugging) | `userId`, `filename`, `error`, `createdAt` |
| `clpExtractionResults` | Cached AI extraction results | `hash`, `weeks`, `createdAt` |

**Many-to-many relationships** use arrays instead of association tables:
- `enrolledStudents` array on course docs
- `badges` array on user docs
- `collaborators` array on map docs
- `members` array on group docs

---

## Mobile App Architecture

### Navigation

The Flutter mobile app uses a **5-tab bottom navigation** (`FloatingNavBar`):

| Tab | Screen | Description |
|-----|--------|-------------|
| Home | `HomeScreen` | Dashboard with stats, quick access row (Notifications, Messages, Calendar, Activity, Certificates), recent maps, daily tip |
| Subjects | `SubjectsScreen` | Course list (enrolled for students, teaching for lecturers) |
| Tasks | `TasksScreen` | Personal planner with date-based reminders |
| Maps | `MindMapsScreen` | Mind map gallery with search |
| Profile | `ProfileScreen` | Profile editor, theme toggle, logout |

### Course Tools (per course)

When a user taps a course, `SubjectDetailScreen` shows a grid of tool cards:

| Tool | Student | Lecturer | Screen |
|------|:-------:|:--------:|--------|
| Resources | Yes | Yes | `ResourcesScreen` |
| Assignments | Yes | Yes | `AssignmentsTab` |
| Quizzes | Yes | Yes | `QuizzesScreen` |
| Forum | Yes | Yes | `ForumScreen` |
| Gradebook | Yes | Yes | `GradebookScreen` |
| Attendance | Yes | Yes | `AttendanceScreen` (+ `AttendanceSessionDetailScreen`, `AttendanceCheckinScreen`) |
| Announcements | Yes | Yes | `AnnouncementFormScreen` |
| Class Chat | Yes | Yes | `DiscussionChatScreen` |
| Peer Reviews | Yes | - | `PeerReviewsScreen` |
| Completion | - | Yes | `CompletionScreen` (+ `StudentReportScreen` drill-down) |
| Groups | Yes | Yes | `GroupsScreen` |
| Group Tasks | Yes | Yes | `GroupTaskDetailScreen` |
| Plagiarism | - | Yes | `PlagiarismScreen` (+ `PlagiarismReportScreen`) |
| Rubric Grading | - | Yes | `RubricGradingScreen` |

### API Service

`api_service.dart` provides a centralized HTTP client with **120+ endpoint methods** organized into sections:

| Section | Methods | Description |
|---------|---------|-------------|
| Auth | `syncUser`, `getMe`, `sendWelcomeEmail` | Firebase token sync, current user, welcome email trigger |
| Users | `updateMe`, `getUser`, `uploadAvatar` | Profile management |
| Courses | `getTeachingCourses`, `getEnrolledCourses`, `createCourse`, `joinCourse`, `getCourseStudents` | Course CRUD + enrollment |
| Assignments | `getAssignments`, `createAssignment`, `submitAssignment`, `gradeSubmission` | Full assignment workflow |
| Quizzes | `getQuizzes`, `getQuizQuestions`, `createQuiz`, `submitQuizAttempt`, `getQuizResults` | Quiz lifecycle |
| Gradebook | `getMyGrades`, `getCourseGradebook`, `getGradebookSettings` | Grade management |
| Peer Reviews | `getPeerReviews`, `submitPeerReview`, `getMyPeerReviews` | Review workflow |
| Forum | `getTopics`, `createTopic`, `toggleTopicPin`, `getTopicPosts`, `createTopicPost` | Forum CRUD |
| Attendance | `getCourseAttendance`, `createAttendanceSession`, `getMyAttendance` | Attendance tracking |
| Completion | `getCourseCompletion`, `getCompletionSummary` | Progress analytics |
| Groups | `getCourseGroups`, `createGroup`, `autoAssignGroups` | Group management |
| Notifications | `getNotifications`, `markNotificationRead`, `markAllNotificationsRead` | Notification center |
| Messaging | `getConversations`, `startConversation`, `getMessages`, `sendMessage`, `searchUsers` | Private messaging |
| Activity | `getActivity`, `createReflection`, `getReflections` | Activity feed |
| Progress | `getCourseProgress`, `getCalendarEvents` | Calendar + progress |
| Certificates | `getMyCertificates`, `claimCertificate` | Certificate management |
| Question Bank | `getQuestionBank`, `createQuestion`, `importQuestionsToQuiz` | Question pool (lecturer) |
| Maps | `getMaps`, `getMap`, `searchMapsByCode`, `renameMap` | Mind map operations |
| Reminders | `getReminders`, `createReminder`, `updateReminder` | Planner tasks |
| Badges | `awardBadge`, `revokeBadge` | Badge management |
| Analytics | `getAnalytics` | Lecturer dashboard |
| AI Companion | `aiChat`, `aiChatHistory`, `aiClearHistory`, `aiGetLearningProfile`, `aiUpdateLearningProfile`, `aiAssessStyle` | AI study companion |
| AI Study Plan | `aiDailyGuide`, `aiCreateExamPlan`, `aiGetExamPlans`, `aiDeleteExamPlan`, `aiAnalyzeTimetable`, `aiUploadTimetablePdf` | AI study planning |
| AI Materials | `aiGenerateStudyMaterial`, `aiGetStudyMaterials`, `aiDeleteStudyMaterial` | AI-generated content |
| AI Plagiarism | `aiAnalyzePlagiarism`, `aiGetPlagiarismReport` | AI plagiarism detection |
| AI Grading | `aiRecommendGrade`, `aiGetGradeRecommendation` | AI grading assistant |
| AI Images | `aiGenerateImage`, `aiImageHistory`, `aiImageQuota` | AI image generation (1/day quota) |
| Social | `follow`, `unfollow`, `getFollowers`, `getFollowing`, `getProfile`, `getFeed`, `getTrending`, `getSuggested`, `searchUsers`, `likeMap`, `unlikeMap`, `getMapComments`, `addMapComment`, `deleteMapComment` | Social graph + map likes & comments |
| Group Tasks | `listTasks`, `createTask`, `getTask`, `deleteTask`, `addGroup`, `removeGroup`, `addMember`, `removeMember`, `autoAssign` | Per-course group-task containers |
| Admin | `adminGetDashboard`, `adminListUsers`, `adminPatchUserRole`, `adminGetAuditLogs`, `adminGetAiUsage`, `adminPatchTokenLimit`, `adminBroadcastAnnouncement`, `adminListBroadcasts`, etc. | Admin console (incl. broadcast announcements + AI quotas) |

---

## Project Statistics

| Metric | Value |
|--------|-------|
| Backend API routers (mounted) | 40 (41 router files; `auto_badges.py` is helpers-only) |
| Backend services packages | 2 (`app/services/`, `app/site_importer*/`) |
| Web frontend pages | 41 (student 21 + lecturer 12 + admin 8) |
| Flutter mobile screens | ~61 (incl. 6-screen mobile admin console) |
| Firestore collections | 60+ |
| Student features | 32 |
| Lecturer features | 17 |
| Admin features | 7 |
| AI feature routers | 9 |
| Gamification badge criteria | 9 |
| AI cache / quota collections | 11+ |
| Supported languages (mobile) | 2 (English, Bahasa Melayu) |
| Supported user roles | 3 (Student, Lecturer, Admin) |

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Flutter** 3.x+ (for mobile)
- A **Firebase project** with:
  - Authentication (Email/Password) enabled
  - Firestore Database created
  - `serviceAccountKey.json` placed in `backend/`
  - `google-services.json` placed in `frontend-mobile/android/app/`

### Option 1: Start Each Server Separately

```bash
# Terminal 1 — Backend
bash start-backend.sh
# API at http://localhost:8000 | Swagger docs at http://localhost:8000/docs

# Terminal 2 — Web Frontend
bash start-frontend-web.sh
# Runs at http://localhost:3000

# Terminal 3 — Mobile App
bash start-frontend-mobile.sh                    # auto-detect device
bash start-frontend-mobile.sh emulator-5554      # Android emulator
bash start-frontend-mobile.sh PJ7LNNUW9PMV6DPN  # USB device
```

### Option 2: Start All Together

```bash
# All servers (backend + web + mobile emulator)
bash start-dev.sh

# All servers with USB device
bash start-dev-mobile.sh

# All servers with wireless device
bash start-dev-mobile-wireless.sh
```

### Option 3: Manual Start

#### Backend
```bash
cd backend
pip install -r requirements.txt
# Place serviceAccountKey.json in this directory
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# API at http://localhost:8000 | Swagger docs at http://localhost:8000/docs
```

#### Web Frontend
```bash
cd frontend-web
npm install
# Create .env.local with: NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev
# Runs at http://localhost:3000
```

#### Mobile (Flutter)
```bash
cd frontend-mobile
flutter pub get
# Ensure google-services.json is in android/app/
flutter run
```

---

## API Endpoints

All endpoints (except auth and public) require `Authorization: Bearer <firebase_id_token>` header.

### Auth & Users
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/auth/sync` | Sync Firebase user to Firestore |
| GET | `/api/auth/me` | Current user profile |
| PATCH | `/api/users/me` | Update profile fields |
| POST | `/api/users/me/avatar` | Upload profile photo |

### Maps
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST/PATCH/DELETE | `/api/maps/` | Mind map CRUD |
| GET | `/api/maps/search/by-code` | Search by share code |
| GET | `/api/maps/search/by-email` | Search by owner email |
| GET | `/api/maps/search/by-course/{cid}` | Maps tied to a course |
| GET | `/api/maps/search/students` | Search student-owned maps |
| GET | `/api/maps/public/user/{uid}` | Public maps for a user (profile pages) |
| POST/DELETE | `/api/maps/{id}/collaborators` | Manage collaborators |
| POST/GET | `/api/maps/{id}/presence` | Real-time presence |
| GET/POST/PATCH/DELETE | `/api/maps/{id}/annotations` | Map annotations |
| GET | `/api/maps/{id}/history` | Per-map version history |
| POST | `/api/maps/{id}/view` | Record a view (powers recently-viewed) |
| GET | `/api/maps/views/recent` | Caller's recently-viewed maps |
| GET | `/api/maps/{id}/visitors` | Map visitor list (owner only) |
| POST | `/api/maps/{id}/upload-image` | Upload an image used in a map node |

### Courses
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/courses/teaching` | Lecturer's courses |
| GET | `/api/courses/enrolled` | Student's courses |
| POST | `/api/courses/` | Create course |
| POST | `/api/courses/join` | Join by code |
| GET | `/api/courses/{cid}/students` | List enrolled students |
| POST | `/api/courses/{cid}/add-student` | Add student to course |

### Assignments & Submissions
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST/PATCH/DELETE | `/api/assignments/` | Assignment CRUD |
| GET | `/api/assignments/{aid}/access-check` | Check conditional access |
| GET/POST | `/api/assignments/{aid}/submissions` | Submissions |
| POST | `/api/assignments/{aid}/submissions/upload` | File upload submission |
| PATCH | `/api/assignments/{aid}/submissions/{sid}/grade` | Grade submission |
| GET | `/api/assignments/{aid}/similarity-report` | Plagiarism detection |

### Quizzes
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST/PATCH/DELETE | `/api/quizzes/` | Quiz CRUD |
| GET/POST/DELETE | `/api/quizzes/{qid}/questions` | Question management |
| POST | `/api/quizzes/{qid}/attempt` | Submit quiz attempt |
| GET | `/api/quizzes/{qid}/attempt/mine` | Student's own attempt |
| GET | `/api/quizzes/{qid}/attempts` | All attempts (lecturer) |
| GET | `/api/quizzes/{qid}/results` | Results with answers |

### Gradebook
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/gradebook/my` | Student gradebook |
| GET | `/api/gradebook/course/{cid}` | Course gradebook (lecturer) |
| GET/POST | `/api/gradebook/settings/{cid}` | Grade weight settings |
| GET | `/api/gradebook/student/{sid}/course/{cid}` | Individual student report |
| GET | `/api/gradebook/course/{cid}/export` | Export as CSV |

### Rubrics
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/rubrics/assignment/{aid}` | Get rubric |
| POST | `/api/rubrics/` | Create rubric |
| POST | `/api/rubrics/grade/{aid}/{sid}` | Grade with rubric |

### Discussions & Forum
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST/DELETE | `/api/courses/{cid}/discussions/` | Class chat messages |
| GET/POST | `/api/courses/{cid}/discussions/{mid}/replies` | Threaded replies |
| GET/POST/PATCH/DELETE | `/api/courses/{cid}/topics/` | Discussion topics |
| PATCH | `/api/courses/{cid}/topics/{tid}/pin` | Toggle pin (lecturer) |
| GET/POST/DELETE | `/api/courses/{cid}/topics/{tid}/posts` | Topic posts |

### Attendance
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST | `/api/attendance/course/{cid}` | Sessions |
| PATCH | `/api/attendance/session/{sid}/record` | Update record |
| PATCH | `/api/attendance/session/{sid}/bulk` | Bulk update |
| DELETE | `/api/attendance/session/{sid}` | Delete session |
| GET | `/api/attendance/student/my` | Student's attendance |

### Certificates
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/certificates/my` | Student's certificates |
| GET | `/api/certificates/course/{cid}` | Course certificates |
| POST | `/api/certificates/claim/{cid}` | Claim certificate |
| GET | `/api/certificates/verify/{num}` | Public verification |

### Groups
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST | `/api/courses/{cid}/groups/` | Group CRUD |
| POST | `/api/courses/{cid}/groups/{gid}/members` | Add members |
| DELETE | `/api/courses/{cid}/groups/{gid}/members/{sid}` | Remove member |
| DELETE | `/api/courses/{cid}/groups/{gid}` | Delete group |
| POST | `/api/courses/{cid}/groups/auto-assign` | Auto-assign |

### Completion Tracking
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/completion/course/{cid}` | Per-student completion |
| GET | `/api/completion/course/{cid}/summary` | Aggregated summary |

### Peer Reviews
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/peer-reviews/assignment/{aid}` | Reviews for assignment |
| POST | `/api/peer-reviews/submission/{sid}` | Submit review |
| GET | `/api/peer-reviews/submission/{sid}` | Reviews for submission |
| GET | `/api/peer-reviews/my-reviews` | Student's own reviews |

### Messaging
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/messages/conversations` | List conversations |
| POST | `/api/messages/conversations/{uid}` | Start conversation |
| GET | `/api/messages/conversations/{cid}/messages` | Get messages |
| POST | `/api/messages/conversations/{cid}` | Send message |
| GET | `/api/messages/search-users` | Search users |

### Notifications
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/notifications/` | List notifications |
| GET | `/api/notifications/grouped` | Notifications grouped by day/type |
| PATCH | `/api/notifications/{nid}/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all read |
| DELETE | `/api/notifications/{nid}` | Delete one |
| DELETE | `/api/notifications/` | Clear all |
| POST | `/api/notifications/register-token` | Register FCM token |

### Social (students-only)
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST/DELETE | `/api/social/follow/{user_id}` | Follow / unfollow |
| GET | `/api/social/followers/{user_id}` | Follower list |
| GET | `/api/social/following/{user_id}` | Following list |
| GET | `/api/social/profile/{user_id}` | Public profile |
| GET | `/api/social/feed` | Maps from people you follow (newest-first) |
| GET | `/api/social/explore/trending` | Trending public maps |
| GET | `/api/social/explore/suggested` | Suggested users to follow |
| GET | `/api/social/users/search` | Search students by name/email |
| POST/DELETE | `/api/social/maps/{map_id}/like` | Like / unlike a map |
| GET/POST | `/api/social/maps/{map_id}/comments` | List / add comments |
| DELETE | `/api/social/maps/{map_id}/comments/{cid}` | Delete a comment (author or map owner) |

### Group Tasks
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST | `/api/courses/{cid}/group-tasks/` | List / create tasks |
| GET/DELETE | `/api/courses/{cid}/group-tasks/{tid}` | Get / delete task |
| POST/DELETE | `/api/courses/{cid}/group-tasks/{tid}/groups` | Add / remove subgroup |
| POST/DELETE | `/api/courses/{cid}/group-tasks/{tid}/groups/{gid}/members` | Add / remove member |
| POST | `/api/courses/{cid}/group-tasks/{tid}/auto-assign` | Round-robin auto-assign all enrolled students |

### Course Learning Plan (CLP)
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/clp/upload` | Upload syllabus PDF — AI extracts week-by-week topics |
| POST | `/api/clp/generate` | Generate full plan from configured weeks |
| GET | `/api/clp/drafts` | List drafts |
| GET/PUT/DELETE | `/api/clp/drafts/{sid}` | Get / update / delete a draft |
| POST | `/api/clp/download` | Download generated `.xlsx` |

### Site Import
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/site-import/google-site/preview` | Preview a Google Site as a course tree |
| POST | `/api/site-import/google-site/preview-stream` | Streamed (SSE) preview |
| POST | `/api/site-import/google-site/execute` | Import preview into a course |
| POST | `/api/site-import/google-site/from-data` | Import from precomputed data |
| POST | `/api/site-import/google-site/feedback` | Submit per-import feedback |
| GET/POST | `/api/site-import/course-kb` | Course KB list / add |
| GET | `/api/site-import/course-kb/lookup/{code}` | KB lookup by course code |

### AI Features
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/ai/companion/chat` | Send message to AI study companion |
| GET | `/api/ai/companion/history` | Get chat history |
| DELETE | `/api/ai/companion/history` | Clear chat history |
| GET | `/api/ai/companion/learning-profile` | Get learning style profile |
| PUT | `/api/ai/companion/learning-profile` | Update learning profile |
| POST | `/api/ai/companion/assess-style` | Get learning style assessment quiz |
| GET | `/api/ai/study-plan/daily-guide` | AI daily study recommendations |
| POST | `/api/ai/study-plan/exam-plan` | Generate exam study plan |
| GET | `/api/ai/study-plan/exam-plans` | List saved exam plans |
| DELETE | `/api/ai/study-plan/{plan_id}` | Delete exam plan |
| POST | `/api/ai/study-plan/timetable-analyze` | Analyze timetable text |
| POST | `/api/ai/study-plan/timetable-upload` | Upload and analyze timetable PDF |
| POST | `/api/ai/study-materials/generate` | Generate study material (summary/flashcards/quiz) |
| POST | `/api/ai/study-materials/generate-by-topic` | RAG: Generate material from course-wide topic search |
| GET | `/api/ai/study-materials/` | List generated materials |
| DELETE | `/api/ai/study-materials/{id}` | Delete study material |
| POST | `/api/ai/plagiarism/analyze/{sid}` | Analyze submission for plagiarism |
| GET | `/api/ai/plagiarism/report/{sid}` | Get plagiarism report |
| POST | `/api/ai/plagiarism/analyze-assignment/{aid}` | RAG+GAG (Graph): Plagiarism network analysis |
| POST | `/api/ai/rag/index-course/{cid}` | Trigger RAG indexing for a course |
| GET | `/api/ai/rag/index-status/{cid}` | Get RAG index statistics |
| POST | `/api/ai/grading/recommend/{sid}` | Get AI grade recommendation |
| GET | `/api/ai/grading/recommendation/{sid}` | Get saved grade recommendation |
| POST | `/api/ai/mindmap-buddy/analyze` | Analyze mind map structure and get suggestions |
| POST | `/api/ai/mindmap-buddy/recommend-nodes` | Get node recommendations for a specific node |
| POST | `/api/ai/mindmap-buddy/suggest-all` | Get suggestions for entire map |
| POST | `/api/ai/mindmap-buddy/chat` | Chat with AI about current mind map |
| GET | `/api/ai/mindmap-buddy/memory` | Get conversation memory and preferences |
| DELETE | `/api/ai/mindmap-buddy/memory` | Clear mind map buddy memory |
| PATCH | `/api/ai/mindmap-buddy/preferences` | Update AI buddy preferences |

### Other
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST/DELETE | `/api/courses/{cid}/announcements/` | Announcements |
| GET/POST/DELETE | `/api/courses/{cid}/modules/` | Resource modules |
| GET/POST/PATCH/DELETE | `/api/reminders/` | Planner tasks |
| POST | `/api/badges/award` | Award badge |
| POST | `/api/badges/revoke` | Revoke badge |
| GET | `/api/analytics/` | Lecturer analytics |
| GET | `/api/progress/courses` | Course progress |
| GET | `/api/progress/calendar` | Calendar events |
| GET | `/api/activity/` | Activity feed |
| GET/POST | `/api/activity/reflections` | Weekly reflections |
| GET | `/api/courses/{cid}/participation/` | Participation scores |
| GET | `/api/stats/study-activity` | Study heatmap data |

### Admin
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/admin/audit-logs` | Audit trail (filter by user / resource type) |
| GET | `/api/admin/users` | List users (filter by role) |
| PATCH | `/api/admin/users/{uid}/role` | Change a user's role |
| DELETE | `/api/admin/users/{uid}` | Delete a user |
| GET/POST/PATCH/DELETE | `/api/admin/homepage/content` | Homepage CMS sections |
| POST | `/api/admin/homepage/upload` | Upload homepage image (GCS in prod) |
| GET | `/api/admin/ai-usage` | Per-user / feature token consumption |
| GET/PATCH | `/api/admin/ai-token-limit` | Global default daily token limit |
| PATCH | `/api/admin/users/{uid}/token-limit` | Per-user daily token override |
| PATCH | `/api/admin/users/{uid}/image-quota` | Per-user image generation quota |
| GET | `/api/admin/top-users` | Usage analytics (sortable, paginated) |
| GET | `/api/admin/users/{uid}/analytics` | Per-user analytics drill-down |
| POST | `/api/admin/announcements` | Send broadcast email to audience (all/students/lecturers/specific) |
| GET | `/api/admin/announcements` | Recent broadcast history |

---

## RAG / GAG Architecture

MySmartStudy's AI is built around **three retrieval-augmented patterns** layered on top of a single Gemini generation backbone. The same `rag_service.py` is reused everywhere; the difference between features is what gets *retrieved*, what *augmenting context* is fanned in alongside, and what *output shape* is asked of Gemini.

### Pipeline Overview (Ingest → Retrieve → Augment → Generate)

```
┌────────────────────────── ① INGESTION (nightly 2 AM, APScheduler) ──────────────────────────┐
│                                                                                              │
│   Course resources          ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐   │
│   PDFs · URLs · text  ────▶ │   Chunking  │──▶ │ Gemini embedding │──▶ │ ChromaDB        │   │
│   maps · quizzes ·          │ ~500 tokens │    │ text-embedding-  │    │ (per-course     │   │
│   assignments ·             │ 50 overlap  │    │ 004 (batch=100)  │    │  collection)    │   │
│   announcements             └─────────────┘    └────────┬─────────┘    └─────────────────┘   │
│                                                         │ also writes                        │
│                                                         ▼                                    │
│                                                ┌──────────────────────────────┐              │
│                                                │ ragIndexState                │              │
│                                                │ SHA-256 content hash →       │              │
│                                                │ skip unchanged on re-index   │              │
│                                                └──────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────── ② RETRIEVAL ──────────────────────────────────┐
│                                                                                  │
│   ┌─────────────────────┐                                                        │
│   │ Embed user query    │                                                        │
│   │ text-embedding-004  │                                                        │
│   └──────────┬──────────┘                                                        │
│              ▼                                                                   │
│       ┌─────────────┐    chat (companion,    ┌────────────────────────────┐      │
│       │ Endpoint    │───  mindmap buddy) ──▶ │ rag_multistep              │      │
│       │ type?       │                        │ rerank → decompose → HyDE  │      │
│       │             │── scoped (materials, ─▶┌────────────────────────────┐      │
│       └─────────────┘   grading, plan)      │ Plain top-K cosine search  │      │
│                                              └────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────── ③ AUGMENTATION (per feature) ───────────────────────┐
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ multi_agent.fan_out({...})  — parallel asyncio.gather, 30s timeout  │   │
│   └──────────────────────────────┬──────────────────────────────────────┘   │
│                                  ▼                                          │
│   Firestore parallel reads: courses · grades · deadlines · timetables ·     │
│                              rubrics · learning profile · chat history ·    │
│                              reminders                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────── ④ GENERATION — Gemini 2.5 Flash ──────────────────────┐
│                                                                            │
│   Chat path:        free-text + [Source N] citations                       │
│   GAG Generation:   structured JSON artifact (study plan, grading report…) │
│   GAG Graph:        nodes + edges + cluster meta (mindmap buddy, plagiarism)│
└────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────── ⑤ CACHING & TOKEN TRACKING ──────────────────────┐
│   aiXxxCache (TTL'd by hash key)   ·   aiUsageSummary   ·   aiDailyUsage │
└──────────────────────────────────────────────────────────────────────────┘
```

### Document Ingestion (one-time per change)

- **Sources indexed**: course resources (uploaded PDFs, module URLs the indexer auto-fetches when `content-type: application/pdf`), announcements, discussion topics + posts, mind map text, quiz questions, assignment descriptions.
- **PDF extraction**: `pdfplumber` first → `PyPDF2` fallback → if both fail, the indexer stores `title + url` only (degraded passages — watch the indexing logs).
- **Chunking**: ~500 tokens with 50-token overlap (preserves sentence-edge context).
- **Embedding**: Gemini `text-embedding-004` (default `gemini-embedding-001` configurable via `GEMINI_EMBED_MODEL`/`GEMINI_EMBED_DIM`); batched at 100 chunks per call.
- **Persistence**: ChromaDB on disk at `backend/vector_store/`, one collection per course.
- **Incremental**: each chunk is keyed by `SHA-256(content)` recorded in `ragIndexState`; unchanged docs are skipped on re-index.
- **Trigger**: nightly 2 AM UTC APScheduler job for all courses, or `POST /api/rag-admin/reindex/{course_id}` for manual.
- **Knowledge graph rebuild**: nightly 3 AM job extracts concepts + relationships from indexed content using Gemini and stores per-course `knowledgeGraphs` documents.

### Pattern A — Standard RAG (chat-style retrieval, free-text answer)

Used when the model should *answer in prose*, citing sources.

#### A1. AI Companion Chat (`POST /api/ai/companion/chat`)
- **Retrieve**: `rag_multistep.retrieve_multistep(query)` — rerank, decompose if compound, HyDE if terse. Top 3 chunks (capped at 2,000 chars each) for the trimmed companion budget.
- **Augment** (parallel via `multi_agent.fan_out`): enrolled courses, deadlines, recent quiz scores / assignment grades, saved timetables, planner reminders, VARK learning profile, last 12 chat messages from `aiChatHistory`.
- **Generate**: SMART_MODEL chat with the condensed `study_companion` / `rag_companion` system prompt; output is conversational text with inline `[Source N]` markers mapped to retrieved chunks.
- **Cache**: non-course-specific Q&A cached 7 days globally in `aiCompanionQuestionCache` (shared across users to avoid duplicate Gemini bills for "what is X?" style queries).

#### A2. Study Material Generation (`POST /api/ai/study-materials/generate` and `/generate-by-topic`)
- **Retrieve**: `generate-by-topic` searches the whole course collection for the topic and merges multiple chunks. The plain `/generate` endpoint pulls from a single specified resource.
- **Augment**: requested artifact type (`summary` / `flashcard` / `quiz`), resource title, course context.
- **Generate**: FAST_MODEL via `generate_json` with a strict schema — markdown summary, `Flashcard[]`, or `QuizQuestion[]`.
- **Cache**: 7-day dedup in `generatedStudyMaterials` keyed by `(userId, courseId, type, topicHash)`.
- **Multi-step skipped**: input is already narrow — extra LLM decomposition would add latency without quality gain.

### Pattern B — RAG + GAG Generation (structured JSON artifact)

Used when the *output shape* matters more than free prose. RAG retrieval feeds a Gemini call asked to emit JSON via `gag_service.generate_artifact(schema=…)`.

#### B1. Daily Study Guide (`GET /api/ai/study-plan/daily-guide`)
- **Retrieve**: per weak topic, RAG-pull example explanations + suggested activities from indexed course content.
- **Augment** (parallel): `courses`, `deadlines`, `performance` (recent quiz scores + assignment grades), `timetables` (today's free slots).
- **Generate**: GAG → JSON `study_plan` with per-topic `difficulty_rating` (1-5), `resource_links[]` (URLs from RAG citations), `suggested_activities[]`, time-slotted recommendations, motivational message.
- **Cache**: 24h in `aiDailyGuideCache` keyed by `userId_YYYY-MM-DD` — same-day repeat calls are free.

#### B2. Exam Plan (`POST /api/ai/study-plan/exam-plan`)
- **Retrieve**: none (input is already a discrete list).
- **Augment**: selected courses, exam dates, topic list.
- **Generate**: FAST_MODEL via `generate_json` — daily session schedule with duration per session and personalised tips.
- **Cache**: permanent in `aiExamPlanCache` keyed by `examsHash` (same exam config returns the same plan).

#### B3. Timetable Analysis (`POST /api/ai/study-plan/timetable-{analyze,upload}`)
- **Retrieve**: none.
- **Augment**: raw timetable text or PDF-extracted text (`pdfplumber` → `PyPDF2`).
- **Generate**: FAST_MODEL structured extraction → parsed schedule + recommended free study slots.
- **Cache**: 30 days in `aiTimetableCache` keyed by `textHash`.

#### B4. AI Grading (`POST /api/ai/grading/recommend/{sid}`)
- **Retrieve**: similar past submissions for the same assignment via RAG (used as benchmark exemplars).
- **Augment** (parallel): submission text (`submission_agent`), assignment + rubric criteria (`assignment_agent`), class statistics — mean / distribution (`class_stats_agent`).
- **Generate**: SMART_MODEL via GAG → per-criterion rubric scoring with justifications, comparative analysis vs class, `improvement_suggestions[]` with resource links, confidence score.
- **Cache**: once per submission in `aiGradeRecommendations` (recompute requires explicit re-trigger).

#### B5. Course Import (`POST /api/site-import/google-site/preview`)
- **Retrieve**: none.
- **Augment**: scraped Google Sites HTML.
- **Generate**: FAST_MODEL structuring → modules with items, derived course name + code.
- **Cache**: 24h per URL in `aiImportCache`.

### Pattern C — RAG + GAG Graph (knowledge-graph-aware structured output)

Used when the answer is itself a *graph* — extra nodes / edges to add, or a similarity network across submissions. Combines RAG retrieval with **BFS traversal** over the per-course knowledge graph from `knowledge_graph_service.py`.

#### C1. Mind Map Buddy (`POST /api/ai/mindmap-buddy/{analyze,recommend-nodes,suggest-all,chat}`)
- **Retrieve**: `rag_multistep` over course content using the user's task description + selected node text. Knowledge graph BFS finds neighbouring concepts within 2 hops of the seed nodes.
- **Augment** (parallel via `rag_agent` + `kg_agent`): existing map nodes/edges, enrolled course context, last 30 messages of `aiMindmapBuddyMemory`, user preferences (e.g. "prefer concise labels").
- **Generate**:
  - `analyze` → SMART_MODEL critique with rating (1-10), strengths, structure feedback.
  - `recommend-nodes` / `suggest-all` → GAG graph artifact: suggested nodes (with `source` citation back to a RAG chunk and `graph_connections[]` to existing nodes).
  - `chat` → conversational response anchored to the current map state.
- **Cache**: `aiMapAnalysisCache` 2h (whole-map analysis), `aiNodeRecsCache` 24h (per-node recs), `aiSuggestAllCache` (entire-map suggestions).

#### C2. Plagiarism Network (`POST /api/ai/plagiarism/analyze-assignment/{aid}`)
- **Retrieve**: pairwise cosine similarity across all submissions for the assignment (each submission embedded once and compared via vector dot-product).
- **Augment** (parallel via `assignment_verify` + `similarity_graph_build`): the full submission set, knowledge graph for the course (used to filter out shared-concept matches that aren't true plagiarism).
- **Generate**: connected-component clustering on the similarity graph above a configurable threshold → SMART_MODEL via GAG produces per-cluster narrative ("these N submissions share paragraphs about topic X — likely shared source"), plagiarism percentage, source-type classification, edge list.
- **Single-submission variant** (`POST /api/ai/plagiarism/analyze/{sid}`) skips the graph and just returns flagged sections.
- **Cache**: once per submission (re-analyse requires explicit trigger).

### Special: Image Generation (no RAG, but uses the same caching/quotas)

`POST /api/ai/images/generate` — SMART_MODEL elaborates the prompt → Gemini 2.0 Flash Image (Imagen 3 fallback) generates the image → uploaded to Firebase Storage. Quota: **1 image / user / day** in `aiImageQuotas`. Prompt + style hash cached 7 days in `aiImageCache` (repeat prompts are free). Elaboration step cached 30 days in `aiElaborationCache`.

### Per-Feature Summary Table

| # | Feature | Endpoint | Pattern | Model | Augmentation Sources | Output | Cache |
|---|---------|----------|---------|-------|---------------------|--------|-------|
| 1 | AI Companion Chat | `POST /ai/companion/chat` | Standard RAG | SMART | courses, grades, timetables, learning profile, 12-msg history | Conversational text + `[Source N]` | 7d global Q&A dedup |
| 2 | Study Materials | `POST /ai/study-materials/generate{,-by-topic}` | Standard RAG | FAST | resource(s), topic | Markdown summary / flashcards / quiz JSON | 7d dedup per `(user,course,type,topic)` |
| 3 | Daily Study Guide | `GET /ai/study-plan/daily-guide` | RAG + GAG (Generation) | FAST + GAG | courses, grades, deadlines, timetables | JSON plan with difficulty + links | 24h per `userId+date` |
| 4 | Exam Plan | `POST /ai/study-plan/exam-plan` | GAG (no RAG) | FAST | exam dates, topics | Daily session schedule JSON | Permanent by `examsHash` |
| 5 | Timetable Analysis | `POST /ai/study-plan/timetable-{analyze,upload}` | GAG (no RAG) | FAST | text or PDF | Parsed schedule + free slots | 30d by `textHash` |
| 6 | AI Grading | `POST /ai/grading/recommend/{sid}` | RAG + GAG (Generation) | SMART + GAG | submission, rubric, class stats, similar submissions (RAG) | Per-criterion grade + comparative analysis | Once per submission |
| 7 | AI Mind Map Buddy | `POST /ai/mindmap-buddy/*` | RAG + GAG (Graph) | SMART + GAG | map nodes/edges, courses, RAG, KG (BFS), 30-msg memory, prefs | Rating / strengths / suggested nodes with `source` | 2h analysis, 24h recs |
| 8 | Plagiarism (single) | `POST /ai/plagiarism/analyze/{sid}` | Standard RAG | SMART | submission, similar submissions | Flagged sections + percentage | Once per submission |
| 9 | Plagiarism Network | `POST /ai/plagiarism/analyze-assignment/{aid}` | RAG + GAG (Graph) | SMART + GAG | all submissions, KG | Similarity graph + clusters + narratives | Once per assignment |
| 10 | AI Image Generation | `POST /ai/images/generate` | None (LLM elaboration only) | SMART + Image | prompt + style | Generated image URL | 7d dedup, 1/day quota |
| 11 | Course Import | `POST /site-import/google-site/preview` | GAG (no RAG) | FAST | scraped HTML | Modules + items + course code | 24h per URL |

### Multi-Step Reasoning (Chat Retrieval)

Conversational endpoints (`ai_companion`, `ai_mindmap_buddy`) route through `backend/app/rag_multistep.py`, which layers three techniques on top of plain vector search:

```
                          ┌──────────────────┐
                          │   User query     │
                          └────────┬─────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
    ┌──────────────────────┐                 ┌─────────────────────┐
    │ Phase 3: HyDE check  │                 │ Phase 2: compound?  │
    │ len(q) < HYDE_MIN ?  │                 │ "compare / and / vs"│
    └──────────┬───────────┘                 └──────────┬──────────┘
               │                                        │
        ┌──────┴────────┐                       ┌───────┴────────┐
        ▼               ▼                       ▼                ▼
   ┌────────┐    ┌─────────────┐         ┌──────────┐    ┌──────────────┐
   │ Terse  │    │  Long enough│         │  Yes     │    │   No         │
   │ HyDE → │    │ use raw     │         │ FAST_    │    │ 1 sub-q =    │
   │ FAST   │    │ query       │         │ MODEL    │    │ original     │
   │ drafts │    │             │         │ splits → │    │              │
   │ hypo.  │    │             │         │ N sub-q  │    │              │
   │ answer │    │             │         │          │    │              │
   └───┬────┘    └──────┬──────┘         └─────┬────┘    └──────┬───────┘
       │ (fail) ─ ─ ─ ─▶│                      │ (fail) ─ ─ ─ ─▶│
       └────────┬───────┘                      └────────┬───────┘
                ▼                                       ▼
        ┌────────────────┐                    ┌──────────────────┐
        │ Embed (text-   │                    │ Embed each sub-q │
        │ embedding-004) │                    │ (text-embed-004) │
        └────────┬───────┘                    └────────┬─────────┘
                 └──────────────┬─────────────────────┘
                                ▼
                    ┌─────────────────────────────┐
                    │ Phase 1: Over-fetch         │
                    │ top_k × 4 cosine candidates │
                    └─────────────┬───────────────┘
                                  ▼
                    ┌─────────────────────────────┐
                    │ Merge + dedupe              │
                    │ across sub-queries          │
                    └─────────────┬───────────────┘
                                  ▼
                    ┌─────────────────────────────┐
                    │ Cross-encoder rerank        │
                    │ BAAI/bge-reranker-v2-m3     │
                    │ scored vs ORIGINAL query    │
                    └─────────────┬───────────────┘
                                  │ (fail) ─ ─ ─▶ fall back to embedding scores
                                  ▼
                    ┌─────────────────────────────┐
                    │   Final top-K chunks        │
                    └─────────────────────────────┘

  Legend:  ─ ─ ─ ─▶  graceful-degradation fallback path on failure
```

> Dashed arrows = graceful degradation paths (HyDE fails → raw query · decomposition fails → single query · reranker fails → embedding scores).

| Phase | Technique | Where | Default | Env flag |
|-------|-----------|-------|---------|----------|
| 1 | **Cross-encoder rerank** — over-fetch `top_k × 4` candidates, rerank with `cross-encoder/ms-marco-MiniLM-L-6-v2` | `rag_service.retrieve(rerank=True)` | on | — (opt out per-call) |
| 2 | **Query decomposition** — split compound questions ("compare X and Y") into atomic sub-questions via a cheap FAST_MODEL call, retrieve per sub-question, merge + dedupe, final rerank against the *original* query | `rag_multistep.retrieve_multistep()` | on | `RAG_MULTISTEP_ENABLED` |
| 3 | **HyDE** — for terse queries (< `RAG_HYDE_MIN_TOKENS`), generate a hypothetical answer and embed *that* instead of the raw query | `rag_multistep._hyde_embedding()` | on | `RAG_HYDE_ENABLED`, `RAG_HYDE_MIN_TOKENS` |

Scoped endpoints (study material generation, grading, study plan) intentionally skip multi-step — their inputs are already narrow and the extra LLM call would add latency without a quality win.

All stages degrade gracefully: reranker load failure falls back to embedding scores; decomposition failure falls back to the original query; HyDE failure falls back to the raw query embedding.

Evaluate pipeline variants from `backend/`: `venv/Scripts/python.exe -m tests.rag_eval`. The harness reports recall@5 for baseline / phase 1 / full multistep against the cases in `GOLDEN_SET`.

**Reranker model** is configurable via `RAG_RERANKER_MODEL` (default `BAAI/bge-reranker-v2-m3` — multilingual). For English-only workloads, override to `cross-encoder/ms-marco-MiniLM-L-6-v2` for a smaller/faster model. **Embedding model** via `GEMINI_EMBED_MODEL` (default `gemini-embedding-001`) and `GEMINI_EMBED_DIM` (default 768).

### Indexing

PDF extraction uses `pdfplumber` with a `PyPDF2` fallback. Module items referencing remote URLs are fetched and extracted automatically (only responses with `content-type: application/pdf` or `.pdf` URLs). If both extraction paths fail, the indexer stores `title + url` as a last resort — these thin passages degrade retrieval quality, so watch indexing logs and verify chunk size. After code changes that affect extraction, re-index with `POST /api/rag-admin/reindex/{course_id}` (or wait for the 2 AM nightly job).

### Multi-Agent Architecture (Agentic Fan-Out / Fan-In)

Data-intensive endpoints use a **fan-out / fan-in** pattern (`backend/app/multi_agent.py`) to run independent Firestore reads and retrieval calls in parallel via `asyncio.gather`, with per-agent error isolation.

```
                    ┌────────────────────────┐
                    │ Incoming API request   │
                    └───────────┬────────────┘
                                ▼
                    ┌────────────────────────┐
                    │   Router endpoint      │
                    └───────────┬────────────┘
                                ▼
            ┌───────────────────────────────────────┐
            │ fan_out({"name": coroutine, ...})     │
            │ asyncio.gather  ·  timeout = 30s      │
            └────┬─────────┬──────────┬─────────┬───┘
                 │         │          │         │   (parallel dispatch)
                 ▼         ▼          ▼         ▼
        ┌────────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
        │ Agent 1    │ │ Agent 2│ │ Agent 3│ │ Agent N    │
        │ submission │ │ rubric │ │ class  │ │ rag_agent  │
        │  _agent    │ │ _agent │ │ _stats │ │ kg_agent   │
        └─────┬──────┘ └────┬───┘ └────┬───┘ └─────┬──────┘
              │             │          │           │
              ▼             ▼          ▼           ▼
        ┌───────────────────────────────────────────────┐
        │  per-agent try/except isolation               │
        │  failure  →  result["_error"] = "..."         │
        │  other agents' results still used downstream  │
        └────────────────────────┬──────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │ fan-in: dict of results│
                    │ (get_or_default helper │
                    │  for safe extraction)  │
                    └───────────┬────────────┘
                                ▼
                    ┌────────────────────────┐
                    │ Synthesizer            │
                    │ Gemini SMART_MODEL     │
                    │  ─ GAG (artifact)      │
                    │  ─ Chat (free-text)    │
                    │  ─ Graph (nodes+edges) │
                    └───────────┬────────────┘
                                ▼
                    ┌────────────────────────┐
                    │ Response + token usage │
                    │ (aiUsageSummary write) │
                    └────────────────────────┘
```

| Endpoint | File | Agents (parallel) | Synthesizer |
|----------|------|--------------------|-------------|
| **AI Grading** | `ai_grading.py` | `submission_agent`, `assignment_agent`, `class_stats_agent` | GAG grading report |
| **Daily Study Guide** | `ai_study_plan.py` | `courses`, `deadlines`, `performance`, `timetables` | RAG → GAG study plan artifact |
| **Companion Chat** | `ai_companion.py` | `courses`, `deadlines`, `performance`, `timetables`, `reminders` | RAG multistep → Gemini chat |
| **Plagiarism Network** | `ai_plagiarism.py` | `assignment_verify`, `similarity_graph_build` | cluster detection → GAG narrative |
| **Mind Map Buddy** | `ai_mindmap_buddy.py` | `rag_agent`, `kg_agent` (recommend-nodes + suggest-all) | Gemini / GAG graph suggestions |

**How it works**: `fan_out({"name": coroutine, ...})` dispatches all agents concurrently. Each agent is wrapped in error isolation — if one fails, its result becomes `{"_error": "..."}` and other agents' results are still used. `get_or_default(results, key, fallback)` safely extracts values. Timeout defaults to 30s.

**Not multi-agent** (skip — single-call, scoped input): study materials, quiz generation, timetable analysis, course import, image generation.

### Knowledge Graph BFS (used by Mind Map Buddy + Plagiarism Network)

`knowledge_graph_service.py` builds a per-course concept graph from RAG-indexed content (nightly 3 AM job), persisted in `knowledgeGraphs`. Mind Map Buddy walks the graph from the user's current map nodes; Plagiarism Network uses it to filter "shared concept" matches that aren't true plagiarism.

```
   knowledgeGraphs/{courseId}  (rebuilt nightly 3 AM by Gemini concept extraction)
   ┌──────────────────────────────────────────────────────────────────────┐
   │                                                                      │
   │      (Mitochondria) ── (Cellular Respiration)                        │
   │                                                                      │
   │      (Chlorophyll)                                                   │
   │            │                                                         │
   │            └──── (Photosynthesis) ──── (Light Reaction)              │
   │                       │                       │                      │
   │                       └────── (Calvin Cycle) ─┘                      │
   │                                                                      │
   └──────────────────────────────────────────────────────────────────────┘
                                ▲
                                │ BFS, depth = 2
                                │
   ┌─────────────────────────────────────────────┐
   │ Mind Map Buddy seed                         │
   │ User's currently selected node:             │
   │   "Photosynthesis"                          │
   └─────────────────────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────┐
   │ BFS-discovered neighbours (within 2 hops):  │
   │   Chlorophyll, Light Reaction, Calvin Cycle │
   │   (Mitochondria & Cellular Respiration      │
   │    are unreachable → not suggested)         │
   └─────────────────────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────┐
   │ + RAG citations (1 chunk per suggestion)    │
   │   pulled from indexed course materials      │
   └─────────────────────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────┐
   │ GAG graph artifact returned to client:      │
   │ { nodes: [...],                             │
   │   edges: [...],                             │
   │   sources: [{nodeId, chunkRef, …}] }        │
   └─────────────────────────────────────────────┘
```

### Background Jobs
- **RAG Indexing**: Nightly at 2 AM UTC via APScheduler — indexes all course content into ChromaDB
- **Knowledge Graph Rebuild**: Nightly at 3 AM — extracts concepts and relationships from indexed content using Gemini

### AI Caching Strategy (layered)

```
                                  ┌──────────────────────┐
                                  │  AI request          │
                                  │  (any of 11 features)│
                                  └──────────┬───────────┘
                                             ▼
                          ┌─────────────────────────────────────┐
                          │ Compute hash key                    │
                          │  (userId+date | textHash |          │
                          │   examsHash | promptHash | …)       │
                          └────────────────┬────────────────────┘
                                           ▼
                          ┌─────────────────────────────────────┐
                          │  Hash key present in cache layer?   │
                          └────────┬───────────────────┬────────┘
                                   │ HIT               │ MISS
                                   ▼                   ▼
                  ┌───────────────────────┐   ┌──────────────────────────────┐
                  │ Return cached result  │   │ Within aiDailyUsage limit?   │
                  │ → 0 Gemini tokens     │   │ (per-user override OR        │
                  │ → 0 latency           │   │  global default in aiConfig) │
                  └───────────┬───────────┘   └────────┬─────────────┬───────┘
                              │                        │ YES         │ NO
                              │                        ▼             ▼
                              │              ┌─────────────────┐ ┌────────────┐
                              │              │ Call Gemini     │ │ 429 Quota  │
                              │              │ (SMART or FAST  │ │ exceeded   │
                              │              │  per feature)   │ └────────────┘
                              │              └─────────┬───────┘
                              │                        ▼
                              │              ┌─────────────────────────────┐
                              │              │ Record tokens               │
                              │              │  · aiUsageSummary (per user │
                              │              │    × per feature aggregate) │
                              │              │  · aiDailyUsage (today)     │
                              │              └─────────┬───────────────────┘
                              │                        ▼
                              │              ┌─────────────────────────────┐
                              │              │ Write into matching cache   │
                              │              │ collection (TTL'd)          │
                              │              └─────────┬───────────────────┘
                              │                        │
                              └────────────┬───────────┘
                                           ▼
                              ┌─────────────────────────────┐
                              │  Response sent to client    │
                              └─────────────────────────────┘

   ── Cache layers consulted (Firestore, TTL'd by hash key) ────────────────────────
      aiDailyGuideCache                24h     · per userId + YYYY-MM-DD
      aiTimetableCache                 30d     · per textHash
      aiExamPlanCache                  perm    · per examsHash
      aiImportCache                    24h     · per URL
      aiCompanionQuestionCache         7d      · GLOBAL (shared across all users)
      aiImageCache                     7d      · per (prompt + style) hash
      aiElaborationCache               30d     · image-prompt elaboration step
      aiMapAnalysisCache               2h      · per map contentHash
      aiNodeRecsCache                  24h     · per cacheKey hash
      generatedStudyMaterials          7d dedup· per (user, course, type, topic)
      aiGradeRecommendations           once    · per submission
      aiPlagiarismReports              once    · per submission
```

---

## Cross-Cutting Feature Flows

### Social Graph (follow + feed)

```
   Student A      FastAPI            Firestore        notify()      email_service    Student B
   (follower)     /api/social                                       (daemon thread)  (followed)
       │              │                  │                │              │              │
       │ POST         │                  │                │              │              │
       │ /follow/{B}  │                  │                │              │              │
       │─────────────▶│                  │                │              │              │
       │              │ _require_student(A) & (B)         │              │              │
       │              │                  │                │              │              │
       │              │ get follows/{A_B}│                │              │              │
       │              │─────────────────▶│                │              │              │
       │              │   exists?        │                │              │              │
       │              │◀─────────────────│                │              │              │
       │              │                  │                │              │              │
       │   ┌──────────┴──── if YES ──────┘                │              │              │
       │   │ { already_following: true }                  │              │              │
       │◀──┘                                              │              │              │
       │                                                  │              │              │
       │              │ if NO  →  set follows/{A_B}       │              │              │
       │              │         + Increment counters      │              │              │
       │              │         (followerCount,           │              │              │
       │              │          followingCount)          │              │              │
       │              │─────────────────▶│                │              │              │
       │              │                  │                │              │              │
       │              │ create_notification("A started following you")  │              │
       │              │─────────────────────────────────▶ │              │              │
       │              │                  │                │ write notif. │              │
       │              │                  │◀───────────────│              │              │
       │              │                  │                │ spawn thread │              │
       │              │                  │                │─────────────▶│              │
       │              │                  │                │              │ SMTP send    │
       │              │                  │                │              │─────────────▶│
       │  201 Created │                  │                │              │              │
       │◀─────────────│                  │                │              │              │
                              ─── (later, feed read) ───
       │ GET /feed    │                  │                │              │              │
       │─────────────▶│                  │                │              │              │
       │              │ list following IDs (chunked by 30 — Firestore in cap)          │
       │              │─────────────────▶│                │              │              │
       │              │ query maps where ownerId in [...] AND visibility=public        │
       │              │─────────────────▶│                │              │              │
       │              │ maps[]           │                │              │              │
       │              │◀─────────────────│                │              │              │
       │ maps newest-first + like/comment counts          │              │              │
       │◀─────────────│                  │                │              │              │
```

### Course Learning Plan (CLP) Pipeline

```
  ┌──────────┐   upload syllabus    ┌────────────────────────┐
  │ Lecturer │─── PDF ─────────────▶│ POST /api/clp/upload   │
  └──────────┘                      └────────────┬───────────┘
                                                 ▼
                                ┌──────────────────────────────────┐
                                │ clpFileHashes — cache lookup     │
                                │ key = SHA-256(pdf bytes)         │
                                └────────┬─────────────┬───────────┘
                                         │ HIT         │ MISS
                                         ▼             ▼
                                  ┌──────────┐   ┌─────────────────────────────┐
                                  │ Return   │   │ services/clp/parser.py      │
                                  │ cached   │   │ pdfplumber → PyPDF2 fallback│
                                  │ weeks    │   └────────────┬────────────────┘
                                  └────┬─────┘                ▼
                                       │             ┌─────────────────────────────┐
                                       │             │ services/clp/gemini_service │
                                       │             │ FAST_MODEL extracts         │
                                       │             │ week-by-week topics         │
                                       │             └────────────┬────────────────┘
                                       │                          ▼
                                       │             ┌─────────────────────────────┐
                                       │             │ Persist:                    │
                                       │             │  · clpDrafts/{sid}          │
                                       │             │  · clpExtractionResults     │
                                       │             │  · clpFileHashes (cache)    │
                                       │             └────────────┬────────────────┘
                                       └────────────┬─────────────┘
                                                    ▼
                                ┌──────────────────────────────────┐
                                │ Lecturer configures:             │
                                │  · attendance counts             │
                                │  · exception weeks               │
                                │    (MID-SEM, FINALS,             │
                                │     CUTI, MINGGU ULANGKAJI)      │
                                └────────────┬─────────────────────┘
                                             ▼
                                ┌──────────────────────────────────┐
                                │ POST /api/clp/generate           │
                                └────────────┬─────────────────────┘
                                             ▼
                                ┌──────────────────────────────────┐
                                │ services/clp/excel_generator.py  │
                                │ build .xlsx with openpyxl        │
                                └────────────┬─────────────────────┘
                                             ▼
                                ┌──────────────────────────────────┐
                                │ POST /api/clp/download           │
                                │ → stream xlsx to browser         │
                                └──────────────────────────────────┘
```

### Admin Broadcast Announcements (SMTP fan-out)

```
  ┌────────┐   compose subject + body
  │ Admin  │   pick audience
  └───┬────┘
      │
      ▼
  ┌──────────────────────────────────┐
  │ POST /api/admin/announcements    │
  └────────────┬─────────────────────┘
               ▼
  ┌──────────────────────────────────┐
  │  audience ?                      │
  └─┬──────┬──────────┬──────────┬───┘
    │      │          │          │
    │ all  │ students │ lecturers│ specific
    ▼      ▼          ▼          ▼
  ┌────┐ ┌────────┐ ┌────────┐ ┌────────────────┐
  │all │ │role==  │ │role==  │ │resolve         │
  │usrs│ │student │ │lecturer│ │user_ids[] from │
  │    │ │        │ │        │ │request body    │
  └─┬──┘ └───┬────┘ └────┬───┘ └────────┬───────┘
    └────────┴───────────┴──────────────┘
                       ▼
              ┌────────────────────┐
              │   recipients[]     │
              └─────────┬──────────┘
                        ▼
        ┌─────────────────────────────────────────┐
        │  for r in recipients:                   │
        │     ┌─────────────────────────────────┐ │
        │     │ spawn daemon Thread             │ │
        │     │ send_notification_email(r)      │ │
        │     │  → SMTP server (port 587 TLS)   │──┼──▶ recipient inbox
        │     └─────────────────────────────────┘ │     (best-effort, no retry)
        │  (each send is fire-and-forget — does   │
        │   not block the request handler)        │
        └─────────────────────┬───────────────────┘
                              ▼
              ┌────────────────────────────────────┐
              │ set adminAnnouncements/{id}        │
              │  · audience                        │
              │  · subject + body                  │
              │  · recipientCount                  │
              │  · recipientIds (specific only)    │
              │  · sentBy / sentByName / createdAt │
              └─────────────────┬──────────────────┘
                                ▼
              ┌────────────────────────────────────┐
              │ audit_log(action="broadcast",      │
              │           resource_type="announce")│
              └─────────────────┬──────────────────┘
                                │ 201 Created
                                ▼
                        Admin (response)
```

### Mind Map Real-Time Collaboration

```
   User 1 (editor)         FastAPI /api/maps          Firestore         User 2 (editor)
        │                         │                       │                   │
        │ PATCH /maps/{id}        │                       │                   │
        │ (every 5s, debounced    │                       │                   │
        │  on graph change)       │                       │                   │
        │────────────────────────▶│                       │                   │
        │                         │ write maps/{id}.      │                   │
        │                         │  graphData            │                   │
        │                         │ append mapHistory     │                   │
        │                         │──────────────────────▶│                   │
        │                         │                       │                   │
        │                         │                       │ GET /maps/{id}    │
        │                         │                       │ (every 4s poll)   │
        │                         │                       │◀──────────────────│
        │                         │                       │ read maps/{id}    │
        │                         │◀──────────────────────│                   │
        │                         │ merged React Flow JSON│                   │
        │                         │──────────────────────────────────────────▶│
        │                         │                       │                   │
        │ POST                    │                       │                   │
        │ /maps/{id}/presence     │                       │                   │
        │────────────────────────▶│                       │                   │
        │                         │                       │ POST              │
        │                         │                       │ /maps/{id}/       │
        │                         │                       │  presence         │
        │                         │◀──────────────────────│                   │
        │                         │                       │                   │
        │ GET                     │                       │                   │
        │ /maps/{id}/presence     │                       │                   │
        │────────────────────────▶│                       │                   │
        │ list of active editors  │                       │                   │
        │ with cursor positions   │                       │                   │
        │◀────────────────────────│                       │                   │
                              ─── note ───
   Conflict policy = last-write-wins (no OT/CRDT — sufficient for
   classroom scale; future work item if simultaneous high-frequency
   edits become a real workload).
```

---

## Design System

### Web
- **Theme**: Dark/Light mode with glassmorphism, toggled per user (persisted via Firebase)
- **Dark Mode**: Deep navy backgrounds (dark-900 `#080c1a`), frosted glass cards, white text
- **Light Mode**: Light gray backgrounds (`#f4f6fb`), white glass cards, dark text
- **Brand Colors**: IPG Navy (`#1B2A80`), Royal Blue (`#2E4DA7`), Sky Blue (`#5B9BD5`)
- **Accents**: blue, purple, cyan, pink, emerald, amber
- **Student accent**: Blue gradients | **Lecturer accent**: Purple gradients
- **Components**: `glass-card`, `glass-input`, `btn-gradient`, `text-gradient`, `bg-mesh`
- **Animations**: Framer Motion page transitions, `layoutId` sidebar, `AnimatePresence` modals

### Mobile
- **Theme**: Material Design 3 with dark/light mode, `AppColors.dark` and `AppColors.light` palettes
- **Theme Transition**: Expanding circle clip animation on toggle 
- **Dark Mode**: Deep navy (`#0A0A1A`), glass card decorations with white/5 borders
- **Light Mode**: Light surfaces (`#F4F6FB`), elevated cards with subtle shadows
- **Navigation**: 5-tab `FloatingNavBar` with animated selection indicator + floating AI companion FAB
- **Animations**: `FadeSlideIn` wrappers, `OpenContainerWrapper` for Material transitions, Rive login animation, shimmer loading placeholders
- **Cards**: `AppTheme.glassCard()` context-aware decoration (glass in dark, shadow in light)
- **Typography**: Google Fonts Inter, consistent text hierarchy
- **i18n**: English / Bahasa Melayu via `S.of(context)` accessor, locale persisted in SharedPreferences
- **Tutorial**: First-time spotlight overlay with step-by-step guidance and skip option

---

## Roles

- **Student**: Join courses, submit assignments, take quizzes, view grades, peer review, earn badges, create mind maps, claim certificates, use forum, view attendance, private messaging, calendar, notifications, follow other students, share & like maps, comment on maps, browse explore/feed
- **Lecturer**: Create courses, post assignments/quizzes, grade with rubrics, track attendance/completion, moderate forums, manage groups + group tasks, view analytics, private messaging, generate Course Learning Plans (CLP) from syllabus PDFs
- **Admin**: Manage users and roles, edit homepage content, view audit logs, edit badge catalog, broadcast email announcements, view platform-wide AI usage and set per-user / global AI token caps and image quotas, view usage analytics

---

## Badges (Auto-Awarded)

| Badge ID | Name | Criteria |
|----------|------|----------|
| `cartographer` | Cartographer | Create 1 mind map |
| `map_master` | Map Master | Create 5 mind maps |
| `on_fire` | On Fire | 3-day activity streak |
| `unstoppable` | Unstoppable | 7-day activity streak |
| `top_marks` | Top Marks | Score 90%+ on any assignment |
| `early_bird` | Early Bird | Submit assignment 24h before deadline |
| `quiz_whiz` | Quiz Whiz | Score 100% on any quiz |
| `helper` | Helper | Give 5 peer reviews |
| `completionist` | Completionist | Complete all items in any course |

---

## Backend Modules (40 mounted routers, 41 router files)

All backend routers are located in `backend/app/routers/`. `auto_badges.py` is helpers-only (no endpoints) and is not mounted on the FastAPI app:

| # | Module | File | Description |
|---|--------|------|-------------|
| 1 | **Auth** | `auth.py` | Firebase token verification + user sync to Firestore |
| 2 | **Users** | `users.py` | Profile + avatar + cover photo upload |
| 3 | **Maps** | `maps.py` | Mind map CRUD + collaboration + presence + annotations + node image upload + view tracking + history + visitors |
| 4 | **Courses** | `courses.py` | Course CRUD + enrollment + student search + recently-viewed |
| 5 | **Assignments** | `assignments.py` | Assignment CRUD + conditional access + file upload submissions |
| 6 | **Quizzes** | `quizzes.py` | Quiz CRUD + auto-grading + attempts + results |
| 7 | **Gradebook** | `gradebook.py` | Weighted gradebook + student reports + CSV export + grade settings |
| 8 | **Rubrics** | `rubrics.py` | Grading rubrics + criterion-based grading |
| 9 | **Peer Reviews** | `peer_review.py` | Peer review submissions + ratings + comments |
| 10 | **Discussions** | `discussions.py` | Real-time class chat + threaded replies |
| 11 | **Discussion Topics** | `discussion_topics.py` | Topic-based forum with pinning + moderator controls |
| 12 | **Announcements** | `announcements.py` | Course announcements CRUD |
| 13 | **Resources** | `resources.py` | Resource modules + file uploads + progress tracking + template cloning |
| 14 | **Attendance** | `attendance.py` | Session-based attendance tracking + bulk update |
| 15 | **Certificates** | `certificates.py` | Course completion certificates + verification |
| 16 | **Completion** | `completion.py` | Course completion tracking + per-student analytics |
| 17 | **Groups** | `groups.py` | Student groups + auto-assign via round-robin |
| 18 | **Group Tasks** | `group_tasks.py` | Per-course group-task containers with auto-assigned subgroups |
| 19 | **Messaging** | `messaging.py` | Private messaging + conversations + user search |
| 20 | **Notifications** | `notifications.py` | In-app notifications + FCM token registration + grouped feed |
| 21 | **Activity** | `activity.py` | Activity feed + weekly reflections |
| 22 | **Analytics** | `analytics.py` | Lecturer analytics: engagement heatmap, at-risk students, submission trends |
| 23 | **Progress** | `progress.py` | Course progress + calendar events |
| 24 | **Participation** | `participation.py` | Participation scoring per course |
| — | _Auto Badges_ | `auto_badges.py` | Helper module — automatic badge engine called from other routers (no endpoints) |
| 25 | **Badges** | `badges.py` | Manual badge award/revoke management |
| 26 | **Reminders** | `reminders.py` | Personal planner tasks CRUD |
| 27 | **Stats** | `stats.py` | Study activity heatmap + monthly comparison |
| 28 | **Social** | `social.py` | Followers, feed, explore, suggested, map likes & comments (students-only) |
| 29 | **Admin** | `admin.py` | User mgmt + audit logs + homepage CMS + AI usage/quotas + broadcast announcements (SMTP) |
| 30 | **AI Companion** | `ai_companion.py` | Standard RAG — AI study companion chat with course material retrieval + citations + learning profile |
| 31 | **AI Study Plan** | `ai_study_plan.py` | RAG+GAG (Generation) — AI daily guide with difficulty ratings, resource links, suggested activities + exam planner + timetable analysis |
| 32 | **AI Study Materials** | `ai_study_materials.py` | Standard RAG — summaries, flashcards, quizzes from resources + topic-based multi-source generation |
| 33 | **AI Plagiarism** | `ai_plagiarism.py` | RAG+GAG (Graph) — plagiarism detection + assignment-wide network analysis with similarity clustering |
| 34 | **AI Grading** | `ai_grading.py` | RAG+GAG (Generation) — grade recommendations with comparative analysis + improvement suggestions |
| 35 | **AI Images** | `ai_images.py` | AI educational image/diagram generation (Gemini 2.0 Flash Image, Imagen 3 fallback) — 1/day quota, 7-day prompt dedup |
| 36 | **AI Import** | `ai_import.py` | AI content import helpers |
| 37 | **AI Mind Map Buddy** | `ai_mindmap_buddy.py` | RAG+GAG (Graph) — mind map assistant with knowledge graph traversal, source-attributed node suggestions |
| 38 | **RAG Admin** | `rag_admin.py` | Manual RAG indexing triggers + index status per course |
| 39 | **Site Import** | `site_import.py` | Google Site / external LMS preview + execute + course KB lookup |
| 40 | **CLP** | `clp.py` | Course Learning Plan — PDF upload → AI parse → configure → Excel generation |

### Backend Service Packages (`backend/app/services/`)

| Package | Purpose |
|---------|---------|
| `email_service.py` | SMTP transactional emails (broadcast announcements, new-follower notifications). Each send runs on a daemon thread; missing SMTP env vars makes the helper a no-op so callers never break |
| `canva_service.py` | Canva integration helper |
| `clp/` | CLP pipeline internals — `parser.py` (PDF → weeks), `gemini_service.py` (topic extraction), `excel_generator.py` (build .xlsx), `storage.py` (drafts), `config.py` |

### Frontend Modules

#### Map Editor Components (`frontend-web/src/components/map-editor/`)

| Module | File | Description |
|--------|------|-------------|
| **Custom Nodes** | `custom-nodes.tsx` | 21 node types (ShapeNode, TextNode, ImageNode, GroupNode) with 18 SVG shapes, ResizeObserver, inline editing, gradients |
| **Custom Edges** | `custom-edges.tsx` | 4 edge types (bezier, straight, step, elbowed) + 6 marker types (arrow, openArrow, thinArrow, block, diamond, circle) + dynamic color markers |
| **Shape Palette** | `shape-palette.tsx` | Left sidebar with categorized shapes (Basic, Flowchart, Creative, Special) + 13 templates |
| **Properties Panel** | `properties-panel.tsx` | Right sidebar for node/edge properties: style, text, gradient, image upload, alignment, layers |
| **Templates** | `templates.ts` | 13 templates: Hierarchical, Spider, Bubble, Tree, Flowchart, SWOT, KWL, Cause & Effect, Timeline, Org Chart, Process Map, Venn Diagram, Cornell Notes |
| **Map Editor** | `map-editor.tsx` | Main editor with React Flow, toolbar, undo/redo history, drag-and-drop, keyboard shortcuts |
| **Persistence** | `use-map-persistence.ts` | Auto-save with 5s debounce, load/save to API |
| **Collaboration** | `use-collaboration.ts` | Real-time collaboration with presence, cursor sharing |
| **Keyboard Shortcuts** | `use-keyboard-shortcuts.ts` | Ctrl+Z/Y, Ctrl+C/V/X, Ctrl+D, Delete, arrow nudge |
| **Alignment Utils** | `alignment-utils.ts` | Node alignment (left/center/right/top/bottom), distribute, z-index reorder |
| **Share Modal** | `share-modal.tsx` | Share maps via code, manage collaborators |
| **Map Viewer** | `map-viewer.tsx` | Read-only map viewer for review |
| **Lecturer Viewers** | `lecturer-viewers.tsx` | Lecturer-specific map viewing and annotation tools |
| **Annotation Layer** | `annotation-layer.tsx` | Overlay for map annotations and red-pen notes |
| **Edge Routing** | `edge-routing.ts` | Smart edge routing and pathfinding algorithms |
| **History Panel** | `history-panel.tsx` | Map version history and undo/redo timeline |
| **Mind Map Buddy** | `mindmap-buddy.tsx` | AI-powered context-aware node suggestions during editing |
| **Recommendation** | `recommendation-sidebar.tsx` | AI-powered structure recommendations |
| **Presence** | `presence-indicators.tsx` | Show active collaborator avatars |
| **Export** | `export-map.ts` | PNG/PDF export via html-to-image + jsPDF |

#### API Client Namespaces (`frontend-web/src/lib/api.ts`)

| Namespace | Description |
|-----------|-------------|
| `authApi` | Firebase token sync, current user |
| `usersApi` | Profile update, avatar + cover photo upload, get user |
| `socialApi` | Follow/unfollow, followers, following, profile, feed, trending, suggested, user search, map likes & comments |
| `mapsApi` | Map CRUD, search (by code / email / course / students / public-by-user), collaborators, presence, annotations, history, view tracking, image upload |
| `coursesApi` | Course CRUD, enrollment, students, search, recently-viewed |
| `assignmentsApi` | Assignment CRUD, submissions, grading, file upload, similarity report |
| `quizzesApi` | Quiz CRUD, questions, attempts, results |
| `gradebookApi` | Student/course gradebook, settings, reports, CSV export |
| `rubricsApi` | Rubric CRUD, criterion-based grading |
| `peerReviewApi` | Submit reviews, get reviews per assignment/submission |
| `discussionsApi` | Class chat messages + threaded replies |
| `topicsApi` | Forum topics CRUD, pin toggle, posts |
| `announcementsApi` | Announcements CRUD |
| `modulesApi` | Resource modules, items, file upload, progress tracking, template cloning |
| `attendanceApi` | Sessions, records, bulk update, student attendance |
| `certificatesApi` | Student certs, claim, verify |
| `completionApi` | Per-student completion, summary |
| `groupsApi` | Group CRUD, members, auto-assign |
| `groupTasksApi` | Group-task containers + auto-assigned subgroups |
| `messagingApi` | Conversations, messages, user search |
| `notificationsApi` | List, grouped feed, mark read, delete, FCM token |
| `activityApi` | Activity feed |
| `reflectionsApi` | Weekly reflections |
| `progressApi` | Course progress, calendar events |
| `participationApi` | Participation scores |
| `statsApi` | Study activity, monthly comparison, map type distribution |
| `analyticsApi` | Lecturer analytics, heatmap, at-risk students |
| `badgesApi` | Award/revoke badges |
| `remindersApi` | Planner task CRUD |
| `adminApi` | User mgmt, audit logs, homepage CMS, AI usage + per-user/global token caps, image quotas, broadcast announcements (incl. recipient resolution) |
| `homepageApi` | Public homepage content |
| `aiCompanionApi`, `aiStudyMaterialsApi`, `aiStudyPlanApi`, `aiPlagiarismApi`, `aiGradingApi`, `aiImagesApi`, `aiImportApi`, `aiMindmapBuddyApi` | AI feature clients (one per AI router) |
| `siteImportApi` | Google Site preview/execute + course KB |
| `clpApi` | CLP upload, generate, drafts, download |

---

## Development Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `start-backend.sh` | Start FastAPI backend only | `bash start-backend.sh` |
| `start-frontend-web.sh` | Start Next.js web frontend only | `bash start-frontend-web.sh` |
| `start-frontend-mobile.sh` | Start Flutter mobile app only | `bash start-frontend-mobile.sh [device_id]` |
| `start-dev.sh` | Start all servers (backend + web + mobile emulator) | `bash start-dev.sh` |
| `start-dev-mobile.sh` | Start all servers + USB device | `bash start-dev-mobile.sh` |
| `start-dev-mobile-wireless.sh` | Start all servers + wireless device | `bash start-dev-mobile-wireless.sh` |

### Environment Variables

| Variable | Location | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `frontend-web/.env.local` | `http://localhost:8000/api` | Backend API URL for web frontend |
| `SECRET_KEY` | Backend environment | `mysmartstudy-secret` | JWT secret (fallback) |
| `DATABASE_URL` | Backend environment | SQLite | Database connection string |
| `GEMINI_API_KEY` | Backend environment | — | Google Gemini API key for AI features |
| `GOOGLE_APPLICATION_CREDENTIALS` | Backend environment | `./serviceAccountKey.json` | Path to Firebase Admin SDK credentials |
| `GCS_BUCKET` | Backend environment (Cloud Run) | — | Google Cloud Storage bucket name (e.g. `mysmartstudy-uploads`) for persistent admin/homepage uploads. Required in production — Cloud Run's local `uploads/` disk is ephemeral and files are lost on each revision restart |
| `CORS_ORIGINS` | Backend environment | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of allowed CORS origins; add the deployed web URL in production |
| `FRONTEND_URL` | Backend environment | Cloud Run URL | Used as the base URL in transactional email CTAs |
| `SMTP_HOST` | Backend environment | — | SMTP server host for transactional + broadcast emails. Empty disables email entirely (helpers no-op) |
| `SMTP_PORT` | Backend environment | `587` | SMTP server port |
| `SMTP_USER` | Backend environment | — | SMTP username (also used as From if `SMTP_FROM` unset) |
| `SMTP_PASSWORD` | Backend environment | — | SMTP password / app password |
| `SMTP_FROM` | Backend environment | `SMTP_USER` | "From" address for outgoing emails |
| `RAG_MULTISTEP_ENABLED` | Backend environment | `1` | Toggle multi-step retrieval (decomposition + rerank) |
| `RAG_HYDE_ENABLED`, `RAG_HYDE_MIN_TOKENS` | Backend environment | `1`, `5` | Toggle HyDE for terse queries; min token threshold |
| `RAG_RERANKER_MODEL` | Backend environment | `BAAI/bge-reranker-v2-m3` | Cross-encoder reranker model |
| `GEMINI_EMBED_MODEL`, `GEMINI_EMBED_DIM` | Backend environment | `gemini-embedding-001`, `768` | Embedding model + dimension |

### Mobile API Configuration

The Flutter mobile app connects to the backend via `ApiService._base`:
- **Android Emulator**: `http://10.0.2.2:8000/api` (maps to host localhost)
- **Physical Device (USB)**: `http://<your-ip>:8000/api` (requires `--host 0.0.0.0`)
- **Physical Device (Wireless)**: Same as USB but over Wi-Fi

---

## License

This project is developed for educational purposes at **Universiti Kuala Lumpur Malaysian Institute of Information Technology (UniKL MIIT)** as a Final Year Project, with **IPG Kampus Perempuan Melayu Melaka** as the client and target deployment institution.
