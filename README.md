# MySmartStudy

> **An AI-Enhanced Collaborative Learning Management System with Mind Map Integration**
> Designed and developed for IPG Kampus Perempuan Melayu Melaka as a Final Year Project (FYP).

A full-stack, AI-enhanced LMS (Learning Management System) for students and lecturers at IPG Kampus Perempuan Melayu Melaka. Provides feature-complete course management, real-time collaborative mind mapping, AI study companion (Google Gemini 2.5 Flash + RAG pipeline), gamification with automated badge engine, quizzes with question banks, grading rubrics, peer reviews, discussion forums, attendance tracking, certificates, private messaging, and a dark/light glassmorphism UI across web and mobile platforms with bilingual support (English/Bahasa Melayu). AI token usage is optimised through multi-tier caching and nightly RAG batch re-indexing.

**For the full AI architecture with PlantUML diagrams, see [`AI-Architecture.md`](./AI-Architecture.md).**

**For the full project abstract and academic overview, see [`abstract.md`](./abstract.md).**

## Architecture

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
| **File Storage** | Firebase Storage (AI images) + local disk (avatars, uploads) | Cloud / `uploads/` |
| **Auth** | Firebase Authentication (email/password) | Cloud |

### How It Works

1. **Firebase Auth** handles user registration and login on all platforms
2. The **FastAPI backend** (41 routers) verifies Firebase ID tokens and serves a REST API
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
      routers/                 # 41 route handlers
        auth.py                # Firebase token verification + user sync
        users.py               # Profile management + avatar upload
        maps.py                # Mind map CRUD + collaboration + presence
        courses.py             # Course CRUD + enrollment + student management
        assignments.py         # Assignment CRUD + conditional access
        quizzes.py             # Quiz CRUD + auto-grading + attempts
        question_bank.py       # Reusable question pool per course
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
        completion.py          # Course completion tracking + analytics
        auto_badges.py         # Automatic badge engine (9 criteria)
        messaging.py           # Private messaging + conversations
        notifications.py       # In-app notifications + FCM tokens
        activity.py            # Activity feed + reflections
        analytics.py           # Lecturer analytics dashboard
        progress.py            # Course progress + calendar events
        reminders.py           # Personal planner tasks
        participation.py       # Participation scoring
        admin.py               # User management + audit logs + homepage editor
        stats.py               # Study activity + monthly comparison
        ai_companion.py        # AI study companion chat + learning profile
        ai_study_plan.py       # AI daily guide + exam planner + timetable analysis
        ai_study_materials.py  # AI-generated summaries, flashcards, practice quizzes
        ai_plagiarism.py       # AI plagiarism detection for submissions
        ai_grading.py          # AI grade recommendations for lecturers
        ai_images.py           # AI educational image generation — Firebase Storage, 1/day quota, prompt dedup + history
        ai_import.py           # AI content import helpers
        ai_mindmap_buddy.py    # AI mind map buddy — RAG + knowledge graph node suggestions
        rag_admin.py           # RAG indexing triggers + status
        clp.py                 # Course Learning Plan (CLP) file handling + extraction
        site_import.py         # LMS migration/content import utilities
        participation.py       # Participation scoring system
      auth.py                  # Firebase token verification
      firestore.py             # Firebase Admin SDK init + Firestore client
      models.py                # Collection constants, helpers
      schemas.py               # Pydantic request/response schemas
      audit.py                 # Audit logging helper
      ai_service.py            # Google Gemini configuration + initialization
      rag_service.py           # ChromaDB vector store, embedding, chunking, retrieval (RAG)
      gag_service.py           # Generation-Augmented Generation — structured artifact output
      knowledge_graph_service.py # Course concept graphs, BFS traversal, similarity graphs
      gamification.py          # Badge logic + milestone triggers
      file_validation.py       # Magic number validation for file uploads
      similarity.py            # Text similarity detection for plagiarism
      scheduler.py             # Background task scheduler (APScheduler)
    main.py                    # FastAPI app entry point
    seed.py                    # Seed test accounts
    requirements.txt
    serviceAccountKey.json     # Firebase Admin credentials (not committed)

  frontend-web/
    src/
      app/
        icon.png               # App Router favicon (IPG logo on white circle, auto-served at /icon.png)
        (auth)/                # Login, Register, Forgot Password, Logout
        (dashboard)/
          student/             # 27 student pages
            dashboard/         # Activity heatmap, upcoming deadlines, stats
            my-maps/           # Mind map gallery with search
            create-map/        # React Flow map editor
            courses/           # Enrolled courses list
            course/[cid]/      # Course detail + tools
              assignments/     # View + submit (file/map/link)
              quizzes/         # Take quizzes with timer
              discussions/     # Real-time class chat
              forum/           # Topic-based discussion forum
              resources/       # Course materials + progress tracking
              peer-reviews/    # Review classmates' work
            gradebook/         # Unified gradebook across courses
            grades/            # Per-course grades
            messages/          # Private messaging
            notifications/     # Notification center
            calendar/          # Calendar view with events
            attendance/        # Attendance records per course
              check-in/        # QR/code-based check-in
            activity/          # Activity log timeline
            certificates/      # Earned certificates + claim
            planner/           # Personal task planner
            achievements/      # Badge showcase (12 badges)
            study-guide/       # AI daily study recommendations
            study-materials/   # AI-generated study materials library
            exam-planner/      # AI exam study plan generator
            profile/           # Profile editor + avatar
          lecturer/            # 13 lecturer pages
            dashboard/         # Analytics overview
            class-management/  # Course list + create
            course/[cid]/      # Course detail + tools
              assignments/     # Create + grade + rubrics + conditional access
              quizzes/         # Create + manage + view attempts
              question-bank/   # Reusable question pool
              gradebook/       # Student grades + reports + weight settings
              discussions/     # Moderate class chat
              forum/           # Topic-based forum with pin control
              announcements/   # Post announcements
              resources/       # Upload materials + file management
              attendance/      # Take attendance + session management
              groups/          # Student groups + auto-assign
              completion/      # Completion tracking dashboard
            review-maps/       # Review student mind maps
            view-map/[id]/     # Annotate maps
            analytics/         # Engagement heatmap, at-risk students
            manage-badges/     # Award/revoke badges
            messages/          # Private messaging
            notifications/     # Notification center
            planner/           # Personal planner
            profile/           # Profile editor
          admin/               # 4 admin pages
            dashboard/         # Admin overview
            users/             # User management + role changes
            homepage-editor/   # CMS for landing page
            audit-logs/        # System audit trail
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
      models/                  # Dart model classes
        user_profile.dart      # UserProfile model
        mind_map_model.dart    # MindMapModel
      screens/                 # 46 Flutter screen widgets
        main_shell.dart        # Tab navigation shell (5 tabs) + AI FAB overlay
        home_screen.dart       # Dashboard + shimmer loading + deadlines + today's tasks + tutorial
        subjects_screen.dart   # Course list (student enrolled / lecturer teaching)
        subject_detail_screen.dart  # Course detail with 11 tool cards + study materials
        subject_form_screen.dart    # Create/edit course form
        join_subject_screen.dart    # Join course by code
        assignments_tab.dart        # Assignment list + create (lecturer)
        assignment_form_screen.dart # Create/edit assignment
        student_submit_screen.dart  # Submit assignment
        lecturer_submissions_screen.dart # View + grade + AI plagiarism check + AI grade suggest
        quizzes_screen.dart         # Quiz list + take quiz (student) + results (lecturer)
        forum_screen.dart           # Topic-based forum + threaded posts
        gradebook_screen.dart       # Student grades / lecturer class gradebook
        attendance_screen.dart      # Attendance records / session management
        peer_reviews_screen.dart    # View peer reviews on assignments
        completion_screen.dart      # Course completion tracking (lecturer)
        groups_screen.dart          # Student groups + create + auto-assign
        notifications_screen.dart   # In-app notification center
        messaging_screen.dart       # Private messaging + conversations
        activity_screen.dart        # Activity log timeline
        calendar_screen.dart        # Monthly calendar with events
        certificates_screen.dart    # Earned certificates + claim
        discussion_chat_screen.dart # Real-time class chat
        announcement_form_screen.dart   # Announcements list + create
        announcements_screen.dart   # Read-only announcements
        resources_screen.dart       # Course materials + modules + AI generate (summary/flashcard/quiz)
        tasks_screen.dart           # Personal planner / reminders
        mind_maps_screen.dart       # Mind map gallery
        mind_map_viewer.dart        # View mind map details
        grades_screen.dart          # Simple grades view
        achievements_screen.dart    # Badge showcase
        review_maps_screen.dart     # Lecturer map review
        manage_badges_screen.dart   # Award/revoke badges
        lecturer_analytics_screen.dart  # Analytics dashboard
        profile_screen.dart         # Profile editor + avatar + theme toggle + language picker
        login_screen.dart           # Login with Rive animation
        register_screen.dart        # Registration with role selection
        ai_companion_screen.dart    # AI study companion chat interface
        ai_learning_style_screen.dart   # Learning style assessment quiz
        ai_study_guide_screen.dart  # AI daily study recommendations + timetable analysis (text/PDF)
        ai_exam_planner_screen.dart # AI exam study plan generator
        ai_study_materials_screen.dart  # AI-generated study materials library
        ai_flashcard_viewer.dart    # Interactive flashcard flip viewer
        ai_summary_viewer.dart      # AI-generated summary reader
        ai_practice_quiz_screen.dart    # AI-generated practice quiz
        welcome_screen.dart        # First-time welcome/onboarding screen
      services/
        api_service.dart       # HTTP API client (120+ endpoints including AI)
        theme_service.dart     # Theme persistence (Firestore + localStorage)
      widgets/                 # Shared widget components
        floating_nav_bar.dart  # Bottom navigation bar (localized labels)
        ai_companion_fab.dart  # Floating AI companion button (theme-reactive)
        theme_switcher.dart    # Expanding circle theme transition animation
        tutorial_overlay.dart  # First-time spotlight tutorial overlay
        shimmer_box.dart       # Shimmer loading placeholder
        fade_slide_in.dart     # Fade/slide animation wrapper
        app_background.dart    # Animated gradient background
        animated_splash.dart   # Animated splash screen
        app_drawer.dart        # Side drawer
        rive_nav_icon.dart     # Rive-animated navigation icons
        open_container_wrapper.dart # Material open container transition
      utils/
        app_theme.dart         # Theme data (dark + light)
        app_colors.dart        # Color constants
        app_theme_ext.dart     # Theme extension for context.colors
        app_constants.dart     # IPG department + class/unit dropdown options (mirrors frontend-web constants.ts)
        badge_utils.dart       # Badge display names + emojis
        locale_provider.dart   # Locale state management (English/Malay)
        tutorial_prefs.dart    # Tutorial completion persistence
      l10n/
        app_strings.dart       # Bilingual strings (120+ keys, English/Bahasa Melayu)

  start-backend.sh             # Start backend server only
  start-frontend-web.sh        # Start web frontend only
  start-frontend-mobile.sh     # Start Flutter mobile app only
  start-dev.sh                 # Start all servers together
  start-dev-mobile.sh          # Start all + USB device
  start-dev-mobile-wireless.sh # Start all + wireless device
