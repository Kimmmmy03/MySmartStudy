# Authentication Flow

## Overview
Handles user registration, login via Firebase Auth, backend synchronization, and role-based dashboard routing. Supports email/password and Google Sign-In on mobile.

## Flowchart

```mermaid
flowchart TD
    START([User opens app]) --> CHECK_AUTH{Already authenticated?}

    CHECK_AUTH -->|Yes| HYDRATE[Call GET /api/auth/me]
    CHECK_AUTH -->|No| AUTH_PAGE[Show Login / Register page]

    subgraph Registration
        AUTH_PAGE -->|Register| REG_FORM[Fill name, email, password, role]
        REG_FORM --> FB_CREATE[Firebase Auth: createUserWithEmailAndPassword]
        FB_CREATE -->|Success| GET_TOKEN_R[Get Firebase ID token]
        FB_CREATE -->|Error| REG_ERROR[Show error message]
    end

    subgraph Login
        AUTH_PAGE -->|Login| LOGIN_FORM[Enter email + password]
        LOGIN_FORM --> FB_SIGN_IN[Firebase Auth: signInWithEmailAndPassword]
        FB_SIGN_IN -->|Success| GET_TOKEN_L[Get Firebase ID token]
        FB_SIGN_IN -->|Error| LOGIN_ERROR[Show error message]

        AUTH_PAGE -->|Google Sign-In| GOOGLE[Firebase Auth: signInWithGoogle]
        GOOGLE -->|Success| GET_TOKEN_L
        GOOGLE -->|Error| LOGIN_ERROR
    end

    GET_TOKEN_R --> SYNC
    GET_TOKEN_L --> SYNC

    subgraph Backend Sync
        SYNC[POST /api/auth/sync with ID token + profile data]
        SYNC --> VERIFY[Backend: verify Firebase ID token]
        VERIFY -->|Invalid| REJECT[Return 401 Unauthorized]
        VERIFY -->|Valid| CHECK_USER{User doc exists in Firestore?}
        CHECK_USER -->|No| CREATE_DOC[Create user doc with role, name, department, etc.]
        CHECK_USER -->|Yes| UPDATE_DOC[Update lastActiveAt timestamp]
        CREATE_DOC --> RETURN_USER[Return user data + role]
        UPDATE_DOC --> RETURN_USER
    end

    RETURN_USER --> STORE_STATE[Store auth state in context/provider]
    HYDRATE --> STORE_STATE

    STORE_STATE --> ROLE_CHECK{User role?}
    ROLE_CHECK -->|student| STUDENT_DASH[Redirect to /student/dashboard]
    ROLE_CHECK -->|lecturer| LECTURER_DASH[Redirect to /lecturer/dashboard]
    ROLE_CHECK -->|admin| ADMIN_DASH[Redirect to /admin/dashboard]

    subgraph Session Management
        STUDENT_DASH --> TOKEN_REFRESH[Firebase auto-refreshes ID token]
        LECTURER_DASH --> TOKEN_REFRESH
        ADMIN_DASH --> TOKEN_REFRESH
        TOKEN_REFRESH --> API_CALLS[All API calls include Bearer token header]
        API_CALLS --> BACKEND_VERIFY[Backend verifies token on each request]
        BACKEND_VERIFY -->|Expired/Invalid| FORCE_LOGOUT[Force logout, redirect to login]
    end

    subgraph Logout
        LOGOUT_ACTION[User clicks logout] --> FB_SIGNOUT[Firebase Auth: signOut]
        FB_SIGNOUT --> CLEAR_STATE[Clear local state/storage]
        CLEAR_STATE --> AUTH_PAGE
    end
```

## Key Files
- `frontend-web/src/contexts/auth-context.tsx` — AuthProvider with Firebase onAuthStateChanged
- `frontend-web/src/lib/api.ts` — getFirebaseToken() helper, authApi namespace
- `frontend-web/src/app/(auth)/login/page.tsx` — Login page
- `frontend-web/src/app/(auth)/register/page.tsx` — Register page
- `frontend-mobile/lib/services/auth_service.dart` — Firebase Auth wrapper
- `frontend-mobile/lib/screens/login_screen.dart` — Mobile login
- `backend/app/auth.py` — get_current_user() dependency, Firebase token verification
- `backend/app/routers/auth.py` — POST /api/auth/sync, GET /api/auth/me
