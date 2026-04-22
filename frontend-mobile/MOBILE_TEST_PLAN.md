# MySmartStudy Mobile — Maestro E2E Test Plan

This document describes the Maestro UI test suite for the Flutter mobile app
(`com.mysmartstudy.app`). Flows live in `.maestro/flows/` and can be run
individually or as a suite.

## 1. Prerequisites

### Install Maestro CLI
PowerShell (Windows):
```powershell
iwr -useb https://get.maestro.mobile.dev | iex
# then restart the shell so ~/.maestro/bin is on PATH
maestro --version
```
Alt: `brew tap mobile-dev-inc/tap && brew install maestro` (macOS/Linux).

### Have a running device/emulator
- **Android**: `flutter emulators --launch <id>` or start an AVD. Verify with
  `adb devices`.
- **iOS**: open a simulator (macOS only).

### Build & install the app onto the device once
```bash
cd frontend-mobile
flutter run -d <device_id>           # leaves a debug build on the device
# or a release build:
flutter build apk --debug && adb install -r build/app/outputs/flutter-apk/app-debug.apk
```
Maestro doesn't build — it drives the already-installed APK whose package id
is `com.mysmartstudy.app`.

### Backend
The mobile app authenticates via **Firebase Auth** (not the FastAPI JWT path
the web app uses), so the FastAPI server only needs to be up for
`ApiService.syncUser` / profile hydration. Start it as usual:
```bash
cd backend && uvicorn main:app --reload
```

## 2. Test Credentials
From `docs/user.md` — password for **all** accounts is `Test1234!`.

| Role | Email |
|---|---|
| Student | student1@mysmartstudy.com |
| Lecturer | lecturer1@mysmartstudy.com |
| Admin | admin@mysmartstudy.com |

## 3. Running the suite

```bash
# Single flow
maestro test .maestro/flows/01_login_ui.yaml

# Entire suite sequentially
maestro test .maestro/flows

# With an override (different student)
maestro test .maestro/flows/03_student_login_success.yaml \
  -e TEST_EMAIL=student2@mysmartstudy.com -e TEST_PASSWORD=Test1234!

# Record an HTML+screenshot report into ./maestro-report
maestro test --format=html --output=maestro-report .maestro/flows

# Interactive Studio for authoring new flows visually
maestro studio
```

## 4. Flow Inventory

| # | File | Purpose | Needs login |
|---|---|---|---|
| 01 | `01_login_ui.yaml` | Verifies every login-screen widget renders | No |
| 02 | `02_login_validation.yaml` | Empty + malformed email validation errors | No |
| 03 | `03_student_login_success.yaml` | Happy-path login, lands on main shell | Yes |
| 04 | `04_login_wrong_password.yaml` | Firebase rejects bad creds, stays on login | No |
| 05 | `05_bottom_nav.yaml` | Home/Courses/Schedule/Maps/Profile tabs all switch | Yes |
| 06 | `06_profile_logout.yaml` | Opens Profile, signs out, returns to login | Yes |
| 07 | `07_courses_browse.yaml` | Courses tab renders; drill into first course if any | Yes |
| 08 | `08_mind_maps.yaml` | Maps tab renders (screenshot for manual review) | Yes |
| 09 | `09_schedule.yaml` | Schedule/Planner tab renders | Yes |
| 10 | `10_ai_companion.yaml` | SmartBuddy center-notch opens AI Companion | Yes |
| — | `login.subflow.yaml` | Shared reusable login fragment | — |

## 5. Planned extensions (not yet implemented)

These require domain data and are sketched here so future Maestro flows can
be added incrementally. File names shown are suggested.

### Auth / onboarding
- `register_student.yaml` — registration form, field validation, redirect to dashboard.
- `forgot_password.yaml` — enter email, confirm snackbar, return to login.
- `language_toggle.yaml` — switch EN ⇄ BM in Profile, verify `s.navHome` re-labels.

