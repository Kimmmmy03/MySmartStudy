# MySmartStudy — E2E Test Plan & Claude Code Instructions

This document defines every testable E2E scenario for the MySmartStudy LMS. Use it as the single source of truth when generating Playwright + ZeroStep AI test files.

---

## Setup & Conventions

### Tech Stack

- **Runner**: Playwright (`@playwright/test`)
- **AI Interactions**: ZeroStep (`@zerostep/playwright`) — use `ai()` for assertions and complex UI interactions; use direct Playwright selectors for known, stable elements (inputs, buttons with fixed types).
- **Config**: `playwright.config.ts` — baseURL `http://localhost:3000`, Chromium, 180s timeout, HTML reporter.

### Test Credentials (from `docs/user.md`)

**Password for ALL accounts:** `Test1234!`

| Role | Email | Name |
|------|-------|------|
| Student | `student1@mysmartstudy.com` | Nurul Aisyah |
| Student | `student2@mysmartstudy.com` | Muhammad Hafiz |
| Lecturer | `lecturer1@mysmartstudy.com` | Dr. Siti Aminah |
| Lecturer | `lecturer2@mysmartstudy.com` | Prof. Ahmad Razak |
| Admin | `admin@mysmartstudy.com` | Admin MySmartStudy |

### Coding Rules

1. **Badge modals**: The dashboard layout checks for new badges on every route change. After EVERY navigation within the dashboard, call the `dismissBadgeModals(page)` helper before interacting with any page element. The helper must:
   - Wait 2 seconds for the badge API call to resolve.
   - Loop up to 10 times checking for the text "BADGE UNLOCKED".
   - Click "Next Badge" or "Awesome!" buttons to cycle through.
   - Use `page.keyboard.press("Escape")` as a fallback.

2. **Login form**: Always use direct Playwright selectors (`page.locator('input[type="email"]')`, `page.locator('input[type="password"]')`, `page.locator('button[type="submit"]')`) for credential entry — never `ai()`.

3. **No `networkidle`**: The login page has a looping `<video>` element. Use `page.waitForLoadState("domcontentloaded")` + `page.waitForSelector(...)` instead.

4. **Navigation waits**: After clicking a link, always use `page.waitForURL(...)` with a 15–30 second timeout.

5. **`ai()` usage**: Reserve for assertions ("Verify that...") and finding complex/dynamic UI targets ("Click the course card titled..."). Always pass `{ page, test }`.

6. **Timeouts**: Set `test.setTimeout(180_000)` on any test with more than 3 `ai()` calls.

7. **File structure**: One file per test suite. Place all files in `frontend-web/tests/`.

8. **Shared helpers**: Put `dismissBadgeModals()` and `loginAs(page, email, password)` in `tests/helpers.ts` and import them.

---

## Shared Helper File (`tests/helpers.ts`)

```ts
import { Page } from "@playwright/test";

const DEFAULT_PASSWORD = "Test1234!";

export async function loginAs(page: Page, email: string, password = DEFAULT_PASSWORD) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname.includes("/dashboard"), { timeout: 30_000 });
  await dismissBadgeModals(page);
}

export async function dismissBadgeModals(page: Page) {
  await page.waitForTimeout(2_000);
  for (let i = 0; i < 10; i++) {
    const badgeText = page.getByText("BADGE UNLOCKED");
    if (!await badgeText.isVisible({ timeout: 1_000 }).catch(() => false)) break;
    const nextBtn = page.getByRole("button", { name: "Next Badge" });
    const awesomeBtn = page.getByRole("button", { name: "Awesome!" });
    if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await nextBtn.click();
    } else if (await awesomeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await awesomeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(700);
  }
}
```

---

## Test Suites

### 1. AUTH — Login Page UI

**File**: `tests/auth-login.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Navigate to `/login` | Playwright |
| 2 | Verify "Welcome Back" heading | `ai()` |
| 3 | Verify email input with placeholder | `ai()` |
| 4 | Verify password input | `ai()` |
| 5 | Verify "Sign In" button | `ai()` |
| 6 | Verify "Sign in with Google" button | `ai()` |
| 7 | Verify "Forgot Password?" link | `ai()` |
| 8 | Verify "Register" link | `ai()` |

### 2. AUTH — Login Error Handling

**File**: `tests/auth-login.spec.ts` (second test in same file)

| # | Step | Method |
|---|------|--------|
| 1 | Navigate to `/login` | Playwright |
| 2 | Enter invalid email `wrong@test.com` and password `badpass` | Playwright |
| 3 | Click Sign In | Playwright |
| 4 | Verify "Invalid email or password" error message appears | `ai()` |
| 5 | Verify user remains on `/login` page | Playwright |

### 3. AUTH — Register Page UI

**File**: `tests/auth-register.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Navigate to `/register` | Playwright |
| 2 | Verify "Create Account" heading | `ai()` |
| 3 | Verify Full Name input | `ai()` |
| 4 | Verify Email input | `ai()` |
| 5 | Verify Role selector (Student/Lecturer buttons) | `ai()` |
| 6 | Verify Password input with strength meter | `ai()` |
| 7 | Verify Confirm Password input | `ai()` |
| 8 | Verify "Create Account" button | `ai()` |
| 9 | Verify "Sign up with Google" button | `ai()` |
| 10 | Verify "Login" link for existing users | `ai()` |

