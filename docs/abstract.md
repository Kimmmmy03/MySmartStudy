# MySmartStudy — Project Abstract

**Project Title:** MySmartStudy: An AI-Enhanced Collaborative Learning Management System with Mind Map Integration

**Institution:** IPG Kampus Perempuan Melayu Melaka

**Type:** Final Year Project (FYP) — Software Engineering

**Date:** April 2026

---

## Abstract

MySmartStudy is a full-stack, AI-enhanced Learning Management System (LMS) designed and developed for IPG Kampus Perempuan Melayu Melaka. The system addresses the limitations of existing LMS platforms by integrating collaborative mind mapping, artificial intelligence-powered study tools, gamification mechanics, and comprehensive course management into a unified, cross-platform digital learning ecosystem accessible via web browser and mobile device.

The platform targets two primary user roles — **students** and **lecturers** — with a supporting **admin** role for system governance. Students benefit from interactive tools including collaborative mind map editing, AI study companions, personalised study plans, automated quiz attempts, peer reviews, and gamified achievement tracking. Lecturers gain access to class analytics dashboards, AI-assisted grading, plagiarism detection, attendance management, and structured course content organisation. Administrators oversee user management, audit logs, and homepage content through a dedicated CMS interface.

The system is built on a modern three-tier architecture: a **Next.js 16** web frontend with TypeScript and Tailwind CSS v4, a **Flutter** mobile frontend supporting both Android and iOS with bilingual interface (English and Bahasa Melayu), and a **FastAPI** Python backend with Firebase Firestore as the primary cloud database and Firebase Authentication for secure identity management. Artificial intelligence capabilities are powered by **Google Gemini 2.5 Flash**, augmented by a **Retrieval-Augmented Generation (RAG)** pipeline built on **ChromaDB** vector storage with Gemini `text-embedding-004` embeddings, and a **Knowledge Graph** engine for concept-level academic analysis.

The system was developed in response to the growing demand for digital-native, personalised, and engaging learning environments — particularly in Malaysian teacher education institutions where blended learning and collaborative tools are increasingly essential.

---

## 1. Problem Statement

Traditional LMS platforms such as Moodle and Google Classroom provide content delivery and assignment submission but lack:

1. **Collaborative visual learning tools** — mind maps and concept diagrams are not native features
2. **AI personalisation** — no adaptive study planning, study companion, or learning style detection
3. **Gamification depth** — limited incentive systems beyond grades
4. **Real-time collaboration** — no live co-editing of student work
5. **Integrated plagiarism and grading intelligence** — assessment support tools are either absent or require separate third-party systems
6. **Cross-platform offline capability** — many platforms lack responsive mobile support or offline editing

MySmartStudy was designed to address all six gaps within a single coherent platform.

---

## 2. Objectives

1. Design and implement a full-stack LMS with role-based dashboards for students, lecturers, and administrators
2. Develop a real-time collaborative mind map editor with annotation, export, and AI-assisted node suggestion
3. Integrate Google Gemini 2.5 Flash for AI study assistance, study material generation, plagiarism detection, and grading support
4. Implement a RAG pipeline with ChromaDB and knowledge graph for context-aware AI recommendations
5. Build a gamification engine with 9 automated badge criteria to sustain student engagement
6. Provide cross-platform access via a Next.js web application and a Flutter mobile application
7. Support bilingual interaction in English and Bahasa Melayu on the mobile platform
8. Deliver advanced course management including quizzes, rubrics, peer reviews, attendance, certificates, and gradebooks

---

## 3. System Architecture

