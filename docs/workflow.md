# MySmartStudy — Complete Workflow Documentation

> This document details the workflow for every page, every role, every module connection, every API call, every button interaction, and every input/output across the entire MySmartStudy platform.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Authentication Flow](#2-authentication-flow)
3. [Student Role Workflows](#3-student-role-workflows)
4. [Lecturer Role Workflows](#4-lecturer-role-workflows)
5. [Admin Role Workflows](#5-admin-role-workflows)
6. [Module Interconnections](#6-module-interconnections)
7. [API-to-Database Mapping](#7-api-to-database-mapping)
8. [Real-Time Features & Polling](#8-real-time-features--polling)
9. [AI-Powered Features](#9-ai-powered-features)

---

## 1. System Architecture Overview

### Tech Stack
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Framer Motion
- **Backend**: FastAPI (Python) + SQLAlchemy ORM + SQLite
- **Auth**: Firebase Authentication → Backend JWT sync via `POST /api/auth/sync`
- **API Client**: `frontend-web/src/lib/api.ts` — typed fetch wrapper with Firebase token auth

### Request Flow
```
User Action → React Component → api.ts (namespace.method) → fetch(BASE + path)
  → Firebase getIdToken() → Authorization: Bearer <token>
  → FastAPI Backend → SQLAlchemy ORM → SQLite DB
  → JSON Response → Component State Update → UI Re-render
```

### Role-Based Routing
```
/ (root) → Checks auth state → Redirects to:
  - /student/dashboard   (if role === "student")
  - /lecturer/dashboard  (if role === "lecturer")
  - /admin/dashboard     (if role === "admin")
  - /login               (if not authenticated)
```

### Layout Guards
- `(auth)/layout.tsx` — No navbar, dark background. Used for login/register/forgot-password/logout.
- `(dashboard)/layout.tsx` — Auth guard + Navbar + Sidebar. Redirects unauthenticated users to `/login`. Enforces role-based access (students can't access `/lecturer/*` and vice versa).

---

## 2. Authentication Flow

### 2.1 Login Page (`/login`)

**File**: `frontend-web/src/app/(auth)/login/page.tsx`

**On Page Load**:
- `useAuth()` hook checks `user` and `profile` state from `AuthContext`
- If already authenticated, auto-redirects:
  - `profile.role === "lecturer"` → `/lecturer/dashboard`
  - Otherwise → `/student/dashboard`

#### Email/Password Login

| Element | Type | Details |
|---------|------|---------|
| Email | Input (email, required) | Placeholder: "example@moe-dl.edu.my" |
| Password | Input (password, required) | Placeholder: "Enter password" |
| Show/Hide Password | Toggle Button (Eye/EyeOff icon) | Toggles `showPassword` state |
| Forgot Password? | Link | Navigates to `/forgot-password` |
| **Sign In** | Submit Button | Triggers `handleSubmit` |

**Sign In Button Workflow**:
```
1. User clicks "Sign In"
2. e.preventDefault(), setError(""), setLoading(true)
3. Firebase: signInWithEmailAndPassword(auth, email, password)
4. On success: refreshProfile() → calls authApi.me() → GET /api/auth/me
   - Backend verifies Firebase token, returns UserOut object
   - Frontend maps UserOut → UserProfile, stores in AuthContext
5. Redirect based on role:
   - role === "lecturer" → router.replace("/lecturer/dashboard")
   - Otherwise → router.replace("/student/dashboard")
6. On error:
   - "auth/invalid-credential" | "auth/wrong-password" | "auth/user-not-found" → "Invalid email or password."
   - "auth/too-many-requests" → "Too many failed attempts. Please try again later."
   - Other → error.message or "Login failed. Please try again."
7. setLoading(false)
```

**Input**: `{ email: string, password: string }`
**Expected Output**: JWT token stored in Firebase, profile loaded, redirect to dashboard

#### Google Sign-In

| Element | Type | Details |
|---------|------|---------|
| **Sign in with Google** | Button | Triggers `handleGoogleSignIn` |

**Google Sign-In Button Workflow**:
```
1. User clicks "Sign in with Google"
2. setError(""), setGoogleLoading(true)
3. Firebase: signInWithPopup(auth, googleProvider)
4. Try refreshProfile() → GET /api/auth/me
   - If profile exists → redirect based on role
   - If profile doesn't exist (new Google user) → redirect to /register?google=1
5. On error:
   - "auth/popup-closed-by-user" → no error (user cancelled)
   - Other → error.message or "Google sign-in failed."
6. setGoogleLoading(false)
```

**Input**: Google OAuth popup interaction
**Expected Output**: Either redirect to dashboard (existing user) or redirect to registration (new user)

#### Navigation Links
| Element | Destination |
|---------|-------------|
| "Don't have an account? Register" | `/register` |
| "Forgot Password?" | `/forgot-password` |

---

### 2.2 Register Page (`/register`)

**File**: `frontend-web/src/app/(auth)/register/page.tsx`

**Modes**: Standard registration OR Google completion (`?google=1` query param)

#### Form Fields

| Element | Type | Condition | Details |
|---------|------|-----------|---------|
| Role Selector | 2 Buttons (Student/Lecturer) | Always | Sets `role` state. Student = blue glow, Lecturer = purple glow |
| Full Name | Input (text, required) | Always | Pre-filled from Google profile in Google mode |
| Email | Input (email, required) | Standard mode only | Hidden in Google mode |
| Class / Unit | SelectWithOther dropdown | Always | Options from `CLASS_UNITS` constant, allows custom |
| Year | SelectWithOther dropdown | Student role only | Options: 1, 2, 3, 4 |
| Semester | SelectWithOther dropdown | Student role only | Options: 1, 2 |
| Department | SelectWithOther dropdown | Lecturer role only | Options from `DEPARTMENTS` constant |
| Password | Input (password, required) | Standard mode only | Min 6 characters |
| Confirm Password | Input (password, required) | Standard mode only | Must match password |
| **Sign up with Google** | Button | Standard mode only | Triggers `handleGoogleRegister` |
| **Create Account** / **Complete Registration** | Submit Button | Always | Triggers `handleSubmit` |

**Create Account Button Workflow**:
```
1. Validation:
   - Standard mode: password >= 6 chars, password === confirmPassword
   - Google mode: no password validation needed
2. setLoading(true)
3. Standard mode:
   - Firebase: createUserWithEmailAndPassword(auth, email, password)
   - Get idToken from credential
   Google mode:
   - Get idToken from auth.currentUser.getIdToken()
4. API Call: authApi.sync({
     id_token, display_name, role, class_name,
     year (student only), semester (student only),
     department (lecturer only)
   })
   → POST /api/auth/sync
   → Backend creates/updates user in DB, returns UserOut
5. refreshProfile() → updates AuthContext
6. Redirect: role === "lecturer" → /lecturer/dashboard, else → /student/dashboard
7. On error:
   - "auth/email-already-in-use" → "An account with this email already exists."
   - "auth/weak-password" → "Password is too weak."
   - Other → error.message
```

**Input**: `{ id_token, display_name, role, class_name, year?, semester?, department? }`
**Expected Output (POST /api/auth/sync)**: `UserOut { id, email, display_name, role, class_name, photo_url, year, semester, department, points, streak, badges, created_at }`

---

### 2.3 Forgot Password Page (`/forgot-password`)

**File**: `frontend-web/src/app/(auth)/forgot-password/page.tsx`

| Element | Type | Details |
|---------|------|---------|
| Email | Input (email, required) | Placeholder: "example@moe-dl.edu.my" |
| **Send Reset Link** | Submit Button | Triggers `handleSubmit` |
| Back to Login | Link | Navigates to `/login` |

**Send Reset Link Workflow**:
```
1. setError(""), setLoading(true)
2. Firebase: sendPasswordResetEmail(auth, email)
3. On success: setSent(true) → shows "Reset Email Sent" success message
4. On error:
   - "auth/user-not-found" → "No account found with this email."
   - "auth/too-many-requests" → "Too many requests. Please try again later."
   - Other → error.message
5. setLoading(false)
```

**Input**: `{ email: string }`
**Expected Output**: Firebase sends password reset email, UI shows success message

---

### 2.4 Logout Page (`/logout`)

**File**: `frontend-web/src/app/(auth)/logout/page.tsx`

**Automatic Workflow (no user interaction needed)**:
```
1. On mount: useEffect fires
2. Firebase: signOut(auth) → clears Firebase auth state
3. AuthContext detects auth change → sets user/profile to null, clears session cookie
4. After 1.2s delay: router.replace("/") → redirects to root → redirects to /login
```

**Input**: None
**Expected Output**: User signed out, redirected to login page

---

### 2.5 Auth Context (`AuthProvider`)

**File**: `frontend-web/src/contexts/auth-context.tsx`

**Provides**: `{ user, profile, loading, signOut, refreshProfile }`

**On App Load**:
```
1. onAuthStateChanged(auth, callback) listens for Firebase auth state
2. If Firebase user exists:
   a. fbUser.getIdToken(true) — force refresh token
   b. Retry up to 3 times (800ms delay between retries):
      - authApi.me() → GET /api/auth/me
      - Maps UserOut → UserProfile (camelCase)
      - Sets session cookie via POST /api/auth/set-cookie
      - Updates user + profile state
   c. If all retries fail: user = null, profile = null
3. If no Firebase user:
   - user = null, profile = null
   - Clears session cookie
4. setLoading(false)
```

---

## 3. Student Role Workflows

### 3.1 Student Dashboard (`/student/dashboard`)

**File**: `frontend-web/src/app/(dashboard)/student/dashboard/page.tsx`

**On Page Load (API Calls)**:
```
1. mapsApi.list(4) → GET /api/maps/?limit=4  → Recent 4 maps
2. mapsApi.list()  → GET /api/maps/           → All maps (for total count)
3. coursesApi.enrolled() → GET /api/courses/enrolled → Enrolled courses
4. For each course:
   - assignmentsApi.list(course.id) → GET /api/assignments/?course_id={cid}
   - For each assignment:
     - assignmentsApi.getMySubmission(a.id) → GET /api/assignments/{aid}/submissions/mine
     - Counts: submitted → activitiesCompleted, not submitted + not past deadline → activitiesDue
5. progressApi.courses() → GET /api/progress/courses → Course progress percentages
```

**Database Tables Accessed**: `users`, `maps`, `courses`, `assignments`, `submissions`, `resourceProgress`

#### UI Elements & Buttons

| Element | Action | API Call | Output |
|---------|--------|----------|--------|
| Welcome Banner | Display only | None | Shows user name, total maps count |
| **Get Recommendation** button | Opens RecommendationWizard modal | None (wizard handles its own logic) | Template selection → redirects to `/student/create-map?template={template}` |
| **Weekly Reflection** button | Opens WeeklyReflectionModal | On submit: `reflectionsApi.create({ confidence, notes })` → POST /api/activity/reflections | Saves reflection with confidence rating and notes |
| **View All** (maps) | Navigation | None | Redirects to `/student/my-maps` |
| **New Map** button (if no maps) | Navigation | None | Redirects to `/student/create-map` |
| Map Card (click) | Navigation | None | Redirects to `/student/create-map?id={mapId}` |
| Badge → **View All** | Navigation | None | Redirects to `/student/achievements` |
| Course Progress (click) | Navigation | None | Redirects to `/student/course/{courseId}` |
| Stats Cards | Display only | None | Shows: Courses Enrolled, Activities Done, Activities Due, Total Maps |
| StudyActivityChart | Display | `statsApi.studyActivity()` → GET /api/stats/study-activity | Chart of daily study activity |
| MonthlyComparisonChart | Display | `statsApi.monthlyComparison()` → GET /api/stats/monthly-comparison | Current vs previous month comparison |
| ActivityFeed | Display | `activityApi.list()` → GET /api/activity/ | Recent activity list |

---

### 3.2 My Maps / Library (`/student/my-maps`)

**File**: `frontend-web/src/app/(dashboard)/student/my-maps/page.tsx`

**On Page Load**:
```
mapsApi.list() → GET /api/maps/ → Returns all user's maps (MapOut[])
```

**Database Tables**: `maps`

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **New Map** button | Navigation | None | None | Redirects to `/student/create-map` |
| Search input | Filters maps client-side | None | `searchTerm: string` | Filters `maps` array by title (case-insensitive) |
| Grid/List toggle | Switches view mode | None | Click | Toggles between grid and list layout |
| Map Card (click) | Navigation | None | None | Redirects to `/student/create-map?id={mapId}` |
| Rename button (pencil icon) | Opens Rename Modal | None | None | Shows modal with current title |
| Rename Modal → **Save** | Updates map title | `mapsApi.update(id, { title })` → PATCH /api/maps/{id} | `{ title: string }` | Map title updated in DB and UI |
| Delete button (trash icon) | Opens Delete Modal | None | None | Shows confirmation dialog |
| Delete Modal → **Delete** | Deletes map | `mapsApi.delete(id)` → DELETE /api/maps/{id} | `mapId: string` | Map removed from DB and UI |

---

### 3.3 Create / Edit Map (`/student/create-map`)

**File**: `frontend-web/src/app/(dashboard)/student/create-map/page.tsx`
**Component**: `frontend-web/src/components/map-editor/map-editor.tsx`

**URL Parameters**:
- `?id={mapId}` — Edit existing map
- `?template={templateName}` — Create from template

**On Page Load**:
```
If mapId exists:
  mapsApi.get(mapId) → GET /api/maps/{mapId}
  → Loads existing map data (nodes, edges, title)
If template exists:
  → Loads template data from local template definitions
If neither:
  → Creates new blank map
```

**Key Features**:
- **React Flow** canvas for node/edge manipulation
- **Auto-save**: 5-second debounce on changes → `mapsApi.update(mapId, { graph_data, nodes_text, thumbnail })` → PATCH /api/maps/{mapId}
- **Collaboration**: Polls every 4 seconds for collaborator presence → `mapsApi.getPresence(mapId)` → GET /api/maps/{mapId}/presence

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Title input | Updates map title | `mapsApi.update(mapId, { title })` | `{ title: string }` | Title saved (auto-save) |
| Canvas (drag/click) | Add/move nodes | Auto-save triggers `mapsApi.update()` | React Flow node/edge data | Map data saved to DB |
| Shape Palette | Adds node shapes | None (local) | Shape type selection | New node added to canvas |
| Properties Panel | Edit node properties | Auto-save | Node label, color, style | Node properties updated |
| Share button | Opens ShareModal | `mapsApi.addCollaborator(mapId, email)` → POST /api/maps/{mapId}/collaborators | `{ email: string }` | Collaborator added |
| Remove collaborator | Removes collaborator | `mapsApi.removeCollaborator(mapId, email)` → DELETE /api/maps/{mapId}/collaborators | `{ email: string }` | Collaborator removed |
| Export PNG | Exports map as PNG | None (html-to-image) | None | PNG file downloaded |
| Export PDF | Exports map as PDF | None (html-to-image + jsPDF) | None | PDF file downloaded |
| AI Analyze | Analyzes map quality | `aiMindmapBuddyApi.analyze(data)` → POST /api/ai/mindmap-buddy/analyze | `{ title, nodes, edges }` | Rating, strengths, improvements, suggestions |
| AI Suggest Nodes | Suggests new nodes | `aiMindmapBuddyApi.suggestAll(data)` → POST /api/ai/mindmap-buddy/suggest-all | `{ title, nodes, edges }` | Node suggestions with labels and descriptions |
| AI Chat | Chat with AI about map | `aiMindmapBuddyApi.chat(message, context)` → POST /api/ai/mindmap-buddy/chat | `{ message, map_context }` | AI response text |
| Upload Image to Node | Uploads image | `mapsApi.uploadNodeImage(mapId, file)` → POST /api/maps/{mapId}/upload-image | `File (multipart)` | `{ image_url: string }` |
| Add Annotation | Creates annotation | `mapsApi.createAnnotation(mapId, body)` → POST /api/maps/{mapId}/annotations | `{ type, content, position, color }` | Annotation created |
| Delete Annotation | Removes annotation | `mapsApi.deleteAnnotation(mapId, annId)` → DELETE /api/maps/{mapId}/annotations/{annId} | `annId: string` | Annotation deleted |
| Presence update | Updates user cursor/lock | `mapsApi.updatePresence(mapId, body)` → POST /api/maps/{mapId}/presence | `{ locked_node_id?, cursor_position? }` | Presence updated |

**Database Tables**: `maps`, `annotations`, `presence`

---

### 3.4 My Courses (`/student/courses`)

**File**: `frontend-web/src/app/(dashboard)/student/courses/page.tsx`

**On Page Load**:
```
coursesApi.enrolled() → GET /api/courses/enrolled → Returns CourseOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Join Code input | Text input (6 chars, uppercase, mono) | None until Join clicked | `joinCode: string` | Stores join code |
| **Join** button | Enrolls in course | `coursesApi.join({ join_code })` → POST /api/courses/join | `{ join_code: string }` | Success: CourseOut added to list + success modal. Error: error message modal |
| Course Card → **Enter** | Navigation | None | None | Redirects to `/student/course/{courseId}` |

**Database Tables**: `courses`, `enrolledStudents`

---

### 3.5 Course Detail (`/student/course/[cid]`)

**File**: `frontend-web/src/app/(dashboard)/student/course/[cid]/page.tsx`

**On Page Load**:
```
1. coursesApi.get(cid) → GET /api/courses/{cid} → Course details
2. announcementsApi.list(cid) → GET /api/courses/{cid}/announcements/ → Announcements list
```

| Element | Action | Destination |
|---------|--------|-------------|
| **Back to Courses** | Navigation | `/student/courses` |
| **Resources** tool card | Navigation | `/student/course/{cid}/resources` |
| **Assignments** tool card | Navigation | `/student/course/{cid}/assignments` |
| **Quizzes** tool card | Navigation | `/student/course/{cid}/quizzes` |
| **Peer Reviews** tool card | Navigation | `/student/course/{cid}/peer-reviews` |
| **My Grades** tool card | Navigation | `/student/gradebook` |
| **Forum** tool card | Navigation | `/student/course/{cid}/forum` |
| **Class Chat** tool card | Navigation | `/student/course/{cid}/discussions` |
| Announcement cards | Display only | Shows title, content, date (latest 5) |

---

### 3.6 Course Assignments (`/student/course/[cid]/assignments`)

**File**: `frontend-web/src/app/(dashboard)/student/course/[cid]/assignments/page.tsx`

**On Page Load**:
```
1. assignmentsApi.list(cid) → GET /api/assignments/?course_id={cid} → AssignmentOut[]
2. For each assignment:
   - assignmentsApi.getMySubmission(a.id) → GET /api/assignments/{aid}/submissions/mine → SubmissionOut | null
   - assignmentsApi.checkAccess(a.id) → GET /api/assignments/{aid}/access-check → AccessCheck { accessible, reasons }
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Assignment Card | Display | None | None | Shows title, description, deadline, status (submitted/pending/locked) |
| **Submit** button | Opens submission modal | None | None | Shows submission form |
| Submission: Map dropdown | Select existing map | `mapsApi.list()` → GET /api/maps/ | None | List of user's maps |
| Submission: External Link | Text input | None | URL string | Stores external link |
| Submission: File Upload | File picker | `assignmentsApi.uploadFile(aid, file)` → POST /api/assignments/{aid}/submissions/upload | `File (multipart)` | `{ file_url, submission_id }` |
| Submission: Comments | Textarea | None | Comment text | Stores comment |
| **Submit Assignment** | Submits work | `assignmentsApi.submit(aid, body)` → POST /api/assignments/{aid}/submissions | `{ submission_type, map_id?, external_link?, comments? }` | SubmissionOut with grade=null |
| View Feedback | Display (after grading) | None | None | Shows grade and feedback from lecturer |

**Database Tables**: `assignments`, `submissions`, `maps`

---

### 3.7 Course Resources (`/student/course/[cid]/resources`)

**File**: `frontend-web/src/app/(dashboard)/student/course/[cid]/resources/page.tsx`

**On Page Load**:
```
1. modulesApi.list(cid) → GET /api/courses/{cid}/modules/ → ModuleOut[] (with items)
2. modulesApi.getProgress(cid) → GET /api/courses/{cid}/modules/progress → ResourceProgressOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Module accordion | Expand/collapse | None | Click | Shows/hides module items |
| Resource item (click/open) | Opens resource + tracks | `modulesApi.trackProgress(cid, mid, iid)` → POST /api/courses/{cid}/modules/{mid}/items/{iid}/track | None | `{ ok, already_tracked }` |
| Resource link | Opens in new tab | None | None | External URL opens |
| Clone Template button | Clones map template | `modulesApi.cloneTemplate(cid, mid, iid)` → POST /api/courses/{cid}/modules/{mid}/items/{iid}/clone | None | `{ map_id, title }` → redirects to create-map |
| Progress indicator | Display | None | None | Shows opened/total resources per module |

**Database Tables**: `courseModules`, `moduleItems`, `resourceProgress`

---

### 3.8 Course Quizzes (`/student/course/[cid]/quizzes`)

**File**: `frontend-web/src/app/(dashboard)/student/course/[cid]/quizzes/page.tsx`

**On Page Load**:
```
1. quizzesApi.list(cid) → GET /api/quizzes/?course_id={cid} → QuizOut[]
2. For each quiz:
   - quizzesApi.getMyAttempt(qid) → GET /api/quizzes/{qid}/attempt/mine → QuizAttemptOut | null
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Quiz Card | Display | None | None | Title, description, time limit, deadline, attempt status |
| **Start Quiz** button | Loads quiz questions | `quizzesApi.getQuestions(qid)` → GET /api/quizzes/{qid}/questions | None | QuestionOut[] (correct_answer hidden for students) |
| Question (MCQ) | Radio button selection | None (local state) | Selected option | Updates `answers` state |
| Question (True/False) | Radio button selection | None (local state) | True/False | Updates `answers` state |
| Question (Short Answer) | Text input | None (local state) | Answer text | Updates `answers` state |
| Timer | Countdown display | None | None | Auto-submits when time expires |
| **Submit Quiz** button | Submits quiz attempt | `quizzesApi.submitAttempt(qid, answers)` → POST /api/quizzes/{qid}/attempt | `{ answers: Record<questionId, answer> }` | QuizAttemptOut { score, total_points, percentage } |
| View Results (if show_results) | Loads results | `quizzesApi.getResults(qid)` → GET /api/quizzes/{qid}/results | None | QuestionOut[] with correct_answer visible |

**Database Tables**: `quizzes`, `quizQuestions`, `quizAttempts`

---

### 3.9 Course Discussions / Class Chat (`/student/course/[cid]/discussions`)

**File**: `frontend-web/src/app/(dashboard)/student/course/[cid]/discussions/page.tsx`

**On Page Load + Polling (every 5 seconds)**:
```
discussionsApi.list(cid) → GET /api/courses/{cid}/discussions/ → DiscussionOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Message list | Display (auto-scroll) | Polls every 5s | None | Shows messages with sender name, role badge, timestamp |
| Message input | Text input | None | Message text | Stores text locally |
| **Send** button | Posts message | `discussionsApi.create(cid, { text })` → POST /api/courses/{cid}/discussions/ | `{ text: string }` | New DiscussionOut appended to list |
| Reply button | Opens reply thread | `discussionsApi.getReplies(cid, msgId)` → GET /api/courses/{cid}/discussions/{mid}/replies | `msgId` | Shows threaded replies |
| Reply → Send | Posts reply | `discussionsApi.reply(cid, msgId, { text })` → POST /api/courses/{cid}/discussions/{mid}/replies | `{ text: string }` | New reply added to thread |
| Delete own message | Deletes message | `discussionsApi.delete(cid, msgId)` → DELETE /api/courses/{cid}/discussions/{mid} | `msgId` | Message removed |

**Database Tables**: `discussions`

---

### 3.10 Course Announcements (`/student/course/[cid]/announcements`)

**File**: `frontend-web/src/app/(dashboard)/student/course/[cid]/announcements/page.tsx`

**On Page Load + Polling (every 10 seconds)**:
```
announcementsApi.list(cid) → GET /api/courses/{cid}/announcements/ → AnnouncementOut[]
```

| Element | Action | Details |
|---------|--------|---------|
| Announcement cards | Display only | Shows title, content, sender name, timestamp |

Students can only view announcements; they cannot create or delete them.

---

### 3.11 Course Peer Reviews (`/student/course/[cid]/peer-reviews`)

**File**: `frontend-web/src/app/(dashboard)/student/course/[cid]/peer-reviews/page.tsx`

**On Page Load**:
```
1. assignmentsApi.list(cid) → GET /api/assignments/?course_id={cid} → AssignmentOut[]
2. For selected assignment:
   - peerReviewApi.getReviewable(aid) → GET /api/peer-reviews/assignment/{aid} → ReviewableSubmission[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Assignment selector | Dropdown/tabs | `peerReviewApi.getReviewable(aid)` | `assignmentId` | List of reviewable submissions |
| Submission card | Display | None | None | Shows student name, submission type, review count, avg rating |
| **Review** button | Opens review form | None | None | Shows rating + comment form |
| Rating input | Star rating (1-5) | None | Rating number | Stores locally |
| Comment input | Textarea | None | Comment text | Stores locally |
| **Submit Review** | Posts review | `peerReviewApi.submitReview(sid, { rating, comment })` → POST /api/peer-reviews/submission/{sid} | `{ rating: number, comment?: string }` | PeerReviewOut created |
| View existing reviews | Display | `peerReviewApi.getReviews(sid)` → GET /api/peer-reviews/submission/{sid} | `submissionId` | PeerReviewOut[] |

**Database Tables**: `peerReviews`, `submissions`, `assignments`

---

### 3.12 Course Forum (`/student/course/[cid]/forum`)

**File**: `frontend-web/src/app/(dashboard)/student/course/[cid]/forum/page.tsx`

**On Page Load**:
```
topicsApi.list(cid) → GET /api/courses/{cid}/topics/ → TopicOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Topic list | Display | None | None | Shows topic title, description, author, reply count, pinned status |
| **New Topic** button | Opens create form | None | None | Shows title + description form |
| Create Topic → **Post** | Creates topic | `topicsApi.create(cid, { title, description })` → POST /api/courses/{cid}/topics/ | `{ title, description? }` | TopicOut added to list |
| Topic (click) | Opens topic detail | `topicsApi.getPosts(cid, tid)` → GET /api/courses/{cid}/topics/{tid}/posts | `topicId` | TopicPost[] |
| Reply input + **Post** | Creates post in topic | `topicsApi.createPost(cid, tid, { text })` → POST /api/courses/{cid}/topics/{tid}/posts | `{ text: string }` | TopicPost created |
| Delete own post | Removes post | `topicsApi.deletePost(cid, tid, pid)` → DELETE /api/courses/{cid}/topics/{tid}/posts/{pid} | `postId` | Post removed |

**Database Tables**: `topics`, `topicPosts`

---

### 3.13 Student Gradebook (`/student/gradebook`)

**File**: `frontend-web/src/app/(dashboard)/student/gradebook/page.tsx`

**On Page Load**:
```
gradebookApi.my() → GET /api/gradebook/my → CourseGradebook[]
Each entry contains: course_id, course_name, course_code, entries[], average
Each entry item: item_type (assignment/quiz), title, grade, total_points, percentage, feedback, submitted_at
```

| Element | Action | Details |
|---------|--------|---------|
| Course tabs/cards | Display | Groups grades by course |
| Grade entries | Display | Shows assignment/quiz name, grade/total, percentage, feedback |
| Overall average | Display | Calculated average across all graded items per course |

**Database Tables**: `submissions`, `quizAttempts`, `assignments`, `quizzes`, `courses`

---

### 3.14 Student Grades (`/student/grades`)

**File**: `frontend-web/src/app/(dashboard)/student/grades/page.tsx`

Similar to gradebook but may show a simplified view. Redirects to gradebook from course detail page.

---

### 3.15 Messages / DM (`/student/messages`)

**File**: `frontend-web/src/app/(dashboard)/student/messages/page.tsx`

**On Page Load**:
```
messagingApi.conversations() → GET /api/messages/conversations → ConversationOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Conversation list | Display | None | None | Shows participant names, last message, unread count |
| Conversation (click) | Loads messages | `messagingApi.getMessages(convId)` → GET /api/messages/conversations/{cid}/messages | `convId` | PrivateMessageOut[] |
| **New Message** button | Opens user search | None | None | Shows search input |
| User search input | Searches users | `messagingApi.searchUsers(q)` → GET /api/messages/search-users?q={q} | `q: string` (min 2 chars) | UserSearchResult[] |
| User (click) from search | Creates/gets conversation | `messagingApi.getOrCreate(uid)` → POST /api/messages/conversations/{uid} | `userId: string` | ConversationOut |
| Message input | Text input | None | Message text | Stores locally |
| **Send** button | Sends message | `messagingApi.send(convId, text)` → POST /api/messages/conversations/{cid} | `{ text: string }` | PrivateMessageOut added to list |

**Database Tables**: `conversations`, `messages`

---

### 3.16 Calendar (`/student/calendar`)

**File**: `frontend-web/src/app/(dashboard)/student/calendar/page.tsx`

**On Page Load**:
```
progressApi.calendar(month) → GET /api/progress/calendar?month={YYYY-MM} → CalendarEventOut[]
Events include: assignments, quizzes, reminders (unified view)
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Month navigation (prev/next) | Changes month | `progressApi.calendar(newMonth)` | `month: string (YYYY-MM)` | Updated CalendarEventOut[] |
| Calendar day cells | Display | None | None | Shows event dots/badges per day |
| Event (click) | Shows event detail | None | None | Displays event title, type, course, completion status |

**Database Tables**: `assignments`, `quizzes`, `reminders`

---

### 3.17 Planner (`/student/planner`)

**File**: `frontend-web/src/app/(dashboard)/student/planner/page.tsx`

**On Page Load**:
```
remindersApi.list(date) → GET /api/reminders/?date={YYYY-MM-DD} → ReminderOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Date picker | Changes selected date | `remindersApi.list(newDate)` | `date: string (YYYY-MM-DD)` | ReminderOut[] for that date |
| **Add Task** button | Opens create form | None | None | Shows title, type, priority form |
| Create → **Save** | Creates reminder | `remindersApi.create({ date, title, type, priority })` → POST /api/reminders/ | `{ date, title, type?, priority? }` | ReminderOut added to list |
| Checkbox (complete) | Toggles completion | `remindersApi.update(rid, { is_completed: true/false })` → PATCH /api/reminders/{rid} | `{ is_completed: boolean }` | Updated ReminderOut |
| Edit button | Opens edit form | None | None | Pre-fills with current values |
| Edit → **Save** | Updates reminder | `remindersApi.update(rid, body)` → PATCH /api/reminders/{rid} | `{ title?, type?, priority? }` | Updated ReminderOut |
| Delete button | Deletes reminder | `remindersApi.delete(rid)` → DELETE /api/reminders/{rid} | `rid: string` | Reminder removed |

**Database Tables**: `reminders`

---

### 3.18 Achievements (`/student/achievements`)

**File**: `frontend-web/src/app/(dashboard)/student/achievements/page.tsx`

**On Page Load**:
```
Uses profile.badges from AuthContext (loaded on app mount)
profile.points, profile.streak also displayed
```

| Element | Action | Details |
|---------|--------|---------|
| Badge grid | Display | Shows all earned badges with names |
| Points counter | Display | Shows total points |
| Streak counter | Display | Shows current streak |

**Database Tables**: `users` (badges, points, streak fields)

---

### 3.19 Profile (`/student/profile`)

**File**: `frontend-web/src/app/(dashboard)/student/profile/page.tsx`

**On Page Load**:
```
Uses profile from AuthContext (already loaded)
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Avatar (click) | Opens file picker | None | None | File picker dialog |
| Avatar upload | Uploads photo | `usersApi.uploadAvatar(file)` → POST /api/users/me/avatar | `File (multipart)` | `{ photo_url: string }` |
| Display Name | Input (text) | None until Save | Name string | Stores locally |
| Class / Unit | Input | None until Save | Class name | Stores locally |
| Year | Dropdown | None until Save | Year number | Stores locally |
| Semester | Dropdown | None until Save | Semester number | Stores locally |
| **Save Changes** | Updates profile | `usersApi.updateMe(body)` → PATCH /api/users/me | `{ display_name?, class_name?, year?, semester?, photo_url? }` | Updated UserOut → refreshProfile() updates AuthContext |

**Database Tables**: `users`

---

### 3.20 Attendance (`/student/attendance`)

**File**: `frontend-web/src/app/(dashboard)/student/attendance/page.tsx`

**On Page Load**:
```
attendanceApi.myAttendance() → GET /api/attendance/student/my → MyAttendance[]
```

| Element | Action | Details |
|---------|--------|---------|
| Course attendance cards | Display | Shows per-course: total sessions, present, late, absent, percentage |
| Progress bar | Display | Visual attendance percentage |

**Database Tables**: `attendance`, `attendanceRecords`

---

### 3.21 Notifications (`/student/notifications`)

**File**: `frontend-web/src/app/(dashboard)/student/notifications/page.tsx`

**On Page Load**:
```
notificationsApi.list() → GET /api/notifications/ → NotificationOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Notification card | Display | None | None | Shows title, message, type, timestamp, read status |
| Notification (click) | Marks as read + navigates | `notificationsApi.markRead(nid)` → PATCH /api/notifications/{nid}/read | `nid: string` | Notification marked read, navigates to `notification.link` |
| **Mark All Read** button | Marks all read | `notificationsApi.markAllRead()` → POST /api/notifications/read-all | None | All notifications marked read |

**Database Tables**: `notifications`

---

### 3.22 Activity Feed (`/student/activity`)

**File**: `frontend-web/src/app/(dashboard)/student/activity/page.tsx`

**On Page Load**:
```
activityApi.list() → GET /api/activity/ → ActivityOut[]
```

| Element | Action | Details |
|---------|--------|---------|
| Activity list | Display | Shows action type, resource type, title, timestamp |

**Database Tables**: `activityFeed`

---

### 3.23 Certificates (`/student/certificates`)

**File**: `frontend-web/src/app/(dashboard)/student/certificates/page.tsx`

**On Page Load**:
```
certificatesApi.my() → GET /api/certificates/my → CertificateOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Certificate cards | Display | None | None | Shows course name, completion %, issued date, certificate number |
| **Claim Certificate** button | Claims for a course | `certificatesApi.claim(courseId)` → POST /api/certificates/claim/{cid} | `courseId` | CertificateOut (if eligible) |
| **Verify** button | Verifies certificate | `certificatesApi.verify(certNumber)` → GET /api/certificates/verify/{num} | `certNumber: string` | CertificateOut (validation) |

**Database Tables**: `certificates`

---

### 3.24 Study Materials (AI) (`/student/study-materials`)

**File**: `frontend-web/src/app/(dashboard)/student/study-materials/page.tsx`

**On Page Load**:
```
1. coursesApi.enrolled() → GET /api/courses/enrolled → CourseOut[]
2. aiStudyMaterialsApi.list() → GET /api/ai/study-materials/ → StudyMaterial[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Course/Resource selector | Selects context | None | Selection | Filters available resources |
| **Generate Summary** | AI generates summary | `aiStudyMaterialsApi.generate({ resource_id, course_id, type: "summary" })` → POST /api/ai/study-materials/generate | `{ resource_id, course_id, type }` | StudyMaterial with markdown content |
| **Generate Flashcards** | AI generates flashcards | Same endpoint, `type: "flashcards"` | Same | StudyMaterial with JSON flashcard content |
| **Generate Quiz** | AI generates practice quiz | Same endpoint, `type: "quiz"` | Same | StudyMaterial with JSON quiz content |
| Delete material | Removes generated material | `aiStudyMaterialsApi.delete(id)` → DELETE /api/ai/study-materials/{id} | `materialId` | Material removed |

**Database Tables**: `studyMaterials`

---

### 3.25 Exam Planner (AI) (`/student/exam-planner`)

**File**: `frontend-web/src/app/(dashboard)/student/exam-planner/page.tsx`

**On Page Load**:
```
1. coursesApi.enrolled() → GET /api/courses/enrolled
2. aiStudyPlanApi.getExamPlans() → GET /api/ai/study-plan/exam-plans → ExamPlan[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Add Exam form | Inputs: course, date, topics | None (local) | Course selection, date, topics | Stores exam entry locally |
| **Generate Plan** | AI creates study plan | `aiStudyPlanApi.createExamPlan(exams)` → POST /api/ai/study-plan/exam-plan | `[{ course_id, course_name, exam_date, topics[] }]` | ExamPlan { plan: ExamPlanDay[], tips[] } |
| Delete plan | Removes plan | `aiStudyPlanApi.deleteExamPlan(planId)` → DELETE /api/ai/study-plan/{planId} | `planId` | Plan removed |

**Database Tables**: `examPlans`

---

### 3.26 Study Guide (AI) (`/student/study-guide`)

**File**: `frontend-web/src/app/(dashboard)/student/study-guide/page.tsx`

**On Page Load**:
```
aiStudyPlanApi.dailyGuide() → GET /api/ai/study-plan/daily-guide → DailyGuide
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Daily recommendations | Display | None | None | Shows course, topic, priority, reason, estimated time |
| Motivational message | Display | None | None | AI-generated motivational text |
| Timetable input | Textarea for paste | None until Analyze | Timetable text | Stores locally |
| **Analyze Timetable** | AI analyzes schedule | `aiStudyPlanApi.analyzeTimetable(text)` → POST /api/ai/study-plan/timetable-analyze | `{ timetable_text: string }` | TimetableAnalysis { parsed_schedule, study_slots, suggestions } |

---

## 4. Lecturer Role Workflows

### 4.1 Lecturer Dashboard (`/lecturer/dashboard`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/dashboard/page.tsx`

**On Page Load**:
```
1. coursesApi.teaching() → GET /api/courses/teaching → CourseOut[]
2. For each course:
   - Accumulate enrolled_count → totalStudents
   - discussionsApi.list(c.id) → GET /api/courses/{cid}/discussions/ → last 2 messages per course
3. assignmentsApi.pendingReviews() → GET /api/assignments/pending-reviews → pending review items
```

| Element | Action | Details |
|---------|--------|---------|
| Welcome Banner | Display | Shows lecturer name, active classes count |
| **Manage** link | Navigation | `/lecturer/class-management` |
| **Create Class** button (if no courses) | Navigation | `/lecturer/class-management` |
| Course Card (click) | Navigation | `/lecturer/course/{courseId}` |
| Quick Stats | Display | Total Students count, Courses count |
| Action Required section | Display | Shows assignments with ungraded submissions (count) |
| Pending review item (click) | Navigation | `/lecturer/course/{courseId}/assignments` |
| Recent Discussions | Display | Latest discussion messages across all courses |
| Discussion item (click) | Navigation | `/lecturer/course/{courseId}/discussions` |

**Database Tables**: `courses`, `discussions`, `assignments`, `submissions`

---

### 4.2 Class Management (`/lecturer/class-management`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/class-management/page.tsx`

**On Page Load**:
```
coursesApi.teaching() → GET /api/courses/teaching → CourseOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **Create Class** button | Opens Create Modal | None | None | Shows creation form |

#### Create Class Modal

| Field | Type | Details |
|-------|------|---------|
| Google Sites URL | Input (optional) | For AI import |
| **Import** button | AI scrapes site | `aiImportApi.scrapeGoogleSites(url)` → POST /api/ai/import/google-sites/scrape | `{ url }` | ScrapeResult { course_name?, course_code?, modules[] } |
| Preview modules (editable) | Module list with items | None (local editing) | Edit titles, descriptions, items | Modified module list |
| Course Name | SelectWithOther | From `COURSE_NAMES` constant |
| Course Code | SelectWithOther | From `COURSE_CODES` constant |
| Semester | Dropdown | 1-7 + Short |
| Theme Color | Color picker (8 options) | Click to select |
| Pattern Icon | Icon picker (9 options) | Click to select |
| **Create** / **Create with N Modules** | Submit | `coursesApi.create(body)` → POST /api/courses/ then optionally `aiImportApi.importEditedModules(courseId, modules)` → POST /api/ai/import/google-sites/import-edited | `{ course_name, course_code, semester, theme_color?, pattern? }` | CourseOut created, modules imported |

#### Course Card Actions

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Card (click) | Navigation | None | None | `/lecturer/course/{courseId}` |
| Join Code → Copy button | Copies to clipboard | `navigator.clipboard.writeText(code)` | None | Code copied, checkmark shown 2s |
| Edit button (pencil) | Opens Edit Modal | None | Pre-fills form | Shows edit form |
| Edit → **Update** | Updates course | `coursesApi.update(id, body)` → PATCH /api/courses/{id} | `{ course_name?, course_code?, semester?, theme_color?, pattern? }` | Updated CourseOut |
| Duplicate button (copy) | Opens Duplicate Modal | None | None | Shows confirmation |
| Duplicate → **Duplicate Class** | Duplicates course + modules | `coursesApi.create(body)` then copies modules via `modulesApi.createModule()` + `modulesApi.createItem()` | Original course data | New CourseOut with copied modules (no students) |
| Delete button (trash) | Opens Delete Modal | None | None | Shows confirmation |
| Delete → **Yes, Delete** | Deletes course | `coursesApi.delete(id)` → DELETE /api/courses/{id} | `courseId` | Course removed |

**Database Tables**: `courses`, `courseModules`, `moduleItems`

---

### 4.3 Lecturer Course Detail (`/lecturer/course/[cid]`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/page.tsx`

**On Page Load**:
```
1. coursesApi.get(cid) → GET /api/courses/{cid} → CourseOut
2. participationApi.get(cid) → GET /api/courses/{cid}/participation/ → participation scores
```

| Element | Action | Destination / API |
|---------|--------|-------------------|
| **Back to Classes** | Navigation | `/lecturer/class-management` |
| **Resources** tool | Navigation | `/lecturer/course/{cid}/resources` |
| **Assignments** tool | Navigation | `/lecturer/course/{cid}/assignments` |
| **Quizzes** tool | Navigation | `/lecturer/course/{cid}/quizzes` |
| **Gradebook** tool | Navigation | `/lecturer/course/{cid}/gradebook` |
| **Announcements** tool | Navigation | `/lecturer/course/{cid}/announcements` |
| **Attendance** tool | Navigation | `/lecturer/course/{cid}/attendance` |
| **Question Bank** tool | Navigation | `/lecturer/course/{cid}/question-bank` |
| **Completion** tool | Navigation | `/lecturer/course/{cid}/completion` |
| **Groups** tool | Navigation | `/lecturer/course/{cid}/groups` |
| **Forum** tool | Navigation | `/lecturer/course/{cid}/forum` |
| **Class Chat** tool | Navigation | `/lecturer/course/{cid}/discussions` |
| **Add Student** button | Opens search modal | `coursesApi.searchStudents(q)` → GET /api/courses/search/students?q={q} |
| Add Student → **Add** | Enrolls student | `coursesApi.addStudent(cid, studentId)` → POST /api/courses/{cid}/add-student |
| **View Students** | Loads student list | `coursesApi.getStudents(cid)` → GET /api/courses/{cid}/students |
| **Show Participation Scores** | Toggles display | Already loaded on mount | Shows ParticipationScore component |

---

### 4.4 Lecturer Assignments (`/lecturer/course/[cid]/assignments`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/assignments/page.tsx`

**On Page Load**:
```
1. assignmentsApi.list(cid) → GET /api/assignments/?course_id={cid} → AssignmentOut[]
2. For each: assignmentsApi.getSubmissions(aid) → GET /api/assignments/{aid}/submissions → SubmissionOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **Create Assignment** | Opens modal | None | None | Shows creation form |
| Title | Input (text, required) | None | Title string | |
| Description | Textarea | None | Description text | |
| Deadline | Date/time picker | None | ISO date string | |
| Available From | Date/time picker (optional) | None | ISO date string | |
| Available Until | Date/time picker (optional) | None | ISO date string | |
| Assignment Type | Dropdown | None | "map"/"file"/"link"/"quiz" | |
| Quiz ID | Dropdown (if type=quiz) | None | Quiz selection | |
| Prerequisite | Dropdown (optional) | None | Another assignment | |
| Min Grade | Number (if prerequisite) | None | Min grade for access | |
| **Create** | Creates assignment | `assignmentsApi.create(body)` → POST /api/assignments/ | `{ course_id, title, description?, deadline, available_from?, available_until?, prerequisite_id?, min_grade?, assignment_type?, quiz_id? }` | AssignmentOut |
| **Edit** (pencil icon) | Opens edit modal | Pre-fills form | Same fields | |
| Edit → **Update** | Updates assignment | `assignmentsApi.update(aid, body)` → PATCH /api/assignments/{aid} | Same as create | Updated AssignmentOut |
| **Delete** (trash icon) | Deletes assignment | `assignmentsApi.delete(aid)` → DELETE /api/assignments/{aid} | `aid` | Assignment removed |
| **View Submissions** | Expands submission list | Already loaded | None | Shows SubmissionOut[] |
| Submission → **Grade** | Opens grading form | None | None | Grade + feedback form |
| Grade: Score | Number input | None | Grade number | |
| Grade: Feedback | Textarea | None | Feedback text | |
| **Submit Grade** | Grades submission | `assignmentsApi.grade(aid, sid, { grade, feedback })` → PATCH /api/assignments/{aid}/submissions/{sid}/grade | `{ grade: number, feedback?: string }` | Updated SubmissionOut with grade |
| **AI Grade Recommend** | AI suggestion | `aiGradingApi.recommend(sid)` → POST /api/ai/grading/recommend/{sid} | `submissionId` | GradeRecommendation { recommended_grade, justification, confidence } |
| **AI Plagiarism Check** | AI analysis | `aiPlagiarismApi.analyze(sid)` → POST /api/ai/plagiarism/analyze/{sid} | `submissionId` | PlagiarismReport { plagiarism_percentage, sources, summary } |
| **Similarity Report** | Cross-submission check | `assignmentsApi.similarityReport(aid)` → GET /api/assignments/{aid}/similarity-report | `aid` | `[{ student_a, student_b, similarity }]` |
| **Rubric** → Create | Creates rubric | `rubricsApi.create(body)` → POST /api/rubrics/ | `{ assignment_id, title, criteria[] }` | RubricOut |
| Grade with Rubric | Rubric-based grading | `rubricsApi.gradeWithRubric(aid, sid, { criterion_scores, feedback })` → POST /api/rubrics/grade/{aid}/{sid} | `{ criterion_scores: Record, feedback? }` | `{ grade, total_earned, total_possible }` |

**Database Tables**: `assignments`, `submissions`, `rubrics`, `plagiarismReports`, `gradeRecommendations`

---

### 4.5 Lecturer Resources (`/lecturer/course/[cid]/resources`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/resources/page.tsx`

**On Page Load**:
```
modulesApi.list(cid) → GET /api/courses/{cid}/modules/ → ModuleOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **Create Module** | Creates new module | `modulesApi.createModule(cid, { title, description })` → POST /api/courses/{cid}/modules/ | `{ title, description? }` | ModuleOut |
| **Delete Module** | Deletes module | `modulesApi.deleteModule(cid, mid)` → DELETE /api/courses/{cid}/modules/{mid} | `moduleId` | Module removed |
| **Add Item** (link) | Creates link item | `modulesApi.createItem(cid, mid, { title, type, url })` → POST /api/courses/{cid}/modules/{mid}/items | `{ title, type, url }` | ModuleItemOut |
| **Upload File** | Uploads file item | `modulesApi.uploadItem(cid, mid, formData)` → POST /api/courses/{cid}/modules/{mid}/items/upload | `FormData (file + title)` | ModuleItemOut |
| **Delete Item** | Deletes item | `modulesApi.deleteItem(cid, mid, iid)` → DELETE /api/courses/{cid}/modules/{mid}/items/{iid} | `itemId` | Item removed |
| **Reorder Modules** (drag) | Reorders modules | `modulesApi.reorderModules(cid, order)` → PATCH /api/courses/{cid}/modules/reorder | `{ order: string[] }` | Modules reordered |
| **Import from Google Sites** | AI import | `aiImportApi.importGoogleSites(url, cid)` → POST /api/ai/import/google-sites | `{ url, course_id }` | `{ modules_created, items_created }` |

**Database Tables**: `courseModules`, `moduleItems`

---

### 4.6 Lecturer Quizzes (`/lecturer/course/[cid]/quizzes`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/quizzes/page.tsx`

**On Page Load**:
```
quizzesApi.list(cid) → GET /api/quizzes/?course_id={cid} → QuizOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **Create Quiz** | Opens modal | None | None | Quiz creation form |
| Title | Input (required) | None | Title string | |
| Description | Textarea | None | Description text | |
| Time Limit | Number input (minutes) | None | Minutes or null | |
| Deadline | Date/time picker | None | ISO date or null | |
| Shuffle Questions | Toggle | None | Boolean | |
| Show Results | Toggle | None | Boolean | |
| **Create** | Creates quiz | `quizzesApi.create(body)` → POST /api/quizzes/ | `{ course_id, title, description?, time_limit_minutes?, deadline?, shuffle_questions?, show_results?, questions? }` | QuizOut |
| **Edit Quiz** | Updates quiz | `quizzesApi.update(qid, body)` → PATCH /api/quizzes/{qid} | Same as create (partial) | Updated QuizOut |
| **Delete Quiz** | Deletes quiz | `quizzesApi.delete(qid)` → DELETE /api/quizzes/{qid} | `qid` | Quiz removed |
| **Add Question** | Opens question form | None | None | Question type/text/options form |
| Question → **Save** | Adds question | `quizzesApi.addQuestion(qid, body)` → POST /api/quizzes/{qid}/questions | `{ type, text, options?, correct_answer, points? }` | QuestionOut |
| **Delete Question** | Removes question | `quizzesApi.deleteQuestion(qid, questionId)` → DELETE /api/quizzes/{qid}/questions/{questionId} | IDs | Question removed |
| **View Attempts** | Lists student attempts | `quizzesApi.getAttempts(qid)` → GET /api/quizzes/{qid}/attempts | `qid` | QuizAttemptOut[] |
| **Import from Bank** | Imports questions | `questionBankApi.importToQuiz(qid, questionIds)` → POST /api/question-bank/import-to-quiz | `{ quiz_id, question_ids[] }` | `{ imported: number }` |
| **Export to Bank** | Exports to bank | `questionBankApi.exportFromQuiz(qid, courseId)` → POST /api/question-bank/export-from-quiz | `{ quiz_id, course_id }` | `{ exported: number }` |

**Database Tables**: `quizzes`, `quizQuestions`, `quizAttempts`, `questionBank`

---

### 4.7 Lecturer Announcements (`/lecturer/course/[cid]/announcements`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/announcements/page.tsx`

**On Page Load**:
```
announcementsApi.list(cid) → GET /api/courses/{cid}/announcements/ → AnnouncementOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **Create Announcement** | Opens form | None | None | Title + content form |
| Title | Input (required) | None | Title string | |
| Content | Textarea (required) | None | Content text | |
| **Post** | Creates announcement | `announcementsApi.create(cid, { title, content })` → POST /api/courses/{cid}/announcements/ | `{ title, content }` | AnnouncementOut |
| **Delete** (trash icon) | Deletes announcement | `announcementsApi.delete(cid, annId)` → DELETE /api/courses/{cid}/announcements/{annId} | `annId` | Announcement removed |

**Database Tables**: `announcements`

---

### 4.8 Lecturer Gradebook (`/lecturer/course/[cid]/gradebook`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/gradebook/page.tsx`

**On Page Load**:
```
1. gradebookApi.course(cid) → GET /api/gradebook/course/{cid} → LecturerGradebookRow[]
2. gradebookApi.getSettings(cid) → GET /api/gradebook/settings/{cid} → { assignment_weight, quiz_weight }
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Student grade table | Display | None | None | Shows all students with their assignment/quiz grades |
| Weight settings | Inputs | None until Save | Numbers | |
| **Save Weights** | Updates weights | `gradebookApi.updateSettings(cid, aW, qW)` → POST /api/gradebook/settings/{cid} | `assignment_weight, quiz_weight` | `{ ok: boolean }` |
| **Export CSV** | Downloads CSV | `gradebookApi.exportCsv(cid)` → opens URL | None | CSV file download |
| Student row (click) | Opens student report | `gradebookApi.studentReport(studentId, cid)` → GET /api/gradebook/student/{sid}/course/{cid} | `{ studentId, courseId }` | StudentReport with grades, attendance, activity |

**Database Tables**: `submissions`, `quizAttempts`, `assignments`, `quizzes`, `attendance`, `activityFeed`

---

### 4.9 Lecturer Attendance (`/lecturer/course/[cid]/attendance`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/attendance/page.tsx`

**On Page Load**:
```
1. attendanceApi.getSessions(cid) → GET /api/attendance/course/{cid} → AttendanceSession[]
2. coursesApi.getStudents(cid) → GET /api/courses/{cid}/students → UserOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **Create Session** | Opens form | None | None | Date + title form |
| **Create** | Creates session | `attendanceApi.createSession(cid, { date, title })` → POST /api/attendance/course/{cid} | `{ date, title? }` | `{ id, date, title }` |
| Student → Status dropdown | Change status | `attendanceApi.updateRecord(sid, { student_id, status })` → PATCH /api/attendance/session/{sid}/record | `{ student_id, status: "present"/"late"/"absent" }` | `{ ok: true }` |
| **Mark All Present** | Bulk update | `attendanceApi.bulkUpdate(sid, records)` → PATCH /api/attendance/session/{sid}/bulk | `[{ student_id, status }]` | `{ ok: true }` |
| **Delete Session** | Deletes session | `attendanceApi.deleteSession(sid)` → DELETE /api/attendance/session/{sid} | `sessionId` | Session removed |

**Database Tables**: `attendance`, `attendanceRecords`

---

### 4.10 Lecturer Question Bank (`/lecturer/course/[cid]/question-bank`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/question-bank/page.tsx`

**On Page Load**:
```
questionBankApi.list(cid) → GET /api/question-bank/course/{cid} → QuestionBankOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Filter: Tag | Dropdown | `questionBankApi.list(cid, { tag })` | `tag: string` | Filtered questions |
| Filter: Difficulty | Dropdown | `questionBankApi.list(cid, { difficulty })` | `difficulty: string` | Filtered questions |
| Filter: Type | Dropdown | `questionBankApi.list(cid, { type })` | `type: string` | Filtered questions |
| **Add Question** | Opens form | None | None | Type, text, options, answer, points, tags, difficulty |
| **Save** | Creates question | `questionBankApi.create(body)` → POST /api/question-bank/ | `{ course_id, type, text, options?, correct_answer, points?, tags?, difficulty? }` | QuestionBankOut |
| **Bulk Import** | Creates multiple | `questionBankApi.bulkCreate(questions)` → POST /api/question-bank/bulk | `QuestionBankOut[]` | Multiple created |
| **Edit** | Updates question | `questionBankApi.update(qid, body)` → PATCH /api/question-bank/{qid} | Same as create | Updated QuestionBankOut |
| **Delete** | Deletes question | `questionBankApi.delete(qid)` → DELETE /api/question-bank/{qid} | `qid` | Question removed |

**Database Tables**: `questionBank`

---

### 4.11 Lecturer Forum (`/lecturer/course/[cid]/forum`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/forum/page.tsx`

Same as Student Forum (Section 3.12) with additional lecturer capabilities:

| Additional Element | Action | API Call | Input | Output |
|-------------------|--------|----------|-------|--------|
| **Pin/Unpin** topic | Toggles pin | `topicsApi.togglePin(cid, tid)` → PATCH /api/courses/{cid}/topics/{tid}/pin | `topicId` | `{ pinned: boolean }` |
| **Edit Topic** | Updates topic | `topicsApi.update(cid, tid, body)` → PATCH /api/courses/{cid}/topics/{tid} | `{ title, description?, pinned? }` | Updated TopicOut |
| **Delete Topic** | Deletes topic | `topicsApi.delete(cid, tid)` → DELETE /api/courses/{cid}/topics/{tid} | `topicId` | Topic removed |

---

### 4.12 Lecturer Groups (`/lecturer/course/[cid]/groups`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/groups/page.tsx`

**On Page Load**:
```
1. groupsApi.list(cid) → GET /api/courses/{cid}/groups/ → GroupOut[]
2. coursesApi.getStudents(cid) → GET /api/courses/{cid}/students → UserOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **Create Group** | Opens form | None | Name + description | |
| **Create** | Creates group | `groupsApi.create(cid, { name, description })` → POST /api/courses/{cid}/groups/ | `{ name, description? }` | GroupOut |
| **Auto-Assign** | AI assigns groups | `groupsApi.autoAssign(cid, count)` → POST /api/courses/{cid}/groups/auto-assign | `{ group_count?: number }` | GroupOut[] |
| **Add Members** | Adds students | `groupsApi.addMembers(cid, gid, studentIds)` → POST /api/courses/{cid}/groups/{gid}/members | `{ student_ids: string[] }` | `{ ok: true }` |
| **Remove Member** | Removes student | `groupsApi.removeMember(cid, gid, sid)` → DELETE /api/courses/{cid}/groups/{gid}/members/{sid} | `studentId` | `{ ok: true }` |
| **Delete Group** | Deletes group | `groupsApi.delete(cid, gid)` → DELETE /api/courses/{cid}/groups/{gid} | `groupId` | Group removed |

**Database Tables**: `courseGroups`, `groupMembers`

---

### 4.13 Lecturer Completion Tracking (`/lecturer/course/[cid]/completion`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/completion/page.tsx`

**On Page Load**:
```
1. completionApi.course(cid) → GET /api/completion/course/{cid} → StudentCompletion[]
2. completionApi.summary(cid) → GET /api/completion/course/{cid}/summary → CompletionSummary
```

| Element | Action | Details |
|---------|--------|---------|
| Summary cards | Display | Total students, avg completion, fully complete count, at-risk count |
| Rate cards | Display | Assignment/quiz/resource completion rates |
| Student table | Display | Each student: assignments submitted/graded, quizzes completed, resources opened, overall % |

**Database Tables**: `submissions`, `quizAttempts`, `resourceProgress`, `assignments`, `quizzes`, `courseModules`

---

### 4.14 Lecturer Analytics (`/lecturer/analytics`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/analytics/page.tsx`

**On Page Load**:
```
1. analyticsApi.get() → GET /api/analytics/ → AnalyticsOut { total_students, total_courses, avg_submission_rate, assignment_stats[] }
2. analyticsApi.mapTypePopularity() → GET /api/analytics/map-type-popularity → [{ type, count }]
3. analyticsApi.engagementHeatmap() → GET /api/analytics/engagement-heatmap → { data[][], days[] }
4. analyticsApi.atRiskStudents() → GET /api/analytics/at-risk-students → student list with reasons
5. analyticsApi.submissionTrends() → GET /api/analytics/submission-trends → [{ week, submissions }]
```

| Element | Action | Details |
|---------|--------|---------|
| Summary cards | Display | Total students, courses, avg submission rate |
| Assignment stats table | Display | Per-assignment: submitted/total |
| Map type chart | Display | Pie/bar chart of map type popularity |
| Engagement heatmap | Display | Grid showing activity by day/hour |
| At-risk students list | Display | Students with low activity + reason |
| Submission trends chart | Display | Weekly submission counts over time |

**Database Tables**: `users`, `courses`, `assignments`, `submissions`, `maps`, `activityFeed`

---

### 4.15 Manage Badges (`/lecturer/manage-badges`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/manage-badges/page.tsx`

**On Page Load**:
```
1. coursesApi.teaching() → GET /api/courses/teaching → CourseOut[]
2. For selected course: coursesApi.getStudents(cid) → GET /api/courses/{cid}/students → UserOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Course selector | Dropdown | Loads students for course | `courseId` | Student list |
| Badge selector | Predefined badge list | None | Badge ID selection | |
| Student selector | Student list | None | Student selection | |
| **Award Badge** | Awards badge | `badgesApi.award({ student_id, badge_id })` → POST /api/badges/award | `{ student_id, badge_id }` | `{ ok: true }` |
| **Revoke Badge** | Revokes badge | `badgesApi.revoke({ student_id, badge_id })` → POST /api/badges/revoke | `{ student_id, badge_id }` | `{ ok: true }` |

**Database Tables**: `users` (badges array)

---

### 4.16 Review Maps (`/lecturer/review-maps`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/review-maps/page.tsx`

**On Page Load**:
```
1. coursesApi.teaching() → GET /api/courses/teaching → CourseOut[]
2. For selected course:
   - mapsApi.searchByCourse(cid) → GET /api/maps/search/by-course/{cid} → MapOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Course selector | Dropdown | `mapsApi.searchByCourse(cid)` | `courseId` | MapOut[] for that course |
| Search by code | Input | `mapsApi.searchByCode(code)` → GET /api/maps/search/by-code?code={code} | `code: string` | MapOut[] |
| Search by email | Input | `mapsApi.searchByEmail(email)` → GET /api/maps/search/by-email?email={email} | `email: string` | MapOut[] |
| Map card (click) | Navigation | None | None | `/lecturer/view-map/{mapId}` |

---

### 4.17 View Map (`/lecturer/view-map/[mapId]`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/view-map/[mapId]/page.tsx`

**On Page Load**:
```
mapsApi.get(mapId) → GET /api/maps/{mapId} → MapOut (read-only view)
```

| Element | Action | Details |
|---------|--------|---------|
| React Flow canvas | Read-only display | Shows map nodes and edges |
| Map info | Display | Title, owner email, last modified, share code |

---

### 4.18 Lecturer Messages (`/lecturer/messages`)

Same workflow as Student Messages (Section 3.15). Both roles use the same `messagingApi` namespace.

---

### 4.19 Lecturer Planner (`/lecturer/planner`)

Same workflow as Student Planner (Section 3.17). Both roles use the same `remindersApi` namespace.

---

### 4.20 Lecturer Profile (`/lecturer/profile`)

**File**: `frontend-web/src/app/(dashboard)/lecturer/profile/page.tsx`

Same workflow as Student Profile (Section 3.19) with lecturer-specific fields:

| Field | Type | Details |
|-------|------|---------|
| Display Name | Input | |
| Class / Unit | SelectWithOther | |
| Department | SelectWithOther | Lecturer-specific field |
| Avatar | File upload | |

---

### 4.21 Lecturer Notifications (`/lecturer/notifications`)

Same workflow as Student Notifications (Section 3.21).

---

## 5. Admin Role Workflows

### 5.1 Admin Dashboard (`/admin/dashboard`)

**File**: `frontend-web/src/app/(dashboard)/admin/dashboard/page.tsx`

**On Page Load**:
```
1. adminApi.getUsers() → GET /api/admin/users → UserOut[] (all users)
2. adminApi.getAuditLogs({ limit: 10 }) → GET /api/admin/audit-logs?limit=10 → AuditLogOut[]
```

| Element | Action | Details |
|---------|--------|---------|
| User stats cards | Display | Total users by role |
| Recent audit logs | Display | Latest system activity |
| Navigation links | Navigation | To /admin/users, /admin/audit-logs, /admin/homepage-editor |

---

### 5.2 Admin User Management (`/admin/users`)

**File**: `frontend-web/src/app/(dashboard)/admin/users/page.tsx`

**On Page Load**:
```
adminApi.getUsers() → GET /api/admin/users → UserOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Role filter | Dropdown | `adminApi.getUsers({ role })` | `role: string` | Filtered UserOut[] |
| User row | Display | None | None | Name, email, role, created date |
| **Change Role** dropdown | Updates user role | `adminApi.updateUserRole(uid, role)` → PATCH /api/admin/users/{uid}/role | `{ uid, role }` | `{ ok: true, new_role }` |

**Database Tables**: `users`

---

### 5.3 Admin Audit Logs (`/admin/audit-logs`)

**File**: `frontend-web/src/app/(dashboard)/admin/audit-logs/page.tsx`

**On Page Load**:
```
adminApi.getAuditLogs() → GET /api/admin/audit-logs → AuditLogOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| Resource type filter | Dropdown | `adminApi.getAuditLogs({ resource_type })` | `resource_type: string` | Filtered logs |
| User ID filter | Input | `adminApi.getAuditLogs({ user_id })` | `user_id: string` | Filtered logs |
| Limit | Number | `adminApi.getAuditLogs({ limit })` | `limit: number` | Limited logs |
| Log entries | Display | None | None | userId, action, resourceType, resourceId, details, timestamp |

**Database Tables**: `auditLogs`

---

### 5.4 Admin Homepage Editor (`/admin/homepage-editor`)

**File**: `frontend-web/src/app/(dashboard)/admin/homepage-editor/page.tsx`

**On Page Load**:
```
adminApi.getHomepageContent() → GET /api/admin/homepage/content → HomepageContentOut[]
```

| Element | Action | API Call | Input | Output |
|---------|--------|----------|-------|--------|
| **Add Content** | Opens form | None | None | Type, title, content, order form |
| **Create** | Creates content | `adminApi.createHomepageContent(body)` → POST /api/admin/homepage/content | `{ type, title, content?, image_url?, order? }` | HomepageContentOut |
| **Edit** | Updates content | `adminApi.updateHomepageContent(id, body)` → PATCH /api/admin/homepage/content/{id} | `{ type?, title?, content?, image_url?, order?, visible? }` | `{ ok: true }` |
| **Upload Image** | Uploads homepage image | `adminApi.uploadHomepageImage(file)` → POST /api/admin/homepage/upload | `File (multipart)` | `{ image_url: string }` |
| **Toggle Visibility** | Shows/hides content | `adminApi.updateHomepageContent(id, { visible })` | `{ visible: boolean }` | `{ ok: true }` |
| **Delete** | Removes content | `adminApi.deleteHomepageContent(id)` → DELETE /api/admin/homepage/content/{id} | `contentId` | Content removed |

**Database Tables**: `homepageContent`

---

## 6. Module Interconnections

### 6.1 How Modules Connect

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          AUTHENTICATION                                  │
│  Firebase Auth ←→ AuthContext ←→ All Pages (user/profile state)         │
│  POST /api/auth/sync ←→ Backend users table                            │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   COURSES    │  │   MIND MAPS  │  │   MESSAGING  │
│              │  │              │  │              │
│ teaching()   │  │ list()       │  │ conversations│
│ enrolled()   │  │ create()     │  │ send()       │
│ join()       │  │ update()     │  │ searchUsers()│
│ getStudents()│  │ delete()     │  │              │
└──────┬───────┘  │ collaborate  │  └──────────────┘
       │          │ annotate     │
       │          │ AI analyze   │
       │          └──────┬───────┘
       │                 │
       ▼                 │
┌──────────────────────┐ │  ┌───────────────────┐
│   COURSE MODULES     │ │  │   GRADEBOOK       │
│                      │ │  │                   │
│ ├─ Assignments ──────┼─┤  │ Unified view of:  │
│ │  ├─ Submissions ───┼─┘  │ ├─ Assignment     │
│ │  ├─ Grading        │    │ │  grades          │
│ │  ├─ Rubrics        │    │ ├─ Quiz scores    │
│ │  ├─ Peer Reviews   │    │ ├─ Attendance     │
│ │  └─ AI Plagiarism  │    │ └─ Weighted avg   │
│ │                    │    └───────────────────┘
│ ├─ Quizzes ──────────┤
│ │  ├─ Questions      │    ┌───────────────────┐
│ │  ├─ Attempts       │    │   ANALYTICS       │
│ │  └─ Question Bank  │    │                   │
│ │                    │    │ Aggregates from:  │
│ ├─ Resources         │    │ ├─ Submissions    │
│ │  ├─ Modules/Items  │    │ ├─ Maps           │
│ │  ├─ Progress Track │    │ ├─ Discussions    │
│ │  └─ AI Materials   │    │ └─ Attendance     │
│ │                    │    └───────────────────┘
│ ├─ Discussions       │
│ │  └─ Threaded       │    ┌───────────────────┐
│ │                    │    │   COMPLETION      │
│ ├─ Forum (Topics)    │    │                   │
│ │  └─ Topic Posts    │    │ Tracks per student│
│ │                    │    │ ├─ Assignments    │
│ ├─ Announcements     │    │ ├─ Quizzes       │
│ │                    │    │ └─ Resources     │
│ ├─ Attendance        │    └───────────────────┘
│ │  └─ Records        │
│ │                    │    ┌───────────────────┐
│ ├─ Groups            │    │   CERTIFICATES   │
│ │  └─ Members        │    │                   │
│ │                    │    │ Based on course   │
│ └─ Completion Track  │    │ completion %      │
│                      │    └───────────────────┘
└──────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                           AI FEATURES                                     │
│                                                                           │
│  ├─ AI Plagiarism    → Analyzes submission text for originality          │
│  ├─ AI Grading       → Recommends grades with justification              │
│  ├─ AI Companion     → Chat assistant with learning profile              │
│  ├─ AI Study Materials → Generates summaries/flashcards/quizzes          │
│  ├─ AI Study Plan    → Daily guides + exam planning                      │
│  ├─ AI Import        → Scrapes Google Sites into course modules          │
│  ├─ AI Images        → Generates images for mind map nodes               │
│  └─ AI MindMap Buddy → Analyzes maps, suggests nodes, chat about maps   │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                     SHARED MODULES                                        │
│                                                                           │
│  ├─ Reminders/Planner  → Both roles: personal task management            │
│  ├─ Messages/DM        → Both roles: private messaging                   │
│  ├─ Notifications      → Both roles: system notifications                │
│  ├─ Activity Feed      → Student: activity log                           │
│  ├─ Reflections        → Student: weekly confidence reflection           │
│  └─ Profile            → Both roles: personal settings                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow Between Modules

| Source Module | Target Module | Data Flow | Direction |
|---------------|---------------|-----------|-----------|
| Assignments | Gradebook | Assignment grades flow into unified gradebook | Assignment → Gradebook |
| Quizzes | Gradebook | Quiz scores flow into unified gradebook | Quiz → Gradebook |
| Assignments | Peer Reviews | Submissions available for peer review | Assignment → Peer Review |
| Question Bank | Quizzes | Questions imported from bank into quizzes | Bank → Quiz |
| Quizzes | Question Bank | Questions exported from quizzes to bank | Quiz → Bank |
| Courses | All submodules | Course ID links all submodules together | Course → All |
| Maps | Assignments | Maps can be submitted as assignment submissions | Map → Assignment |
| Resources | Progress Tracking | Resource opens tracked for completion | Resource → Progress |
| Assignments + Quizzes + Resources | Completion | All tracked for course completion percentage | All → Completion |
| Completion | Certificates | High completion % enables certificate claiming | Completion → Certificate |
| Submissions | AI Plagiarism | Submission text analyzed for plagiarism | Submission → AI |
| Submissions | AI Grading | Submission analyzed for grade recommendation | Submission → AI |
| Resources | AI Study Materials | Resources used to generate study materials | Resource → AI |
| Courses + Progress | AI Study Plan | Course data used for personalized study plans | Course → AI |
| Maps | AI MindMap Buddy | Map data analyzed for quality and suggestions | Map → AI |
| Auth | All modules | User identity and role required for all API calls | Auth → All |
| Participation | Course Detail | Discussion + map + submission counts per student | Multiple → Participation |

---

## 7. API-to-Database Mapping

### 7.1 Complete API Namespace → Database Table Mapping

| API Namespace | HTTP Method | Endpoint | Database Table(s) | Operation |
|---------------|------------|----------|-------------------|-----------|
| `authApi.sync` | POST | /api/auth/sync | `users` | CREATE/UPDATE |
| `authApi.me` | GET | /api/auth/me | `users` | READ |
| `usersApi.updateMe` | PATCH | /api/users/me | `users` | UPDATE |
| `usersApi.uploadAvatar` | POST | /api/users/me/avatar | `users` + filesystem | UPDATE |
| `usersApi.getUser` | GET | /api/users/{uid} | `users` | READ |
| `mapsApi.list` | GET | /api/maps/ | `maps` | READ |
| `mapsApi.create` | POST | /api/maps/ | `maps` | CREATE |
| `mapsApi.get` | GET | /api/maps/{id} | `maps` | READ |
| `mapsApi.update` | PATCH | /api/maps/{id} | `maps` | UPDATE |
| `mapsApi.delete` | DELETE | /api/maps/{id} | `maps` | DELETE |
| `mapsApi.searchByCode` | GET | /api/maps/search/by-code | `maps` | READ |
| `mapsApi.searchByEmail` | GET | /api/maps/search/by-email | `maps` | READ |
| `mapsApi.searchByCourse` | GET | /api/maps/search/by-course/{cid} | `maps`, `submissions` | READ |
| `mapsApi.addCollaborator` | POST | /api/maps/{id}/collaborators | `maps` (collaborators array) | UPDATE |
| `mapsApi.removeCollaborator` | DELETE | /api/maps/{id}/collaborators | `maps` (collaborators array) | UPDATE |
| `mapsApi.updatePresence` | POST | /api/maps/{id}/presence | `presence` | CREATE/UPDATE |
| `mapsApi.getPresence` | GET | /api/maps/{id}/presence | `presence` | READ |
| `mapsApi.getAnnotations` | GET | /api/maps/{id}/annotations | `annotations` | READ |
| `mapsApi.createAnnotation` | POST | /api/maps/{id}/annotations | `annotations` | CREATE |
| `mapsApi.deleteAnnotation` | DELETE | /api/maps/{id}/annotations/{annId} | `annotations` | DELETE |
| `mapsApi.uploadNodeImage` | POST | /api/maps/{id}/upload-image | filesystem | CREATE |
| `coursesApi.teaching` | GET | /api/courses/teaching | `courses` | READ |
| `coursesApi.enrolled` | GET | /api/courses/enrolled | `courses` | READ |
| `coursesApi.create` | POST | /api/courses/ | `courses` | CREATE |
| `coursesApi.get` | GET | /api/courses/{id} | `courses` | READ |
| `coursesApi.update` | PATCH | /api/courses/{id} | `courses` | UPDATE |
| `coursesApi.delete` | DELETE | /api/courses/{id} | `courses` + cascading deletes | DELETE |
| `coursesApi.join` | POST | /api/courses/join | `courses` (enrolledStudents) | UPDATE |
| `coursesApi.getStudents` | GET | /api/courses/{id}/students | `courses`, `users` | READ |
| `coursesApi.searchStudents` | GET | /api/courses/search/students | `users` | READ |
| `coursesApi.addStudent` | POST | /api/courses/{id}/add-student | `courses` (enrolledStudents) | UPDATE |
| `assignmentsApi.list` | GET | /api/assignments/ | `assignments` | READ |
| `assignmentsApi.create` | POST | /api/assignments/ | `assignments` | CREATE |
| `assignmentsApi.update` | PATCH | /api/assignments/{id} | `assignments` | UPDATE |
| `assignmentsApi.delete` | DELETE | /api/assignments/{id} | `assignments` | DELETE |
| `assignmentsApi.getSubmissions` | GET | /api/assignments/{id}/submissions | `submissions` | READ |
| `assignmentsApi.getMySubmission` | GET | /api/assignments/{id}/submissions/mine | `submissions` | READ |
| `assignmentsApi.submit` | POST | /api/assignments/{id}/submissions | `submissions` | CREATE |
| `assignmentsApi.grade` | PATCH | /api/assignments/{aid}/submissions/{sid}/grade | `submissions` | UPDATE |
| `assignmentsApi.uploadFile` | POST | /api/assignments/{id}/submissions/upload | `submissions` + filesystem | CREATE |
| `assignmentsApi.pendingReviews` | GET | /api/assignments/pending-reviews | `assignments`, `submissions` | READ |
| `assignmentsApi.similarityReport` | GET | /api/assignments/{id}/similarity-report | `submissions` | READ |
| `assignmentsApi.myUpcoming` | GET | /api/assignments/my-upcoming | `assignments`, `submissions`, `courses` | READ |
| `assignmentsApi.checkAccess` | GET | /api/assignments/{id}/access-check | `assignments`, `submissions` | READ |
| `discussionsApi.list` | GET | /api/courses/{cid}/discussions/ | `discussions` | READ |
| `discussionsApi.create` | POST | /api/courses/{cid}/discussions/ | `discussions` | CREATE |
| `discussionsApi.delete` | DELETE | /api/courses/{cid}/discussions/{mid} | `discussions` | DELETE |
| `discussionsApi.getReplies` | GET | /api/courses/{cid}/discussions/{mid}/replies | `discussions` | READ |
| `discussionsApi.reply` | POST | /api/courses/{cid}/discussions/{mid}/replies | `discussions` | CREATE |
| `announcementsApi.list` | GET | /api/courses/{cid}/announcements/ | `announcements` | READ |
| `announcementsApi.create` | POST | /api/courses/{cid}/announcements/ | `announcements` | CREATE |
| `announcementsApi.delete` | DELETE | /api/courses/{cid}/announcements/{id} | `announcements` | DELETE |
| `modulesApi.list` | GET | /api/courses/{cid}/modules/ | `courseModules`, `moduleItems` | READ |
| `modulesApi.createModule` | POST | /api/courses/{cid}/modules/ | `courseModules` | CREATE |
| `modulesApi.deleteModule` | DELETE | /api/courses/{cid}/modules/{mid} | `courseModules`, `moduleItems` | DELETE |
| `modulesApi.createItem` | POST | /api/courses/{cid}/modules/{mid}/items | `moduleItems` | CREATE |
| `modulesApi.deleteItem` | DELETE | /api/courses/{cid}/modules/{mid}/items/{iid} | `moduleItems` | DELETE |
| `modulesApi.reorderModules` | PATCH | /api/courses/{cid}/modules/reorder | `courseModules` | UPDATE |
| `modulesApi.uploadItem` | POST | /api/courses/{cid}/modules/{mid}/items/upload | `moduleItems` + filesystem | CREATE |
| `modulesApi.trackProgress` | POST | /api/courses/{cid}/modules/{mid}/items/{iid}/track | `resourceProgress` | CREATE |
| `modulesApi.getProgress` | GET | /api/courses/{cid}/modules/progress | `resourceProgress` | READ |
| `modulesApi.cloneTemplate` | POST | /api/courses/{cid}/modules/{mid}/items/{iid}/clone | `maps` | CREATE |
| `remindersApi.list` | GET | /api/reminders/ | `reminders` | READ |
| `remindersApi.create` | POST | /api/reminders/ | `reminders` | CREATE |
| `remindersApi.update` | PATCH | /api/reminders/{rid} | `reminders` | UPDATE |
| `remindersApi.delete` | DELETE | /api/reminders/{rid} | `reminders` | DELETE |
| `badgesApi.award` | POST | /api/badges/award | `users` (badges array) | UPDATE |
| `badgesApi.revoke` | POST | /api/badges/revoke | `users` (badges array) | UPDATE |
| `analyticsApi.get` | GET | /api/analytics/ | `users`, `courses`, `submissions` | READ |
| `analyticsApi.mapTypePopularity` | GET | /api/analytics/map-type-popularity | `maps` | READ |
| `analyticsApi.engagementHeatmap` | GET | /api/analytics/engagement-heatmap | `activityFeed` | READ |
| `analyticsApi.atRiskStudents` | GET | /api/analytics/at-risk-students | `users`, `submissions`, `activityFeed` | READ |
| `analyticsApi.submissionTrends` | GET | /api/analytics/submission-trends | `submissions` | READ |
| `quizzesApi.list` | GET | /api/quizzes/ | `quizzes` | READ |
| `quizzesApi.create` | POST | /api/quizzes/ | `quizzes`, `quizQuestions` | CREATE |
| `quizzesApi.update` | PATCH | /api/quizzes/{qid} | `quizzes` | UPDATE |
| `quizzesApi.delete` | DELETE | /api/quizzes/{qid} | `quizzes`, `quizQuestions` | DELETE |
| `quizzesApi.getQuestions` | GET | /api/quizzes/{qid}/questions | `quizQuestions` | READ |
| `quizzesApi.addQuestion` | POST | /api/quizzes/{qid}/questions | `quizQuestions` | CREATE |
| `quizzesApi.deleteQuestion` | DELETE | /api/quizzes/{qid}/questions/{id} | `quizQuestions` | DELETE |
| `quizzesApi.submitAttempt` | POST | /api/quizzes/{qid}/attempt | `quizAttempts` | CREATE |
| `quizzesApi.getMyAttempt` | GET | /api/quizzes/{qid}/attempt/mine | `quizAttempts` | READ |
| `quizzesApi.getAttempts` | GET | /api/quizzes/{qid}/attempts | `quizAttempts` | READ |
| `quizzesApi.getResults` | GET | /api/quizzes/{qid}/results | `quizQuestions` | READ |
| `gradebookApi.my` | GET | /api/gradebook/my | `submissions`, `quizAttempts`, `courses` | READ |
| `gradebookApi.course` | GET | /api/gradebook/course/{cid} | `submissions`, `quizAttempts`, `users` | READ |
| `gradebookApi.exportCsv` | GET | /api/gradebook/course/{cid}/export | Same as above | READ (CSV) |
| `gradebookApi.getSettings` | GET | /api/gradebook/settings/{cid} | `gradebookSettings` | READ |
| `gradebookApi.updateSettings` | POST | /api/gradebook/settings/{cid} | `gradebookSettings` | CREATE/UPDATE |
| `gradebookApi.studentReport` | GET | /api/gradebook/student/{sid}/course/{cid} | Multiple tables | READ |
| `messagingApi.conversations` | GET | /api/messages/conversations | `conversations` | READ |
| `messagingApi.getOrCreate` | POST | /api/messages/conversations/{uid} | `conversations` | CREATE/READ |
| `messagingApi.getMessages` | GET | /api/messages/conversations/{cid}/messages | `messages` | READ |
| `messagingApi.send` | POST | /api/messages/conversations/{cid} | `messages` | CREATE |
| `messagingApi.searchUsers` | GET | /api/messages/search-users | `users` | READ |
| `peerReviewApi.getReviewable` | GET | /api/peer-reviews/assignment/{aid} | `submissions`, `peerReviews` | READ |
| `peerReviewApi.submitReview` | POST | /api/peer-reviews/submission/{sid} | `peerReviews` | CREATE |
| `peerReviewApi.getReviews` | GET | /api/peer-reviews/submission/{sid} | `peerReviews` | READ |
| `progressApi.courses` | GET | /api/progress/courses | `courses`, `assignments`, `submissions`, `quizzes`, `quizAttempts`, `resourceProgress` | READ |
| `progressApi.calendar` | GET | /api/progress/calendar | `assignments`, `quizzes`, `reminders` | READ |
| `attendanceApi.getSessions` | GET | /api/attendance/course/{cid} | `attendance`, `attendanceRecords` | READ |
| `attendanceApi.createSession` | POST | /api/attendance/course/{cid} | `attendance` | CREATE |
| `attendanceApi.updateRecord` | PATCH | /api/attendance/session/{sid}/record | `attendanceRecords` | CREATE/UPDATE |
| `attendanceApi.bulkUpdate` | PATCH | /api/attendance/session/{sid}/bulk | `attendanceRecords` | CREATE/UPDATE |
| `attendanceApi.deleteSession` | DELETE | /api/attendance/session/{sid} | `attendance`, `attendanceRecords` | DELETE |
| `attendanceApi.myAttendance` | GET | /api/attendance/student/my | `attendance`, `attendanceRecords`, `courses` | READ |
| `topicsApi.list` | GET | /api/courses/{cid}/topics/ | `topics` | READ |
| `topicsApi.create` | POST | /api/courses/{cid}/topics/ | `topics` | CREATE |
| `topicsApi.update` | PATCH | /api/courses/{cid}/topics/{tid} | `topics` | UPDATE |
| `topicsApi.delete` | DELETE | /api/courses/{cid}/topics/{tid} | `topics`, `topicPosts` | DELETE |
| `topicsApi.togglePin` | PATCH | /api/courses/{cid}/topics/{tid}/pin | `topics` | UPDATE |
| `topicsApi.getPosts` | GET | /api/courses/{cid}/topics/{tid}/posts | `topicPosts` | READ |
| `topicsApi.createPost` | POST | /api/courses/{cid}/topics/{tid}/posts | `topicPosts` | CREATE |
| `topicsApi.deletePost` | DELETE | /api/courses/{cid}/topics/{tid}/posts/{pid} | `topicPosts` | DELETE |
| `completionApi.course` | GET | /api/completion/course/{cid} | `submissions`, `quizAttempts`, `resourceProgress` | READ |
| `completionApi.summary` | GET | /api/completion/course/{cid}/summary | Same as above (aggregated) | READ |
| `certificatesApi.my` | GET | /api/certificates/my | `certificates` | READ |
| `certificatesApi.claim` | POST | /api/certificates/claim/{cid} | `certificates` | CREATE |
| `certificatesApi.verify` | GET | /api/certificates/verify/{num} | `certificates` | READ |
| `groupsApi.list` | GET | /api/courses/{cid}/groups/ | `courseGroups` | READ |
| `groupsApi.create` | POST | /api/courses/{cid}/groups/ | `courseGroups` | CREATE |
| `groupsApi.addMembers` | POST | /api/courses/{cid}/groups/{gid}/members | `groupMembers` | CREATE |
| `groupsApi.removeMember` | DELETE | /api/courses/{cid}/groups/{gid}/members/{sid} | `groupMembers` | DELETE |
| `groupsApi.delete` | DELETE | /api/courses/{cid}/groups/{gid} | `courseGroups`, `groupMembers` | DELETE |
| `groupsApi.autoAssign` | POST | /api/courses/{cid}/groups/auto-assign | `courseGroups`, `groupMembers` | CREATE |
| `questionBankApi.list` | GET | /api/question-bank/course/{cid} | `questionBank` | READ |
| `questionBankApi.create` | POST | /api/question-bank/ | `questionBank` | CREATE |
| `questionBankApi.bulkCreate` | POST | /api/question-bank/bulk | `questionBank` | CREATE |
| `questionBankApi.update` | PATCH | /api/question-bank/{qid} | `questionBank` | UPDATE |
| `questionBankApi.delete` | DELETE | /api/question-bank/{qid} | `questionBank` | DELETE |
| `questionBankApi.importToQuiz` | POST | /api/question-bank/import-to-quiz | `quizQuestions` | CREATE |
| `questionBankApi.exportFromQuiz` | POST | /api/question-bank/export-from-quiz | `questionBank` | CREATE |
| `rubricsApi.get` | GET | /api/rubrics/assignment/{aid} | `rubrics` | READ |
| `rubricsApi.create` | POST | /api/rubrics/ | `rubrics` | CREATE |
| `rubricsApi.delete` | DELETE | /api/rubrics/{id} | `rubrics` | DELETE |
| `rubricsApi.gradeWithRubric` | POST | /api/rubrics/grade/{aid}/{sid} | `submissions`, `rubrics` | UPDATE |
| `adminApi.getAuditLogs` | GET | /api/admin/audit-logs | `auditLogs` | READ |
| `adminApi.getUsers` | GET | /api/admin/users | `users` | READ |
| `adminApi.updateUserRole` | PATCH | /api/admin/users/{uid}/role | `users` | UPDATE |
| `adminApi.getHomepageContent` | GET | /api/admin/homepage/content | `homepageContent` | READ |
| `adminApi.createHomepageContent` | POST | /api/admin/homepage/content | `homepageContent` | CREATE |
| `adminApi.updateHomepageContent` | PATCH | /api/admin/homepage/content/{id} | `homepageContent` | UPDATE |
| `adminApi.deleteHomepageContent` | DELETE | /api/admin/homepage/content/{id} | `homepageContent` | DELETE |
| `adminApi.uploadHomepageImage` | POST | /api/admin/homepage/upload | filesystem | CREATE |

---

## 8. Real-Time Features & Polling

| Feature | Polling Interval | API Call | Location |
|---------|-----------------|----------|----------|
| Class Chat (Discussions) | Every 5 seconds | `discussionsApi.list(cid)` | Student & Lecturer discussion pages |
| Announcements | Every 10 seconds | `announcementsApi.list(cid)` | Student announcements page |
| Map Collaboration Presence | Every 4 seconds | `mapsApi.getPresence(mapId)` | Map editor |
| Private Messages | Polling (interval varies) | `messagingApi.getMessages(convId)` | Messages page |

---

## 9. AI-Powered Features

### 9.1 AI Feature Summary

| Feature | API Namespace | Trigger | Input | Output |
|---------|---------------|---------|-------|--------|
| **Plagiarism Detection** | `aiPlagiarismApi` | Lecturer clicks "Check Plagiarism" on submission | `submissionId` | PlagiarismReport { percentage, sources[], summary } |
| **AI Grading** | `aiGradingApi` | Lecturer clicks "AI Grade Recommend" on submission | `submissionId` | GradeRecommendation { recommended_grade, justification, confidence } |
| **AI Companion** | `aiCompanionApi` | Student uses chat widget | `{ message, context? }` | `{ response: string }` |
| **Learning Profile** | `aiCompanionApi` | Student takes style assessment | Style quiz answers | LearningProfile { learning_style, strengths, weaknesses } |
| **Study Materials** | `aiStudyMaterialsApi` | Student generates from resource | `{ resource_id, course_id, type }` | StudyMaterial (summary/flashcards/quiz) |
| **Daily Study Guide** | `aiStudyPlanApi` | Student loads study guide page | None (auto) | DailyGuide { recommendations[], motivational_message } |
| **Exam Planner** | `aiStudyPlanApi` | Student adds exams and generates | `exams[]` | ExamPlan { plan: days[], tips[] } |
| **Timetable Analysis** | `aiStudyPlanApi` | Student pastes timetable text | `timetable_text` | TimetableAnalysis { schedule, study_slots, suggestions } |
| **Google Sites Import** | `aiImportApi` | Lecturer pastes Google Sites URL | `url` | ScrapeResult { course_name, course_code, modules[] } |
| **Image Generation** | `aiImagesApi` | Student generates image for map node | `{ prompt, style?, map_id? }` | `{ image_url: string }` |
| **MindMap Analysis** | `aiMindmapBuddyApi` | Student clicks "Analyze Map" | `{ title, nodes, edges }` | MapAnalysis { rating, strengths, improvements, suggestions } |
| **Node Recommendations** | `aiMindmapBuddyApi` | Student right-clicks node | `{ node_id, node_label, context }` | `{ suggestions: NodeSuggestion[] }` |
| **MindMap Chat** | `aiMindmapBuddyApi` | Student chats in map editor | `{ message, map_context }` | `{ response: string }` |

---

## End of Document

This workflow document covers all pages, roles, module connections, API calls, database interactions, button actions, inputs, and expected outputs for the entire MySmartStudy platform.