### 4. AUTH — Password Strength Meter

**File**: `tests/auth-register.spec.ts` (second test)

| # | Step | Method |
|---|------|--------|
| 1 | Navigate to `/register` | Playwright |
| 2 | Type `abc` into password field | Playwright |
| 3 | Verify weak password indicators (red, missing uppercase/number/special) | `ai()` |
| 4 | Type `Abc123!` into password field | Playwright |
| 5 | Verify strong password indicators (all green checkmarks) | `ai()` |

### 5. AUTH — Forgot Password Page

**File**: `tests/auth-forgot-password.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Navigate to `/forgot-password` | Playwright |
| 2 | Verify heading and email input | `ai()` |
| 3 | Verify "Send Reset Link" button | `ai()` |
| 4 | Verify "Back to Login" link | `ai()` |

---

### 6. STUDENT — Dashboard Journey

**File**: `tests/student-dashboard.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Dismiss badge modals | `dismissBadgeModals()` |
| 3 | Verify welcome banner with "Welcome back" or student name | `ai()` |
| 4 | Verify "Recent Maps" section | `ai()` |
| 5 | Verify stat cards: Courses Enrolled, Activities Done, Activities Due, Total Maps | `ai()` |
| 6 | Verify sidebar has Dashboard, My Maps, Courses links | `ai()` |
| 7 | Click "My Maps" in sidebar | Playwright (`a[href="/student/my-maps"]`) |
| 8 | Dismiss badge modals | `dismissBadgeModals()` |
| 9 | Verify My Maps page loaded | `ai()` |
| 10 | Click "Dashboard" in sidebar | Playwright (`a[href="/student/dashboard"]`) |
| 11 | Dismiss badge modals | `dismissBadgeModals()` |
| 12 | Open profile dropdown in navbar | `ai()` |
| 13 | Verify dropdown has Profile and Sign Out options | `ai()` |
| 14 | Click Sign Out | `ai()` |
| 15 | Verify redirect to login/landing page | Playwright |

### 7. STUDENT — Courses

**File**: `tests/student-courses.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/courses` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "Enroll in a Course" section with join code input | `ai()` |
| 5 | Verify at least one enrolled course card is displayed | `ai()` |
| 6 | Verify course card shows course name, code, and lecturer | `ai()` |
| 7 | Click "Enter" on a course card | `ai()` |
| 8 | Verify redirect to `/student/course/[cid]` | Playwright |
| 9 | Dismiss badge modals | `dismissBadgeModals()` |
| 10 | Verify course overview page with course name and tools grid | `ai()` |

### 8. STUDENT — Course Overview & Navigation

**File**: `tests/student-course-detail.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/courses`, click first course | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify course hero section (name, code, semester, lecturer) | `ai()` |
| 5 | Verify tool buttons: Resources, Assignments, Quizzes, Peer Reviews, My Grades, Forum, Class Chat | `ai()` |
| 6 | Verify Announcements section is present | `ai()` |
| 7 | Click "Assignments" tool button | `ai()` |
| 8 | Verify assignments page loads with assignment list or empty state | `ai()` |
| 9 | Navigate back, click "Quizzes" | `ai()` |
| 10 | Verify quizzes page loads | `ai()` |
| 11 | Navigate back, click "Resources" | `ai()` |
| 12 | Verify resources/modules page loads | `ai()` |

### 9. STUDENT — Assignment Submission

**File**: `tests/student-assignments.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course assignments page | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify assignment list with title, status, and due date | `ai()` |
| 5 | Click on an assignment to open submission modal | `ai()` |
| 6 | Verify submission modal shows assignment info (title, type, deadline) | `ai()` |
| 7 | Verify submission type tabs (Mind Map, Link, File) | `ai()` |
| 8 | If already submitted, verify grade and feedback section | `ai()` |
| 9 | Close modal | `ai()` or Escape |

### 10. STUDENT — Quiz Taking

**File**: `tests/student-quizzes.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course quizzes page | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify quiz list with title, status, question count, time limit | `ai()` |
| 5 | If a quiz is "Not attempted", click "Start" | `ai()` |
| 6 | Verify quiz modal with timer, questions, and answer inputs | `ai()` |
| 7 | Answer at least one question (MCQ radio or True/False toggle) | `ai()` |
| 8 | Click Submit | `ai()` |
| 9 | Verify results modal with score percentage | `ai()` |
| 10 | If already completed, click "View Results" and verify score display | `ai()` |

### 11. STUDENT — Discussions (Class Chat)

