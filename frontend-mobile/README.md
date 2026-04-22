# MySmartStudy Mobile

Flutter mobile client for the MySmartStudy learning management platform. Supports both **student** and **lecturer** roles with dark/light theming.

## Prerequisites

- Flutter SDK `^3.5.4`
- Firebase project configured (Auth)
- MySmartStudy backend running (FastAPI)

## Getting Started

```bash
# Install dependencies
flutter pub get

# Run on connected device / emulator
flutter run

# Analyze code
flutter analyze

# Build APK
flutter build apk
```

## Environment Setup

The app connects to the FastAPI backend via `ApiService` (`lib/services/api_service.dart`). Update the `baseUrl` constant to point to your running backend instance.

Firebase configuration files (`google-services.json` for Android, `GoogleService-Info.plist` for iOS) must be in place for authentication.

## Project Structure

```
lib/
├── main.dart                  # App entry point, ThemeProvider wiring
├── models/                    # Data models
│   ├── announcement_model.dart
│   ├── app_user.dart
│   ├── assignment_model.dart
│   ├── discussion_message_model.dart
│   ├── mind_map_model.dart
│   ├── subject_member_model.dart
│   ├── subject_model.dart
│   ├── submission_model.dart
│   ├── task_model.dart
│   └── user_profile.dart
├── screens/                   # All app screens
│   ├── login_screen.dart
│   ├── register_screen.dart
│   ├── main_shell.dart            # Bottom nav shell
│   ├── home_screen.dart           # Dashboard home
│   ├── profile_screen.dart        # Profile + theme toggle
│   ├── subjects_screen.dart       # Course list
│   ├── subject_detail_screen.dart # Course detail (tabs)
│   ├── subject_form_screen.dart   # Create/edit course
│   ├── join_subject_screen.dart   # Join course by code
│   ├── assignments_tab.dart       # Assignments list
│   ├── assignment_form_screen.dart
│   ├── student_submit_screen.dart
│   ├── lecturer_submissions_screen.dart
│   ├── grades_screen.dart
│   ├── announcements_screen.dart
│   ├── announcement_form_screen.dart
│   ├── discussion_chat_screen.dart
│   ├── resources_screen.dart
│   ├── mind_maps_screen.dart
│   ├── mind_map_viewer.dart
│   ├── review_maps_screen.dart
│   ├── tasks_screen.dart          # Planner / reminders
│   ├── achievements_screen.dart   # Points, streak, badges
│   ├── manage_badges_screen.dart  # Lecturer badge management
│   └── lecturer_analytics_screen.dart
├── services/
│   ├── api_service.dart           # HTTP client (JWT auth)
│   ├── auth_service.dart          # Firebase Auth wrapper
│   └── notification_service.dart  # Local notifications
├── utils/
│   ├── app_colors.dart            # Semantic color tokens (dark/light)
│   ├── app_theme.dart             # ThemeData, helper methods
│   ├── app_theme_ext.dart         # ThemeExtension + context extension
│   ├── badge_utils.dart           # Badge definitions
│   └── theme_provider.dart        # Dark/light mode persistence
└── widgets/
    ├── app_background.dart        # Gradient background + orbs
    ├── app_drawer.dart            # Navigation drawer
    └── fade_slide_in.dart         # Entrance animation widget
```

## Theming

The app supports **dark** and **light** modes with a toggle on the Profile screen.

- **`AppColorScheme`** (`app_colors.dart`) — semantic color tokens: `surface`, `surfaceCard`, `surfaceInput`, `surfaceElevated`, `textPrimary`, `textSecondary`, `textMuted`, `border`, `divider`
- **`AppThemeExt`** (`app_theme_ext.dart`) — `ThemeExtension` carrying `AppColorScheme`, accessed via `context.colors`
- **`ThemeProvider`** (`theme_provider.dart`) — persists preference via `shared_preferences`
- **Dark mode**: glassmorphism cards, gradient orbs, deep surface colors
- **Light mode**: white cards with soft shadows, warm subtle gradients
- Accent colors (blue, purple, cyan, pink, emerald, amber) are consistent across both themes
- Typography uses **Inter** font via `google_fonts`

## Key Dependencies

| Package | Purpose |
|---|---|
| `firebase_core` / `firebase_auth` | Authentication |
| `http` | API requests |
| `shared_preferences` | Theme persistence |
| `google_fonts` | Inter font family |
| `cached_network_image` | Image caching |
| `image_picker` | Profile photo upload |
| `flutter_local_notifications` | Scheduled reminders |
| `url_launcher` | Opening external links |
| `package_info_plus` | App version info |

## Roles

- **Student**: Dashboard, courses, assignments, grades, mind maps, planner, achievements
- **Lecturer**: Dashboard, class management, assignment grading, analytics, badge management, planner

## Backend

This app connects to the [MySmartStudy FastAPI backend](../backend/). See the root `CLAUDE.md` for full API endpoint documentation.