MySmartStudy follows a **three-tier client-server architecture** with cloud-native services:

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                            │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐ │
│  │    Next.js 16 Web App    │   │     Flutter Mobile App       │ │
│  │  TypeScript + Tailwind   │   │  Dart + Material Design 3    │ │
│  │  React Flow mind maps    │   │  46 screens (Android/iOS)    │ │
│  │  Framer Motion / Recharts│   │  Bilingual (EN / BM)         │ │
│  └──────────────────────────┘   └──────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS (Bearer JWT / Firebase ID Token)
┌──────────────────────────────▼───────────────────────────────────┐
│                         API LAYER                                │
│              FastAPI 0.115 (Python) — 41 Routers                 │
│              Firebase Admin SDK for token verification           │
│              APScheduler for background reminder jobs            │
│              scikit-learn for text similarity / plagiarism       │
│              python-multipart for file uploads                   │
└────────────┬────────────────────────────┬────────────────────────┘
             │                            │
┌────────────▼──────────┐   ┌────────────▼────────────────────────┐
│   PERSISTENCE LAYER   │   │           AI LAYER                  │
│  Firebase Firestore   │   │  Google Gemini 2.5 Flash (LLM)      │
│  (NoSQL Cloud DB)     │   │  ChromaDB (Vector Store / RAG)      │
│  Firebase Auth        │   │  Gemini text-embedding-004          │
│  Firebase Storage     │   │  Knowledge Graph (BFS traversal)    │
│  Firebase FCM         │   │  GAG (Generation-Augmented Gen.)    │
└───────────────────────┘   └─────────────────────────────────────┘
```

### Authentication Flow
1. User registers or logs in via Firebase Authentication (email/password or Google sign-in)
2. Firebase returns an ID token to the client
3. All API requests carry `Authorization: Bearer <firebase_id_token>`
4. FastAPI backend verifies the token using Firebase Admin SDK on every protected endpoint
5. Role-based access control (RBAC) enforces student/lecturer/admin boundaries at the route level
6. Auth context (`AuthProvider` on web, `Provider` on mobile) hydrates user state on app mount

---

## 4. Features Overview

### 4.1 Mind Map System

The mind map editor is the centrepiece of MySmartStudy's collaborative learning approach:

- **Infinite canvas** built on React Flow (@xyflow/react) with drag, pan, and zoom
- **Real-time collaboration** — multiple users co-edit simultaneously; Firestore snapshot listeners propagate changes live; user presence shown via name tags on active nodes
- **Conflict resolution** — last-write-wins strategy, sufficient for educational contexts
- **Templates** — pre-built map types: Double Bubble, Venn Diagram, Spider, Flow Chart, and blank
- **Annotation mode** — lecturers can overlay red-pen strokes and sticky notes without mutating student data
- **Edit history** — full versioned history with user attribution per change
- **Offline persistence** — IndexedDB caching enables editing without internet connectivity
- **Export** — PNG and PDF via html-to-image + jsPDF
- **Share codes** — alphanumeric codes for map discovery and peer access
- **AI Mind Map Buddy** — RAG-enhanced AI suggests relevant nodes based on course content indexed in ChromaDB

### 4.2 Course Management (VLE)

- Lecturers create courses with 16 auto-generated weekly modules
- Students join via 6-digit alphanumeric join codes
- Hierarchical structure: Course → Module → Item (lecture notes, videos, links, files)
- Secure file validation using magic number checking (not just file extension)
- Student roster with last-active timestamps
- Course theme customisation and description management

### 4.3 Assignments and Submissions

- Submission types: file upload, mind map link, or external URL
- **Conditional access**: prerequisites and time windows (`availableFrom` / `availableUntil`)
- **Rubric-based grading**: lecturers define criteria levels; AI can suggest scores per criterion
- **Plagiarism detection**: cosine similarity scoring via scikit-learn + AI-generated content analysis
- **Peer reviews**: structured peer evaluation with rating and commentary

### 4.4 Quizzes and Question Bank

- Supports MCQ, true/false, and fill-in-the-blank question types
- Auto-grading with instant score feedback to students
- Multiple attempts with best-score tracking
- Reusable question bank per course for efficient quiz assembly
- Lecturer analytics: performance trends and per-question breakdowns
- Countdown timer with automatic submission on timeout

### 4.5 AI Features (Google Gemini 2.5 Flash)

| Feature | Description |
|---------|-------------|
| **AI Study Companion** | Context-aware chat with learning style detection (VARK), enrolled course context, deadline awareness, stress detection, and personalised encouragement |
| **Study Material Generation** | Generates summaries, flashcards, and practice quizzes from uploaded lecture notes using RAG-retrieved course context |
| **AI Daily Study Guide** | Personalised daily study recommendations keyed by user + date (cached to avoid API re-billing) |
| **Exam Planner** | AI-generated exam revision schedule balancing multiple subjects and deadlines |
| **Timetable Analysis** | Identifies optimisation opportunities in uploaded timetables |
| **AI Plagiarism Detection** | Detects text similarity, AI-generated content patterns, and suspicious submission behaviour |
| **AI Grading Assistance** | Rubric-based grade recommendations with per-criterion justifications |
| **AI Image Generation** | Generates educational diagrams and illustrations; daily quota (1/user/day) with prompt deduplication |
| **AI Mind Map Buddy** | RAG + knowledge graph node suggestions to enhance mind map content |

### 4.6 RAG Pipeline and Knowledge Graph

- **ChromaDB** vector store persisted on disk at `backend/vector_store/`
- **Gemini text-embedding-004** generates semantic embeddings for course content
- Documents are chunked and indexed per course; retrieval uses cosine similarity
- **Knowledge Graph** (`knowledge_graph_service.py`) models concept relationships per course
- BFS traversal finds related concepts for map suggestions
- Network analysis supports plagiarism pattern identification across submissions
- RAG Admin endpoints allow lecturers to trigger re-indexing and monitor status

### 4.7 Gamification Engine

Nine automated badge criteria evaluated in the background after every user action:

| Badge | Criteria |
|-------|----------|
| Map Master | 10+ mind maps created |
| 7-Day Study Streak | 7 consecutive daily logins |
| Quiz Champion | 80%+ average across all quizzes |
| Collaborator | Shared maps with 5+ distinct users |
| Course Completer | Completed all requirements in a course |
| Peer Reviewer | Submitted 5+ peer reviews |
| First Submission | Submitted first assignment |
| Balanced Learner | Engaged with 5+ distinct platform features |
| Knowledge Seeker | Generated 10+ AI study materials |

- Points accumulation tracks overall activity contribution
- Confetti animation on badge unlock via canvas-confetti
- Streak tracking with daily login detection
- Manual badge award/revoke by lecturers

### 4.8 Analytics

**Lecturer dashboard:**
- Engagement heatmap: activity frequency per student
- At-risk identification: students with inactivity flags
- Assignment submission rate trends
- Quiz performance breakdowns
- Resource access tracking

**Student dashboard:**
- Study activity charts (maps created per month, Recharts)
- Grade distribution and progression
- Deadline calendar overlay
- Streak and achievement progress

### 4.9 Communication and Collaboration

- **Class discussions**: real-time chat per course with threaded replies (Firestore snapshot listeners)
- **Topic forums**: pinnable discussion threads for structured Q&A
- **Announcements**: lecturer broadcasts to entire class
- **Private messaging**: one-to-one DM conversations between users
- **FCM push notifications**: Firebase Cloud Messaging for web and mobile

### 4.10 Attendance

- Lecturers create attendance sessions per course
- Students check in via QR code (mobile scanner) or manual confirmation
- Attendance records tracked per student per session
- Student summary view: attendance percentage and session history

### 4.11 Certificates

- Auto-issued on course completion (all required activities submitted)
- Student gallery view of earned certificates
- Downloadable proof of completion

### 4.12 Gradebook

- Weighted grade calculations across assignments and quizzes per course
- Student individual grade report with feedback history
- Lecturer class gradebook with per-student breakdowns
- CSV export for external processing

### 4.13 Admin Panel

- User management: view, edit roles, deactivate accounts
- Audit log: every CRUD action logged with timestamp and actor
- Homepage CMS editor: manage landing page content blocks (visible/hidden toggle)
- System health overview

---

## 5. Technology Stack

### Backend
| Component | Technology |
|-----------|------------|
| API Framework | FastAPI 0.115.0 (Python) |
| ASGI Server | Uvicorn |
| Database | Firebase Firestore (NoSQL, Cloud) |
| Authentication | Firebase Admin SDK 6.5.0 |
| AI Engine | Google Gemini 2.5 Flash (`google-genai` SDK) |
| Vector Store | ChromaDB 0.5.0 (persistent, on-disk) |
| Embeddings | Gemini `text-embedding-004` |
| Task Scheduler | APScheduler 3.10.4 |
| Text Similarity | scikit-learn (TF-IDF cosine similarity) |
| File Processing | PyPDF2, pdfplumber, openpyxl, BeautifulSoup4 |
| Validation | Pydantic v2, magic-number file validation |
| Data Schemas | Pydantic request/response models (snake_case API) |

### Frontend Web
| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router), React 19.2.3, TypeScript |
| Styling | Tailwind CSS v4, Framer Motion |
| Mind Map Canvas | @xyflow/react (React Flow) |
| Charts | Recharts |
| Firebase SDK | Firebase JS SDK 12.9.0 |
| Export | html-to-image, jsPDF |
| Animations | Lottie, canvas-confetti |
| Drag & Drop | @dnd-kit/core |
| Icons | Lucide React |

### Frontend Mobile
| Component | Technology |
|-----------|------------|
| Framework | Flutter (Dart), Material Design 3 |
| State Management | Provider pattern |
| Firebase | Firebase Core 4.4.0, Firebase Auth 6.1.4 |
| Charts | fl_chart |
| Animations | Lottie, Rive |
| QR Scanner | mobile_scanner |
| File Handling | image_picker, file_picker |
| Localisation | intl package (English / Bahasa Melayu) |

---

## 6. Database Design

MySmartStudy uses **Firebase Firestore** as its primary datastore. All collections are flat (no nested subcollections) with document IDs generated by the backend helpers.

### Core Collections (29+)

| Collection | Purpose |
|------------|---------|
| `users` | User profiles: role, badges, points, streak, activity |
| `courses` | Course metadata, join codes, enrolled students |
| `courseModules` | 16 weekly modules auto-created per course |
| `moduleItems` | Individual resources within modules |
| `assignments` | Assignment definitions with deadlines and conditions |
| `submissions` | Student submissions with grades and feedback |
| `quizzes` | Quiz definitions |
| `quizQuestions` | Individual quiz questions |
| `quizAttempts` | Student attempts with answers and scores |
| `maps` | Mind map graph data, collaborators, share codes |
| `mapHistory` | Versioned edit history |
| `discussions` | Real-time class chat messages |
| `discussionTopics` | Topic-based forum threads |
| `messages` | Private DM messages |
| `conversations` | Conversation metadata and participants |
| `rubrics` | Grading rubric definitions |
| `peerReviews` | Peer review submissions |
| `certificates` | Issued completion certificates |
| `attendance` | Attendance sessions |
| `attendanceRecords` | Per-student attendance records |
| `courseGroups` | Student groups within courses |
| `questionBank` | Reusable question pools |
| `notifications` | In-app notification records |
| `fcmTokens` | FCM device tokens |
| `activityFeed` | User activity timeline |
| `reminders` | Personal planner tasks |
| `auditLogs` | System audit trail |
| `homepageContent` | CMS content blocks |
| `gradebook` (via gradeSettings) | Weighted grade configuration |

### AI-Specific Collections

| Collection | Purpose |
|------------|---------|
| `learningProfiles` | VARK learning style per student |
| `aiChatHistory` | Study companion conversation history |
| `generatedStudyMaterials` | AI-generated summaries, flashcards, quizzes |
| `aiStudyPlans` | AI-generated study plans |
| `aiPlagiarismReports` | Plagiarism detection results |
| `aiGradeRecommendations` | AI grading suggestions |
| `aiDailyGuideCache` | Daily guide cache (userId + date key) |
| `aiMapAnalysisCache` | Map analysis cache (contentHash key) |
| `aiImageCache` | Image generation cache (promptHash key) |
| `aiImageQuotas` | Per-user daily image generation limits |
| `ragIndexState` | RAG indexing status per document |
| `knowledgeGraphs` | Course concept relationship graphs |

---

## 7. API Design

The FastAPI backend exposes a REST API under the `/api/` prefix, organised into 41 routers:

### Authentication & Users
- `POST /api/auth/sync` — Sync Firebase user into Firestore, return profile
- `GET /api/auth/me` — Return current authenticated user profile
- `PATCH /api/users/me` — Update user profile fields
- `POST /api/users/me/avatar` — Upload profile photo (multipart)

### Courses & Content
- `GET/POST/PATCH/DELETE /api/courses/` — Course CRUD
- `GET /api/courses/teaching` / `GET /api/courses/enrolled` — Role-filtered lists
- `POST /api/courses/join` — Join course by code
- `GET/POST/DELETE /api/courses/{cid}/modules/` — Module management
- `POST /api/courses/{cid}/modules/{mid}/items` — Add module resource

### Mind Maps
- `GET/POST/PATCH/DELETE /api/maps/` — Map CRUD
- `GET /api/maps/search/by-code` / `GET /api/maps/search/by-email` — Discovery
- `POST/DELETE /api/maps/{id}/collaborators` — Collaboration management
- `GET /api/maps/{id}/history` — Edit history

### Assessments
- `GET/POST/PATCH/DELETE /api/assignments/` — Assignment CRUD
- `GET/POST /api/assignments/{aid}/submissions` — Submissions
- `PATCH /api/assignments/{aid}/submissions/{sid}/grade` — Grade submission
- `GET/POST/PATCH/DELETE /api/quizzes/` — Quiz CRUD
- `POST /api/quizzes/{qid}/attempt` — Submit quiz attempt
- `GET /api/gradebook/my` / `GET /api/gradebook/course/{cid}` — Gradebooks

### AI Endpoints
- `POST /api/ai/companion/chat` — Study companion message
- `GET /api/ai/study-plan/daily-guide` — Daily AI guide
- `POST /api/ai/study-materials/generate` — Generate study material
- `POST /api/ai/plagiarism/check/{sid}` — Run plagiarism check
- `POST /api/ai/grading/recommend/{sid}` — AI grade recommendation
- `POST /api/ai/images/generate` — Generate educational image
- `POST /api/ai/mindmap-buddy/suggest` — RAG node suggestions

### Communication & Engagement
- `GET/POST /api/courses/{cid}/discussions/` — Class chat
- `GET/POST /api/messages/conversations/{uid}/messages` — DM
- `GET/POST /api/notifications/` — Notifications
- `GET/POST /api/reminders/` — Planner tasks
- `GET /api/attendance/course/{cid}` — Attendance sessions
- `PATCH /api/attendance/session/{sid}/record` — Mark attendance

---

## 8. Security Implementation

- **Firebase ID token verification** on every protected endpoint (no custom JWT)
- **Role-based access control (RBAC)** at middleware and individual route level
- **Magic number file validation** — files checked by binary header, not just extension
- **Input validation** via Pydantic v2 schemas with strict type enforcement
- **Firestore Security Rules** enforce read/write permissions per role at database level
- **Audit logging** — every write operation records actor, action, timestamp, and document reference
- **AI safety filters** — Gemini requests include `HarmBlockThreshold` safety settings
- **Daily AI quotas** — image generation capped at 1 per user per day to prevent abuse
- **Prompt deduplication** — cached by content hash to prevent redundant Gemini calls

---

## 9. Performance Considerations

- **AI response caching** — Daily guide, map analysis, node suggestions, and images are cached by content hash or user+date keys to minimise Gemini API cost
- **Firestore offline persistence** — Web client caches Firestore state locally; mind maps editable offline
- **Background badge evaluation** — Gamification logic runs via APScheduler background tasks, not inline with user requests
- **Real-time via listeners** — Firestore snapshot listeners used instead of polling where supported (discussions, maps, notifications)
- **Polling fallback** — Class discussions: 5s, announcements: 10s, map collaboration: 4s where listeners are not feasible
- **Lazy loading** — Next.js App Router enables per-page code splitting automatically
- **IndexedDB caching** — Mind map graph data cached client-side for fast re-open and offline editing

---

## 10. Project Statistics

| Metric | Value |
|--------|-------|
| Backend API routers | 41 |
| Backend lines of code | ~10,400 |
| Web frontend pages | 35 |
| Flutter mobile screens | 46 |
| Firestore collections | 29+ |
| API endpoint namespaces | 40+ |
| Gamification badge criteria | 9 |
| AI feature routers | 9 |
| AI result cache collections | 6 |
| Supported languages (mobile) | 2 (English, Bahasa Melayu) |
| Auto-generated modules per course | 16 |
| Supported user roles | 3 (Student, Lecturer, Admin) |

---

## 11. Design System

The web interface uses a **dark glassmorphism** design language:

- **Theme:** Dark background (dark-900 through dark-100) with frosted glass cards
- **Accents:** Student pages use blue gradients; lecturer pages use purple gradients; admin uses amber
- **Glass utilities:** `.glass`, `.glass-card`, `.glass-input`, `.btn-gradient` CSS classes via Tailwind v4
- **Animations:** Framer Motion page transitions, `layoutId` for sidebar active state, `AnimatePresence` for modals
- **Background:** Floating gradient orbs via `AnimatedBg` component
- **Mobile theme:** Material Design 3 with dynamic colour theming, supporting both light and dark modes

---

## 12. Limitations and Future Work

### Current Limitations
- **Last-write-wins** conflict resolution on collaborative maps may cause data loss under simultaneous high-frequency edits
- **Single-region Firestore** — no multi-region replication configured
- **AI quota constraints** — Gemini API rate limits and image generation quota (1/user/day)
- **No video conferencing** — synchronous sessions require external tools (e.g., Google Meet)
- **No native offline mode on mobile** — Flutter app requires connectivity for most operations

### Proposed Future Work
1. **Operational Transform (OT) or CRDT** for deterministic conflict-free collaborative editing
2. **WebRTC video integration** for synchronous virtual classroom sessions
3. **LTI 1.3 compliance** to enable MySmartStudy as an LTI tool within institutional Moodle instances
4. **Adaptive assessment engine** — dynamic quiz difficulty based on student performance history
5. **Expanded multilingual support** — additional Malaysian languages (Tamil, Mandarin)
6. **Native offline mode** for Flutter with local SQLite sync queue
7. **xAPI/Tin Can statement generation** for learning analytics interoperability
8. **Parent/guardian portal** for school-level deployments

---

## 13. Conclusion

MySmartStudy successfully delivers a modern, feature-complete LMS tailored to the needs of IPG Kampus Perempuan Melayu Melaka. By combining collaborative mind mapping, AI-powered study tools, gamification mechanics, and comprehensive course administration into a single cross-platform system, MySmartStudy provides a compelling alternative to general-purpose platforms that lack educational intelligence.

The integration of Google Gemini 2.5 Flash with a custom RAG pipeline and knowledge graph engine represents a significant advancement in contextually aware educational AI — moving beyond generic chatbot interactions toward domain-specific, course-aware academic assistance. The gamification engine, built on nine automated badge criteria evaluated as background jobs, demonstrates how engagement mechanics can be implemented without degrading system responsiveness.

The tri-platform architecture (Next.js web, Flutter mobile, FastAPI backend) ensures that MySmartStudy is accessible to the broadest possible user base while maintaining a consistent, high-quality user experience. The bilingual mobile interface reflects the linguistic reality of Malaysian education, ensuring the system is inclusive and locally relevant.

MySmartStudy stands as a comprehensive proof-of-concept and production-ready prototype for the next generation of AI-enhanced educational platforms in Malaysian higher education.

---

*This document was generated as part of the Final Year Project submission for the Bachelor of Education (Information Technology) programme.*