**File**: `tests/student-discussions.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course discussions/class-chat page | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify chat interface with message input and send button | `ai()` |
| 5 | Type a test message into the input | Playwright |
| 6 | Click Send | `ai()` |
| 7 | Verify the message appears in the chat | `ai()` |
| 8 | Verify message shows sender name and timestamp | `ai()` |

### 12. STUDENT — Gradebook

**File**: `tests/student-gradebook.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/gradebook` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify stats: Overall Average, Courses, Completed Items | `ai()` |
| 5 | Verify at least one course gradebook table with columns: Item, Type, Grade | `ai()` |

### 13. STUDENT — Planner / Calendar

**File**: `tests/student-planner.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/planner` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify calendar widget with month/year and day grid | `ai()` |
| 5 | Verify "Today" button | `ai()` |
| 6 | Click today's date on the calendar | `ai()` |
| 7 | Verify task list area for the selected date | `ai()` |
| 8 | Click add task button (+) | `ai()` |
| 9 | Verify task creation modal with title, category, priority inputs | `ai()` |
| 10 | Fill in task title and select category/priority | `ai()` + Playwright |
| 11 | Submit and verify task appears in the list | `ai()` |

### 14. STUDENT — Achievements & Badges

**File**: `tests/student-achievements.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/achievements` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify gamification stats: Total Points, Day Streak, Level | `ai()` |
| 5 | Verify badge grid shows earned badges (checkmark) and locked badges (lock icon) | `ai()` |

### 15. STUDENT — Profile

**File**: `tests/student-profile.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/profile` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify profile avatar is displayed | `ai()` |
| 5 | Verify display name input is pre-filled | `ai()` |
| 6 | Verify email input is displayed and disabled/readonly | `ai()` |
| 7 | Verify Class/Unit dropdown | `ai()` |
| 8 | Verify Year and Semester selectors | `ai()` |
| 9 | Verify "Update Profile" button | `ai()` |

### 16. STUDENT — My Maps

**File**: `tests/student-my-maps.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/my-maps` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify filter tabs: "My Maps" and "Collaborated" | `ai()` |
| 5 | Verify search bar and view toggle (grid/list) | `ai()` |
| 6 | Verify "New Map" card with + icon | `ai()` |
| 7 | If maps exist, verify map card shows title, thumbnail, last modified | `ai()` |
| 8 | Verify share code input field | `ai()` |

### 17. STUDENT — Mind Map Editor

**File**: `tests/student-map-editor.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/create-map` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify map editor canvas loaded (React Flow canvas visible) | `ai()` |
| 5 | Verify shape palette/toolbar is visible | `ai()` |
| 6 | Verify title input or editable title at the top | `ai()` |
| 7 | Verify save status indicator | `ai()` |
| 8 | Verify zoom controls (zoom in, zoom out, fit view) | `ai()` |

### 18. STUDENT — Attendance

**File**: `tests/student-attendance.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/attendance` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify attendance overview stats (attendance %, present, late, absent) | `ai()` |
| 5 | Verify per-course breakdown with course names and progress bars | `ai()` |

### 19. STUDENT — Study Materials

**File**: `tests/student-study-materials.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/study-materials` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify page loads with materials grouped by course, or empty state | `ai()` |

### 20. STUDENT — Messages

**File**: `tests/student-messages.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/messages` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify messaging interface with conversation list or empty state | `ai()` |
| 5 | Verify search users input for starting new conversation | `ai()` |

### 21. STUDENT — Exam Planner

**File**: `tests/student-exam-planner.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/exam-planner` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify course dropdown selector | `ai()` |
| 5 | Verify date picker for exam date | `ai()` |
| 6 | Verify topics textarea | `ai()` |
| 7 | Verify "Add Exam" button | `ai()` |
| 8 | Verify "Generate Study Plan" button | `ai()` |

### 22. STUDENT — Peer Reviews

**File**: `tests/student-peer-reviews.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course peer reviews page | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify assignment selection list | `ai()` |
| 5 | Verify reviewable submissions section or empty state | `ai()` |

### 23. STUDENT — Certificates

**File**: `tests/student-certificates.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/certificates` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify earned certificates section or empty state | `ai()` |
| 5 | Verify course progress section with completion percentages | `ai()` |

---

### 24. LECTURER — Dashboard

**File**: `tests/lecturer-dashboard.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Verify redirect to `/lecturer/dashboard` | Playwright |
| 3 | Verify welcome greeting with lecturer name | `ai()` |
| 4 | Verify course cards grid | `ai()` |
| 5 | Verify quick stats: Total Students, Courses, Day Streak, Points | `ai()` |
| 6 | Verify sidebar has Dashboard, Class Management, Review Maps links | `ai()` |

### 25. LECTURER — Class Management

**File**: `tests/lecturer-class-management.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/class-management` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "Create Course" button | `ai()` |
| 5 | Verify existing course cards with name, code, edit/delete buttons | `ai()` |
| 6 | Click "Create Course" and verify modal with fields: course name, code, semester, description | `ai()` |
| 7 | Close modal | Escape |

### 26. LECTURER — Course Overview

**File**: `tests/lecturer-course-detail.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify course header with name, code, semester, student count | `ai()` |
| 5 | Verify 12 tool buttons: Resources, Assignments, Quizzes, Gradebook, Announcements, Attendance, Question Bank, Completion, Groups, Forum, Plagiarism, Class Chat | `ai()` |
| 6 | Verify Students section | `ai()` |