### Student journeys
- `join_course_by_code.yaml` — `join_subject_screen`, enter join code, verify course appears.
- `announcements.yaml` — open a course, verify announcements tab, scroll list.
- `discussion_post.yaml` — open forum, type message, verify it appears.
- `assignment_submit.yaml` — open assignment, submit link/map, confirm success.
- `quiz_attempt.yaml` — start quiz, answer MCQ + T/F + short-answer, submit, verify score.
- `attendance_checkin.yaml` — open session, check in, verify status = Present.
- `calendar_events.yaml` — verify deadlines render on calendar dates.
- `gradebook_view.yaml` — open Grades, verify at least one graded submission displays.
- `mind_map_create.yaml` — tap "+" on Maps tab, add node, save, verify it re-opens.
- `achievements.yaml` — verify earned badges render; dismiss celebration overlay.
- `messaging_dm.yaml` — search user, send DM, verify it appears in thread.
- `notifications.yaml` — open notifications, verify unread badge clears on read.

### AI features (student)
- `ai_study_materials.yaml` — generate summary, verify summary card appears.
- `ai_flashcards.yaml` — generate flashcards, swipe through deck.
- `ai_practice_quiz.yaml` — generate practice quiz, answer, verify feedback.
- `ai_exam_planner.yaml` — input exam date + topics, verify plan renders.
- `ai_image_generator.yaml` — prompt → image generated and displayed.
- `ai_learning_style.yaml` — answer questionnaire, verify style recommendation.
- `ai_import_course.yaml` — paste URL/text, verify imported modules list.

### Lecturer journeys
- `lecturer_login.yaml` — uses `lecturer1@mysmartstudy.com`, lands on lecturer shell.
- `create_announcement.yaml` — open course, create announcement, verify it appears.
- `create_assignment.yaml` — open course, add assignment with deadline, verify visible.
- `create_quiz.yaml` — build a 3-question quiz, publish, verify listed.
- `grade_submission.yaml` — open submission, assign grade + feedback, verify saved.
- `take_attendance.yaml` — start session, mark students present/absent, save.
- `manage_badges.yaml` — award a badge to a student, verify on their profile.
- `review_maps.yaml` — open Review Maps screen, open a map, add comment.
- `analytics.yaml` — verify analytics charts render.
- `rubric_grading.yaml` — grade with rubric, verify subtotals compute.
- `question_bank.yaml` — add a question to bank, import into quiz.

### Admin journeys
- `admin_login.yaml` — lands on admin shell.
- `user_management.yaml` — list users, filter by role, open detail.
- `content_moderation.yaml` — delete a flagged item, verify removed.

### Cross-cutting / resilience
- `deep_link_course.yaml` — open `mysmartstudy://course/<id>` deep link.
- `offline_banner.yaml` — toggle airplane mode, verify offline banner, toggle back.
- `dark_mode_toggle.yaml` — switch theme, verify surface colors change.
- `pull_to_refresh.yaml` — pull the Home feed, verify loading indicator.

## 6. Known coding rules for these flows

1. **Always `clearState` + `launchApp`** at the top of a non-subflow, or
   `runFlow: login.subflow.yaml` which already does it. Firebase persists
   sessions across cold starts, so skipping `clearState` can leak auth
   between flows.
2. **`hideKeyboard` after every `inputText`** — the on-screen keyboard can
   occlude the Sign In button.
3. **Tap by visible text, not by id where possible** — the Flutter widgets
   don't set semantic ids unless we add `Semantics(identifier: ...)`.
4. **Regex matchers for error snackbars** — Firebase's message wording
   differs by SDK version ("invalid-credential" vs "wrong-password").
5. **Don't rely on `networkidle` equivalents** — use
   `extendedWaitUntil: visible: ... timeout: 30000` to wait for the
   main-shell tab bar after login.
6. **Parameterise credentials via `-e TEST_EMAIL=... -e TEST_PASSWORD=...`**
   so CI can swap accounts without editing YAML.

## 7. Improving Semantic Labels (recommended follow-up)

A handful of flows would be more robust if the Flutter source exposed
accessibility identifiers on key widgets. Suggested additions:

```dart
// lib/screens/login_screen.dart
Semantics(identifier: 'login.email', child: TextFormField(...));
Semantics(identifier: 'login.password', child: TextFormField(...));
Semantics(identifier: 'login.submit', child: GradientButton(...));

// lib/widgets/floating_nav_bar.dart — per tab
Semantics(identifier: 'nav.home', ...);
Semantics(identifier: 'nav.smartbuddy', ...);   // notch button
```

Once added, flows can switch `tapOn: "Sign In"` → `tapOn: { id: "login.submit" }`
and survive i18n changes (English ⇄ Malay).