```

---

## Features

### Student Features (28 features)

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
| 27 | **AI Flashcard Viewer** | - | Yes | Interactive flip-card viewer with navigation and shuffle for AI-generated flashcards |
| 28 | **AI Mind Map Buddy** | Yes | - | Context-aware AI assistant during map editing — suggests nodes, connections, and improvements in real-time |

### Lecturer Features (16 features)

| # | Feature | Web | Mobile | Description |
|---|---------|:---:|:------:|-------------|
| 1 | **Dashboard** | Yes | Yes | Analytics overview, pending reviews, at-risk students |
| 2 | **Class Management** | Yes | Yes | Create/edit/delete courses, manage enrollment, share join codes |
| 3 | **Assignments** | Yes | Yes | Create with conditional access, rubric-based grading, view submissions |
| 4 | **Quizzes** | Yes | Yes | Create/edit quizzes, view all student attempts and results |
| 5 | **Question Bank** | Yes | - | Reusable question pool per course with tags, difficulty, import/export to quizzes |
| 6 | **Gradebook** | Yes | Yes | Class-wide grade table, configurable weights, per-student reports |
| 7 | **Grading Rubrics** | Yes | - | Create rubrics with criteria, grade submissions with per-criterion scores |
| 8 | **Discussion Forum** | Yes | Yes | Topic-based forum with pin/delete moderator controls |
| 9 | **Completion Tracking** | Yes | Yes | Per-student progress (assignments, quizzes, resources), at-risk identification, summary stats |
| 10 | **Attendance** | Yes | Yes | Create sessions, mark present/late/absent, bulk update, delete sessions |
| 11 | **Groups** | Yes | Yes | Create student groups, add/remove members, auto-assign via round-robin |
| 12 | **Analytics** | Yes | Yes | Engagement heatmap, submission trends, map type popularity |
| 13 | **Manage Badges** | Yes | Yes | Award/revoke badges to students |
| 14 | **Map Review** | Yes | Yes | Browse and annotate student mind maps |
| 15 | **AI Plagiarism Detection** | Yes | Yes | Analyze submissions for potential plagiarism with similarity scoring and flagged sections |
| 16 | **AI Grading Assistant** | Yes | Yes | AI-recommended grades with suggested feedback, score breakdown, one-click apply |

### Admin Features (3 features)

| # | Feature | Web | Mobile | Description |
|---|---------|:---:|:------:|-------------|
| 1 | **User Management** | Yes | - | View all users, change roles (student/lecturer/admin) |
| 2 | **Homepage Editor** | Yes | - | CMS for landing page news and posters with image upload |
| 3 | **Audit Logs** | Yes | - | Full system audit trail with filtering |

### Cross-Cutting Features

| Feature | Description |
|---------|-------------|
| **Dark/Light Theme** | Toggle between dark glassmorphism and light mode with expanding circle animation (mobile), persisted per user via Firebase |
| **Bilingual UI (i18n)** | English and Bahasa Melayu language support on mobile, switchable from profile settings |
| **First-Time Tutorial** | Spotlight overlay guide for new users on mobile with skip option |
| **Registration Parity (Web ↔ Mobile)** | Both platforms share the same IPG-specific dropdown options (11 departments, 38 PISMP/PPISMP/DPLI programs) via `frontend-mobile/lib/utils/app_constants.dart` ↔ `frontend-web/src/lib/constants.ts`, with a free-text "Other" fallback on both. Password strength meter (5-check heuristic: length, lowercase, uppercase, number, symbol) on mobile matches web. Welcome email dispatched post-registration on both platforms |
| **AI Engine (Gemini 2.5 Flash)** | Powers 10 AI features: companion chat, study guide, timetable analysis, exam planner, study materials, plagiarism detection, grading assistant, mind map buddy, image generation, course import. See [`AI-Architecture.md`](./AI-Architecture.md) for full data flow diagrams |
| **Auto-Badge Engine** | 9 badge criteria automatically checked after key actions (submissions, quizzes, reviews) |
| **Conditional Access** | Date-based and prerequisite-based restrictions on assignments |
| **Weighted Gradebook** | Configurable assignment/quiz weight ratios per course |
| **Similarity Detection** | Assignment plagiarism detection via text similarity |
| **Role-Based Access** | Dashboard layout guards with role-based routing (student/lecturer/admin) |
| **Real-Time Polling** | Discussions (5s), announcements (10s), map collaboration (4s), forum posts (5s), messages (4s) |

---

## Firestore Collections (42+ collections)

All data is stored in flat top-level Firestore collections with **camelCase** field names:

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
| `questionBank` | Reusable questions | `courseId`, `type`, `text`, `options`, `correctAnswer`, `tags`, `difficulty`, `usedCount` |
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
| `gradeSettings` | Course grade weights | `courseId`, `assignmentWeight`, `quizWeight` |
| `courseGroups` | Student groups | `courseId`, `name`, `description`, `members` |
| `aiPlagiarismReports` | AI plagiarism results | `submissionId`, `similarityScore`, `flaggedSections` |
| `aiGradeRecommendations` | AI grade suggestions | `submissionId`, `suggestedGrade`, `feedback` |
| `learningProfiles` | Student learning styles | `userId`, `style`, `strengths`, `weaknesses` |
| `aiChatHistory` | AI companion conversations | `userId`, `messages`, `context` |
| `generatedStudyMaterials` | AI-generated content | `userId`, `type`, `topic`, `content` |
| `aiStudyPlans` | AI daily guides + exam plans | `userId`, `type`, `plan`, `createdAt` |
| `examSchedules` | Exam timetable analysis | `userId`, `subjects`, `schedule` |
| `aiMindmapBuddyMemory` | AI map assistant context | `userId`, `mapId`, `memory`, `preferences` |
| `mapHistory` | Map version tracking | `mapId`, `version`, `graphData`, `editedBy` |
| `ragIndexState` | RAG indexing state | `docId`, `courseId`, `contentHash`, `lastIndexedAt`, `chunkCount` |
| `knowledgeGraphs` | Course concept graphs | `courseId`, `nodes`, `edges`, `nodeCount`, `lastUpdatedAt` |

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

### Course Tools (11 tools per course)

When a user taps a course, `SubjectDetailScreen` shows a grid of tool cards:

| Tool | Student | Lecturer | Screen |
|------|:-------:|:--------:|--------|
| Resources | Yes | Yes | `ResourcesScreen` |
| Assignments | Yes | Yes | `AssignmentsTab` |
| Quizzes | Yes | Yes | `QuizzesScreen` |
| Forum | Yes | Yes | `ForumScreen` |
| Gradebook | Yes | Yes | `GradebookScreen` |
| Attendance | Yes | Yes | `AttendanceScreen` |
| Announcements | Yes | Yes | `AnnouncementFormScreen` |
| Class Chat | Yes | Yes | `DiscussionChatScreen` |
| Peer Reviews | Yes | - | `PeerReviewsScreen` |
| Completion | - | Yes | `CompletionScreen` |
| Groups | Yes | Yes | `GroupsScreen` |

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

---

## Project Statistics

| Metric | Value |
|--------|-------|
| Backend API routers | 41 |
| Backend lines of code | ~10,400 |
| Web frontend pages | 35 |
| Flutter mobile screens | 46 |
| Firestore collections | 42+ |
| Student features | 28 |
| Lecturer features | 16 |
| AI feature routers | 9 |
| Gamification badge criteria | 9 |
| AI result cache collections | 6 |
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
| POST/DELETE | `/api/maps/{id}/collaborators` | Manage collaborators |
| POST/GET | `/api/maps/{id}/presence` | Real-time presence |
| GET/POST/DELETE | `/api/maps/{id}/annotations` | Map annotations |

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

### Question Bank
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/question-bank/course/{cid}` | List questions (with filters) |
| POST | `/api/question-bank/` | Add question |
| POST | `/api/question-bank/bulk` | Bulk add questions |
| PATCH/DELETE | `/api/question-bank/{qid}` | Update/delete question |
| POST | `/api/question-bank/import-to-quiz` | Import to quiz |
| POST | `/api/question-bank/export-from-quiz` | Export quiz to bank |

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
| PATCH | `/api/notifications/{nid}/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all read |
| POST | `/api/notifications/register-token` | Register FCM token |

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
| GET/PATCH/POST/DELETE | `/api/admin/*` | Admin operations |

---

## RAG / GAG Architecture

The AI features are enhanced with three retrieval-augmented patterns:

### Standard RAG
**ChromaDB vector store** + **Gemini text-embedding-004** for semantic search across course content (PDFs, announcements, discussions, mind maps, quizzes, assignments). Content is chunked (~500 tokens, 50-token overlap), embedded, and stored in per-course ChromaDB collections. Incremental indexing uses SHA-256 content hashing to skip unchanged documents.

| Feature | How RAG is Used |
|---------|----------------|
| AI Companion Chat | Retrieves relevant course materials to ground conversational answers with `[Source N]` citations |
| Study Material Generation | `generate-by-topic` endpoint searches course content to create summaries/flashcards/quizzes from multiple sources |

### RAG + GAG (Generation)
RAG retrieval + structured artifact generation via Gemini. Produces richer outputs than plain text responses.

| Feature | Structured Output |
|---------|------------------|
| Daily Study Guide | Per-topic `difficulty_rating` (1-5), `resource_links[]`, `suggested_activities[]` based on student performance data |
| AI Grading | `comparative_analysis` against class stats, `improvement_suggestions[]` with resource links |

### RAG + GAG (Graph)
RAG retrieval + **knowledge graph traversal** (BFS over Firestore-persisted concept graphs) + graph-structured output.

| Feature | Graph Output |
|---------|-------------|
| Mind Map Buddy | Node/edge suggestions grounded in course materials with `source` attribution and `graph_connections[]` |
| Plagiarism Network | Pairwise cosine similarity graph, connected component clustering, narrative cluster analysis |

### Multi-Step Reasoning (Chat Retrieval)

Conversational endpoints (`ai_companion`, `ai_mindmap_buddy`) route through `backend/app/rag_multistep.py`, which layers three techniques on top of plain vector search:

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

### Multi-Agent Architecture

Data-intensive endpoints use a **fan-out / fan-in** pattern (`backend/app/multi_agent.py`) to run independent Firestore reads and retrieval calls in parallel via `asyncio.gather`, with per-agent error isolation.

| Endpoint | File | Agents (parallel) | Synthesizer |
|----------|------|--------------------|-------------|
| **AI Grading** | `ai_grading.py` | `submission_agent`, `assignment_agent`, `class_stats_agent` | GAG grading report |
| **Daily Study Guide** | `ai_study_plan.py` | `courses`, `deadlines`, `performance`, `timetables` | RAG → GAG study plan artifact |
| **Companion Chat** | `ai_companion.py` | `courses`, `deadlines`, `performance`, `timetables`, `reminders` | RAG multistep → Gemini chat |
| **Plagiarism Network** | `ai_plagiarism.py` | `assignment_verify`, `similarity_graph_build` | cluster detection → GAG narrative |
| **Mind Map Buddy** | `ai_mindmap_buddy.py` | `rag_agent`, `kg_agent` (recommend-nodes + suggest-all) | Gemini / GAG graph suggestions |

**How it works**: `fan_out({"name": coroutine, ...})` dispatches all agents concurrently. Each agent is wrapped in error isolation — if one fails, its result becomes `{"_error": "..."}` and other agents' results are still used. `get_or_default(results, key, fallback)` safely extracts values. Timeout defaults to 30s.

**Not multi-agent** (skip — single-call, scoped input): study materials, quiz generation, timetable analysis, course import, image generation.

### Background Jobs
- **RAG Indexing**: Nightly at 2 AM UTC via APScheduler — indexes all course content into ChromaDB
- **Knowledge Graph Rebuild**: Nightly at 3 AM — extracts concepts and relationships from indexed content using Gemini

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

- **Student**: Join courses, submit assignments, take quizzes, view grades, peer review, earn badges, create mind maps, claim certificates, use forum, view attendance, private messaging, calendar, notifications
- **Lecturer**: Create courses, post assignments/quizzes, grade with rubrics, manage question bank, track attendance/completion, moderate forums, manage groups, view analytics, private messaging
- **Admin**: Manage users and roles, edit homepage content, view audit logs

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

## Backend Modules (38 routers)

All backend routers are located in `backend/app/routers/`:

| # | Module | File | Description |
|---|--------|------|-------------|
| 1 | **Auth** | `auth.py` | Firebase token verification + user sync to Firestore |
| 2 | **Users** | `users.py` | Profile management + avatar upload |
| 3 | **Maps** | `maps.py` | Mind map CRUD + collaboration + presence + annotations + node image upload |
| 4 | **Courses** | `courses.py` | Course CRUD + enrollment + student management |
| 5 | **Assignments** | `assignments.py` | Assignment CRUD + conditional access + file upload submissions |
| 6 | **Quizzes** | `quizzes.py` | Quiz CRUD + auto-grading + attempts + results |
| 7 | **Question Bank** | `question_bank.py` | Reusable question pool per course with tags, difficulty, import/export to quizzes |
| 8 | **Gradebook** | `gradebook.py` | Weighted gradebook + student reports + CSV export + grade settings |
| 9 | **Rubrics** | `rubrics.py` | Grading rubrics + criterion-based grading |
| 10 | **Peer Reviews** | `peer_review.py` | Peer review submissions + ratings + comments |
| 11 | **Discussions** | `discussions.py` | Real-time class chat + threaded replies |
| 12 | **Discussion Topics** | `discussion_topics.py` | Topic-based forum with pinning + moderator controls |
| 13 | **Announcements** | `announcements.py` | Course announcements CRUD |
| 14 | **Resources** | `resources.py` | Resource modules + file uploads + progress tracking + template cloning |
| 15 | **Attendance** | `attendance.py` | Session-based attendance tracking + bulk update |
| 16 | **Certificates** | `certificates.py` | Course completion certificates + verification |
| 17 | **Completion** | `completion.py` | Course completion tracking + per-student analytics |
| 18 | **Groups** | `groups.py` | Student groups + auto-assign via round-robin |
| 19 | **Messaging** | `messaging.py` | Private messaging + conversations + user search |
| 20 | **Notifications** | `notifications.py` | In-app notifications + FCM token registration |
| 21 | **Activity** | `activity.py` | Activity feed + weekly reflections |
| 22 | **Analytics** | `analytics.py` | Lecturer analytics: engagement heatmap, at-risk students, submission trends |
| 23 | **Progress** | `progress.py` | Course progress + calendar events |
| 24 | **Participation** | `participation.py` | Participation scoring per course |
| 25 | **Auto Badges** | `auto_badges.py` | Automatic badge engine with 9 award criteria |
| 26 | **Badges** | `badges.py` | Manual badge award/revoke management |
| 27 | **Reminders** | `reminders.py` | Personal planner tasks CRUD |
| 28 | **Stats** | `stats.py` | Study activity heatmap + monthly comparison |
| 29 | **Admin** | `admin.py` | User management + audit logs + homepage editor + image upload |
| 30 | **AI Companion** | `ai_companion.py` | Standard RAG — AI study companion chat with course material retrieval + citations + learning profile |
| 31 | **AI Study Plan** | `ai_study_plan.py` | RAG+GAG (Generation) — AI daily guide with difficulty ratings, resource links, suggested activities |
| 32 | **AI Study Materials** | `ai_study_materials.py` | Standard RAG — summaries, flashcards, quizzes from resources + topic-based multi-source generation |
| 33 | **AI Plagiarism** | `ai_plagiarism.py` | RAG+GAG (Graph) — plagiarism detection + assignment-wide network analysis with similarity clustering |
| 34 | **AI Grading** | `ai_grading.py` | RAG+GAG (Generation) — grade recommendations with comparative analysis + improvement suggestions |
| 35 | **AI Images** | `ai_images.py` | AI educational image/diagram generation |
| 36 | **AI Import** | `ai_import.py` | AI content import helpers |
| 37 | **AI Mind Map Buddy** | `ai_mindmap_buddy.py` | RAG+GAG (Graph) — mind map assistant with knowledge graph traversal, source-attributed node suggestions |
| 38 | **RAG Admin** | `rag_admin.py` | Manual RAG indexing triggers + index status per course |

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

| Namespace | Methods | Description |
|-----------|---------|-------------|
| `authApi` | 2 | Firebase token sync, current user |
| `usersApi` | 3 | Profile update, avatar upload, get user |
| `mapsApi` | 14 | Map CRUD, search, collaborators, presence, annotations, node image upload |
| `coursesApi` | 8 | Course CRUD, enrollment, students, search |
| `assignmentsApi` | 12 | Assignment CRUD, submissions, grading, file upload, similarity report |
| `quizzesApi` | 12 | Quiz CRUD, questions, attempts, results |
| `questionBankApi` | 6 | Question CRUD, import/export with quizzes |
| `gradebookApi` | 6 | Student/course gradebook, settings, reports, CSV export |
| `rubricsApi` | 4 | Rubric CRUD, criterion-based grading |
| `peerReviewApi` | 4 | Submit reviews, get reviews per assignment/submission |
| `discussionsApi` | 5 | Class chat messages + threaded replies |
| `topicsApi` | 8 | Forum topics CRUD, pin toggle, posts |
| `announcementsApi` | 3 | Announcements CRUD |
| `modulesApi` | 9 | Resource modules, items, file upload, progress tracking, template cloning |
| `attendanceApi` | 5 | Sessions, records, bulk update, student attendance |
| `certificatesApi` | 4 | Student certs, claim, verify |
| `completionApi` | 2 | Per-student completion, summary |
| `groupsApi` | 6 | Group CRUD, members, auto-assign |
| `messagingApi` | 5 | Conversations, messages, user search |
| `notificationsApi` | 4 | List, mark read, FCM token |
| `activityApi` | 1 | Activity feed |
| `reflectionsApi` | 2 | Weekly reflections |
| `progressApi` | 2 | Course progress, calendar events |
| `participationApi` | 1 | Participation scores |
| `statsApi` | 3 | Study activity, monthly comparison, map type distribution |
| `analyticsApi` | 5 | Lecturer analytics, heatmap, at-risk students |
| `badgesApi` | 2 | Award/revoke badges |
| `remindersApi` | 4 | Planner task CRUD |
| `adminApi` | 7 | User management, audit logs, homepage CMS |
| `homepageApi` | 1 | Public homepage content |

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

### Mobile API Configuration

The Flutter mobile app connects to the backend via `ApiService._base`:
- **Android Emulator**: `http://10.0.2.2:8000/api` (maps to host localhost)
- **Physical Device (USB)**: `http://<your-ip>:8000/api` (requires `--host 0.0.0.0`)
- **Physical Device (Wireless)**: Same as USB but over Wi-Fi

---

## License

This project is developed for educational purposes at IPG Kampus Perempuan Melayu Melaka.