### 27. LECTURER — Assignments & Grading

**File**: `tests/lecturer-assignments.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course assignments page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "Create Assignment" button | `ai()` |
| 5 | Verify existing assignments with title, status (open/closed), due date | `ai()` |
| 6 | Click "Create Assignment" and verify modal fields: title, description, deadline | `ai()` |
| 7 | Close modal, click "View Submissions" on an assignment | `ai()` |
| 8 | Verify submissions list with student names and grades | `ai()` |

### 28. LECTURER — Quizzes

**File**: `tests/lecturer-quizzes.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course quizzes page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "Create Quiz" button | `ai()` |
| 5 | Verify existing quizzes with title, question count, time limit | `ai()` |
| 6 | Click "View Attempts" on a quiz | `ai()` |
| 7 | Verify attempts list with student names and scores | `ai()` |

### 29. LECTURER — Gradebook

**File**: `tests/lecturer-gradebook.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course gradebook page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify stats: Total Students, Class Average, Items | `ai()` |
| 5 | Verify gradebook table with student names and grade columns | `ai()` |
| 6 | Verify "Export CSV" button | `ai()` |
| 7 | Verify "Weights" settings button | `ai()` |

### 30. LECTURER — Announcements

**File**: `tests/lecturer-announcements.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course announcements page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "New Announcement" button | `ai()` |
| 5 | Verify existing announcements with title, date, content | `ai()` |

### 31. LECTURER — Attendance

**File**: `tests/lecturer-attendance.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course attendance page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "New Session" button | `ai()` |
| 5 | Verify overview stats: Total Sessions, Avg Attendance %, Students | `ai()` |
| 6 | Verify session list with date, title, present/absent counts | `ai()` |

### 32. LECTURER — Resources

**File**: `tests/lecturer-resources.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course resources page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "Add Module" button | `ai()` |
| 5 | Verify existing modules with titles and expand/collapse | `ai()` |

### 33. LECTURER — Analytics

**File**: `tests/lecturer-analytics.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/analytics` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify stats: Total Students, Avg Submission Rate | `ai()` |
| 5 | Verify charts are rendered (Submission Trends, Engagement) | `ai()` |

### 34. LECTURER — Manage Badges

**File**: `tests/lecturer-badges.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/manage-badges` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "Create Badge" button | `ai()` |
| 5 | Verify built-in badges section | `ai()` |
| 6 | Verify badge cards with name, description, condition | `ai()` |

### 35. LECTURER — Review Maps

**File**: `tests/lecturer-review-maps.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/review-maps` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify search mode tabs: Recently Viewed, By Share Code, By Course, By Email | `ai()` |
| 5 | Verify search input field | `ai()` |

### 36. LECTURER — Profile

**File**: `tests/lecturer-profile.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/profile` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify profile avatar | `ai()` |
| 5 | Verify display name and email fields | `ai()` |
| 6 | Verify Department selector | `ai()` |
| 7 | Verify stats: Day Streak, Points, Badges | `ai()` |
| 8 | Verify "Update Profile" button | `ai()` |

### 37. LECTURER — Groups

**File**: `tests/lecturer-groups.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course groups page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "Create Group" and "Auto-Assign" buttons | `ai()` |
| 5 | Verify group cards or empty state | `ai()` |

### 38. LECTURER — Planner

**File**: `tests/lecturer-planner.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/planner` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify calendar widget with month navigation | `ai()` |
| 5 | Verify task list for selected date | `ai()` |

### 39. LECTURER — Question Bank

**File**: `tests/lecturer-question-bank.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course question bank page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify search bar and filter dropdowns (Type, Difficulty, Tag) | `ai()` |
| 5 | Verify "Add Question" button | `ai()` |
| 6 | Verify question list or empty state | `ai()` |

### 40. LECTURER — Discussions & Forum

**File**: `tests/lecturer-discussions.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course discussions page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify chat interface with message input | `ai()` |
| 5 | Navigate to forum page for the course | Combined |
| 6 | Dismiss badge modals | `dismissBadgeModals()` |
| 7 | Verify "New Topic" button | `ai()` |
| 8 | Verify topics list or empty state | `ai()` |

---

### 41. ADMIN — Dashboard

**File**: `tests/admin-dashboard.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `admin@mysmartstudy.com` | `loginAs()` |
| 2 | Verify redirect to `/admin/dashboard` | Playwright |
| 3 | Verify "Admin Dashboard" heading | `ai()` |
| 4 | Verify 4 stat cards: Total Users, Students, Lecturers, Admins | `ai()` |
| 5 | Verify "Recent Activity" section with audit log entries | `ai()` |
| 6 | Verify each log entry shows user name, action badge, resource type, timestamp | `ai()` |

### 42. ADMIN — User Management

**File**: `tests/admin-users.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `admin@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/admin/users` | Playwright |
| 3 | Verify "User Management" heading | `ai()` |
| 4 | Verify stat cards: Total Users, Students, Lecturers, Admins | `ai()` |
| 5 | Verify search input for filtering users | `ai()` |
| 6 | Verify role filter pills: All, Students, Lecturers, Admins | `ai()` |
| 7 | Verify grid/table view toggle | `ai()` |
| 8 | Verify user cards display name, email, role badge, points, streak | `ai()` |
| 9 | Click a role filter pill (e.g., "Students") and verify list filters | `ai()` |
| 10 | Type a search term and verify results update | Playwright + `ai()` |
| 11 | Switch to table view and verify columns: User, Email, Role, Department, Points | `ai()` |
| 12 | Verify pagination controls (Previous/Next) | `ai()` |

### 43. ADMIN — User Role Change

**File**: `tests/admin-users.spec.ts` (second test)

| # | Step | Method |
|---|------|--------|
| 1 | Login as `admin@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/admin/users` | Playwright |
| 3 | Expand a user card to see role change buttons | `ai()` |
| 4 | Verify role change options (student/lecturer/admin buttons) | `ai()` |
| 5 | Verify image quota editor is visible | `ai()` |

### 44. ADMIN — AI Usage Tracker

**File**: `tests/admin-ai-usage.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `admin@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/admin/ai-usage` | Playwright |
| 3 | Verify "AI Token Usage" heading | `ai()` |
| 4 | Verify 4 stat cards: Total Tokens Used, Total API Calls, Most Used Feature, Active Users | `ai()` |
| 5 | Verify feature breakdown bar chart with color-coded segments | `ai()` |
| 6 | Verify feature legend listing: Study Companion, Study Materials, Study Plan, AI Grading, Plagiarism, Mind Map Buddy, Course Import, Image Gen | `ai()` |
| 7 | Verify users table with columns: User, Total Tokens, API Calls, Feature Breakdown, Image Quota | `ai()` |
| 8 | Verify Refresh button in header | `ai()` |

### 45. ADMIN — Audit Logs

**File**: `tests/admin-audit-logs.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `admin@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/admin/audit-logs` | Playwright |
| 3 | Verify "Audit Logs" heading with total entry count | `ai()` |
| 4 | Verify filter controls: search input, action dropdown, resource dropdown | `ai()` |
| 5 | Verify logs grouped by date with date headers | `ai()` |
| 6 | Verify each log entry shows: user info, action badge (create/update/delete), resource type, timestamp | `ai()` |
| 7 | Type a search term and verify results filter | Playwright + `ai()` |
| 8 | Select an action filter and verify results update | `ai()` |

### 46. ADMIN — Homepage Editor

**File**: `tests/admin-homepage-editor.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `admin@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/admin/homepage-editor` | Playwright |
| 3 | Verify "Homepage Editor" heading | `ai()` |
| 4 | Verify "Add Content" button | `ai()` |
| 5 | Click "Add Content" and verify modal with: Type selector (News/Poster), Title input, Content textarea, Image upload | `ai()` |
| 6 | Close modal | Escape |
| 7 | If content items exist, verify cards with: thumbnail, type badge, title, action buttons (preview, toggle visibility, edit, delete) | `ai()` |
| 8 | Verify reorder buttons (up/down arrows) on content items | `ai()` |

### 47. ADMIN — Manage Badges (Admin)

**File**: `tests/admin-badges.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `admin@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/admin/manage-badges` | Playwright |
| 3 | Verify "Create Badge" button | `ai()` |
| 4 | Verify "Award Badge" button (green/emerald) | `ai()` |
| 5 | Verify "Revoke Badge" button (red) | `ai()` |
| 6 | Verify built-in badges grid with badge cards (icon, name, description, condition) | `ai()` |
| 7 | Click "Award Badge" and verify modal with student search and badge selector | `ai()` |
| 8 | Close modal | Escape |
| 9 | Click "Create Badge" and verify modal with: name, description, icon picker, color picker, condition type, threshold, points | `ai()` |
| 10 | Close modal | Escape |

---

### 48. AI — Study Companion Widget (Student)

**File**: `tests/ai-companion.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Dismiss badge modals | `dismissBadgeModals()` |
| 3 | Verify floating "Study Companion" button in bottom-right corner | `ai()` |
| 4 | Click the Study Companion button to open the widget | `ai()` |
| 5 | Verify widget panel opens with brain icon and tabs | `ai()` |
| 6 | Verify "Daily Guide" tab is visible or learning style setup screen appears | `ai()` |
| 7 | If learning style setup: verify intro screen with "Let's Go" button | `ai()` |
| 8 | Close/minimize the widget | `ai()` |

### 49. AI — Learning Style Assessment (Student)

**File**: `tests/ai-learning-style.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Dismiss badge modals | `dismissBadgeModals()` |
| 3 | Open Study Companion widget | `ai()` |
| 4 | If learning style not set, verify intro card with Brain icon | `ai()` |
| 5 | Click "Let's Go" to start assessment | `ai()` |
| 6 | Verify question display with progress bar and 4 answer options | `ai()` |
| 7 | Select an answer option for question 1 | `ai()` |
| 8 | Verify progress bar advances | `ai()` |
| 9 | Answer remaining questions (loop through 4 more) | `ai()` |
| 10 | Verify result screen with learning style label (Visual/Auditory/Reading/Kinesthetic) | `ai()` |

### 50. AI — Mind Map Buddy

**File**: `tests/ai-mindmap-buddy.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/create-map` or open an existing map | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Wait for map editor to load | Playwright |
| 5 | Verify Mind Map Buddy floating widget appears (bottom-right, with bot icon) | `ai()` |
| 6 | Click to open the Buddy widget | `ai()` |
| 7 | Verify three tabs: "Analyze", "Suggest", "Chat" | `ai()` |
| 8 | Click "Analyze" tab | `ai()` |
| 9 | Verify analysis section with rating display (0-10), strengths, improvements | `ai()` |
| 10 | Click "Chat" tab | `ai()` |
| 11 | Verify chat input with "Ask about your mind map..." placeholder | `ai()` |
| 12 | Minimize/close the buddy widget | `ai()` |

### 51. AI — Study Materials Generation (Student Resources)

**File**: `tests/ai-study-materials-gen.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course resources page | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify modules list with resource items | `ai()` |
| 5 | Hover over a PDF/document resource and verify AI generate dropdown appears | `ai()` |
| 6 | Verify dropdown options: "Summary Notes", "Flashcards", "Practice Quiz" | `ai()` |

### 52. AI — Exam Planner Study Plan Generation

**File**: `tests/ai-exam-planner.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/exam-planner` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify course dropdown, date picker, topics textarea | `ai()` |
| 5 | Select a course from dropdown | `ai()` |
| 6 | Select an exam date on the date picker | `ai()` |
| 7 | Type "Chapter 1, Chapter 2" into topics textarea | Playwright |
| 8 | Click "Add Exam" button | `ai()` |
| 9 | Verify exam appears in the added exams list | `ai()` |
| 10 | Verify "Generate Study Plan" button becomes enabled | `ai()` |

### 53. AI — Study Guide (Daily Recommendations)

**File**: `tests/ai-study-guide.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/study-guide` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify daily greeting (Good Morning/Afternoon/Evening) | `ai()` |
| 5 | Verify today's date is displayed | `ai()` |
| 6 | Verify study recommendations section with priority cards, or loading/empty state | `ai()` |

### 54. AI — Plagiarism Detection (Lecturer)

**File**: `tests/ai-plagiarism.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course plagiarism page (`/lecturer/course/[cid]/plagiarism`) | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify assignment selector dropdown | `ai()` |
| 5 | Verify two tabs: "Individual Analysis" and "Cross-Submission Similarity" | `ai()` |
| 6 | Select an assignment from dropdown | `ai()` |
| 7 | Verify submissions table with: student name, submitted date, AI % indicator | `ai()` |
| 8 | Verify "Analyze" button on each submission row | `ai()` |

### 55. AI — Grade Recommendation (Lecturer)

**File**: `tests/ai-grading.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course assignments page and open submissions | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify submissions list with student names | `ai()` |
| 5 | Open grading interface for a submission | `ai()` |
| 6 | Verify "AI Suggest Grade" button is present | `ai()` |
| 7 | Verify grade input field and feedback textarea | `ai()` |

### 56. AI — Course Import from Google Sites (Lecturer)

**File**: `tests/ai-google-sites-import.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/class-management` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify "Import from Google Sites" button or import option | `ai()` |
| 5 | Click the import button and verify modal with URL input field | `ai()` |
| 6 | Verify multi-step wizard structure (Step 1: URL input) | `ai()` |
| 7 | Close modal | Escape |

### 57. AI — Course Completion Tracking (Lecturer)

**File**: `tests/lecturer-completion.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to a course completion page (`/lecturer/course/[cid]/completion`) | Combined |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify summary stats: Avg Completion %, Fully Complete, At Risk, Total Students | `ai()` |
| 5 | Verify category completion rates: Assignment, Quiz, Resource with progress bars | `ai()` |
| 6 | Verify student completion table with columns: name, assignment %, quiz %, resource %, overall % | `ai()` |

### 58. AI — Learning Plan Generator (Lecturer)

**File**: `tests/lecturer-learning-plan.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/learning-plan` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify step indicator: Upload → Configure → Generate → Download | `ai()` |
| 5 | Verify upload area for curriculum files (.xlsx/.pdf) with drag-drop | `ai()` |
| 6 | Verify "Recently Viewed Drafts" section or empty state | `ai()` |

### 59. AI — Image Generation in Map Editor

**File**: `tests/ai-image-gen.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/create-map` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Wait for map editor to load | Playwright |
| 5 | Verify shape palette is visible with image shape option | `ai()` |
| 6 | Add an image node to the canvas | `ai()` |
| 7 | Select the image node and verify properties panel opens | `ai()` |
| 8 | Verify AI Image section with: prompt input, style selector, "Generate Image" button | `ai()` |
| 9 | Verify daily quota display (e.g., "3/day") | `ai()` |

### 60. AI — Recommendation Wizard (Student Dashboard)

**File**: `tests/ai-recommendation-wizard.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Dismiss badge modals | `dismissBadgeModals()` |
| 3 | Verify "Get Recommendation" button on dashboard | `ai()` |
| 4 | Click the "Get Recommendation" button | `ai()` |
| 5 | Verify wizard modal opens with 8 goal options in grid | `ai()` |
| 6 | Verify goal tiles: "Compare two things", "Define a concept", "Classify or categorize", "Show a sequence/process", etc. | `ai()` |
| 7 | Click a goal tile (e.g., "Compare two things") | `ai()` |
| 8 | Verify the tile is selected with checkmark | `ai()` |
| 9 | Verify "Create Map" button becomes enabled | `ai()` |
| 10 | Close modal | Escape |

---

### 61. CROSS-ROLE — Role-Based Access Control

**File**: `tests/rbac.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/lecturer/dashboard` directly | Playwright |
| 3 | Verify redirect to `/student/dashboard` (role guard) | Playwright |
| 4 | Login as `lecturer1@mysmartstudy.com` | `loginAs()` |
| 5 | Navigate to `/student/dashboard` directly | Playwright |
| 6 | Verify redirect to `/lecturer/dashboard` (role guard) | Playwright |
| 7 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 8 | Navigate to `/admin/dashboard` directly | Playwright |
| 9 | Verify redirect to `/student/dashboard` (admin guard) | Playwright |

### 62. CROSS-ROLE — Unauthenticated Guard

**File**: `tests/rbac.spec.ts` (second test)

| # | Step | Method |
|---|------|--------|
| 1 | Navigate to `/student/dashboard` without logging in | Playwright |
| 2 | Verify redirect to `/` (root/login) | Playwright |
| 3 | Navigate to `/lecturer/dashboard` without logging in | Playwright |
| 4 | Verify redirect to `/` (root/login) | Playwright |
| 5 | Navigate to `/admin/dashboard` without logging in | Playwright |
| 6 | Verify redirect to `/` (root/login) | Playwright |

### 63. CROSS-ROLE — Admin Can Access All Routes

**File**: `tests/rbac.spec.ts` (third test)

| # | Step | Method |
|---|------|--------|
| 1 | Login as `admin@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/dashboard` directly | Playwright |
| 3 | Verify admin stays on `/student/dashboard` (no redirect) | Playwright |
| 4 | Navigate to `/lecturer/dashboard` directly | Playwright |
| 5 | Verify admin stays on `/lecturer/dashboard` (no redirect) | Playwright |

### 64. NAVIGATION — Theme Toggle

**File**: `tests/theme-toggle.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Verify theme toggle button in navbar (Sun or Moon icon) | `ai()` |
| 3 | Click the theme toggle button | `ai()` |
| 4 | Verify the theme visually changed (icon switches) | `ai()` |

### 65. NAVIGATION — Sidebar Collapse

**File**: `tests/sidebar-collapse.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Verify sidebar is expanded with full link labels | `ai()` |
| 3 | Click sidebar collapse toggle button | `ai()` |
| 4 | Verify sidebar collapsed (icons only, no labels) | `ai()` |
| 5 | Click expand toggle again | `ai()` |
| 6 | Verify sidebar expanded again | `ai()` |

### 66. NAVIGATION — Notifications

**File**: `tests/notifications.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Verify notification bell icon in navbar | `ai()` |
| 3 | Click notification bell to open dropdown | `ai()` |
| 4 | Verify notification list or empty state in dropdown | `ai()` |
| 5 | Navigate to `/student/notifications` | Playwright |
| 6 | Dismiss badge modals | `dismissBadgeModals()` |
| 7 | Verify full notifications page loads | `ai()` |

### 67. NAVIGATION — Activity Log (Student)

**File**: `tests/student-activity.spec.ts`

| # | Step | Method |
|---|------|--------|
| 1 | Login as `student1@mysmartstudy.com` | `loginAs()` |
| 2 | Navigate to `/student/activity` | Playwright |
| 3 | Dismiss badge modals | `dismissBadgeModals()` |
| 4 | Verify activity log with entries grouped by date (Today, Yesterday, etc.) | `ai()` |
| 5 | Verify each entry shows action icon, description, and time | `ai()` |

---

## Summary

| Category | Tests | Files |
|----------|-------|-------|
| Auth | 5 | 3 |
| Student | 18 | 18 |
| Lecturer | 17 | 17 |
| Admin | 7 | 6 |
| AI Features | 13 | 13 |
| Cross-Role / Navigation | 7 | 5 |
| **Total** | **67** | **~50** |

## Running All Tests

```bash
# Ensure both servers are running first:
# Terminal 1: cd backend && python -m uvicorn main:app --reload
# Terminal 2: cd frontend-web && npm run dev

# Run all tests:
cd frontend-web
ZEROSTEP_TOKEN=<your-token> npm run test:e2e

# Run a specific suite:
ZEROSTEP_TOKEN=<your-token> npx playwright test tests/student-dashboard.spec.ts

# Run by category (grep test descriptions):
ZEROSTEP_TOKEN=<your-token> npx playwright test tests/admin-*.spec.ts     # All admin tests
ZEROSTEP_TOKEN=<your-token> npx playwright test tests/student-*.spec.ts   # All student tests
ZEROSTEP_TOKEN=<your-token> npx playwright test tests/lecturer-*.spec.ts  # All lecturer tests
ZEROSTEP_TOKEN=<your-token> npx playwright test tests/ai-*.spec.ts        # All AI feature tests
ZEROSTEP_TOKEN=<your-token> npx playwright test tests/auth-*.spec.ts      # All auth tests
ZEROSTEP_TOKEN=<your-token> npx playwright test tests/rbac.spec.ts        # Role-based access tests

# Run in headed mode (watch the browser):
ZEROSTEP_TOKEN=<your-token> npx playwright test --headed

# View HTML report after run:
npx playwright show-report
```

---

## Feature Coverage Matrix

| Feature Area | Student | Lecturer | Admin | Tests |
|-------------|---------|----------|-------|-------|
| Authentication | Login, Register, Forgot Password | — | — | #1-5 |
| Dashboard | Overview, Stats, Maps | Overview, Pending Reviews | Users, Logs, Stats | #6, #24, #41 |
| Courses | Enroll, Browse, Navigate | Create, Edit, Delete, Import | — | #7-8, #25-26 |
| Assignments | View, Submit (Map/Link/File) | Create, Grade, Rubrics | — | #9, #27 |
| Quizzes | Take, View Results | Create, View Attempts | — | #10, #28 |
| Discussions | Chat, Reply, Edit | Chat, Reply, Delete, Moderate | — | #11, #40 |
| Forum | View, Post, Reply | Create Topics, Pin, Delete | — | #11, #40 |
| Gradebook | View Grades | View All, Weights, Export CSV | — | #12, #29 |
| Planner/Calendar | Tasks, Events, Assignments | Tasks, Events | — | #13, #38 |
| Mind Maps | Create, Edit, Collaborate | Review, Annotate | — | #16-17, #35 |
| Attendance | View Stats, QR Check-in | Create Sessions, Mark, QR | — | #18, #31 |
| Badges/Achievements | View Earned/Locked | Create, Manage | Award, Revoke, Create | #14, #34, #47 |
| Profile | Edit Name, Avatar, Class | Edit Name, Avatar, Dept | — | #15, #36 |
| Messages | DM Conversations | DM Conversations | — | #20 |
| Certificates | View, Claim | — | — | #23 |
| Peer Reviews | Rate, Comment | View Reviews | — | #22 |
| AI Companion | Study Guide, Learning Style | — | — | #48-49 |
| AI Mind Map Buddy | Analyze, Suggest, Chat | — | — | #50 |
| AI Study Materials | Generate Summaries/Flashcards/Quiz | — | — | #51 |
| AI Exam Planner | Generate Study Plan | — | — | #52 |
| AI Study Guide | Daily Recommendations | — | — | #53 |
| AI Plagiarism | — | Analyze, Network | — | #54 |
| AI Grading | — | Grade Recommendation | — | #55 |
| AI Import | — | Google Sites Import | — | #56 |
| AI Learning Plan | — | Curriculum Upload, Generate | — | #58 |
| AI Image Gen | Generate for Map Nodes | — | — | #59 |
| AI Recommendation | Map Type Wizard | — | — | #60 |
| Completion Tracking | — | Student Progress | — | #57 |
| Groups | — | Create, Assign, Manage | — | #37 |
| Question Bank | — | Create, Filter, Import/Export | — | #39 |
| User Management | — | — | List, Search, Role Change | #42-43 |
| AI Usage | — | — | Token Stats, Quotas | #44 |
| Audit Logs | — | — | Filter, Search | #45 |
| Homepage | — | — | Content Editor | #46 |
| Analytics | — | Charts, At-Risk Students | — | #33 |
| RBAC | Student guard | Lecturer guard | Admin access all | #61-63 |
| Theme | Toggle Dark/Light | Toggle Dark/Light | — | #64 |
| Sidebar | Collapse/Expand | Collapse/Expand | — | #65 |
| Notifications | Bell, Full Page | Bell, Full Page | — | #66 |
| Activity Log | View Activity | — | — | #67 |
