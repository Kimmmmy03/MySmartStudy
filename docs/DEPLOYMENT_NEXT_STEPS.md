# Deployment — What's Left For You

This checklist is what remains **after** I finished the local prep. It's tailored to your machine (Windows) and the Firebase project `mysmartstudy-71f7c` you already have.

> **Run these commands in Git Bash, not Command Prompt (cmd).** Git Bash came with your Git for Windows install — right-click any folder in Explorer → "Git Bash Here". Every command below uses bash syntax (especially the `\` line-continuation character and the `for` loops in Step 6). In cmd they break with "not recognized as an internal or external command" errors.

---

## What I already did (no action needed on these)

| File | Purpose |
|---|---|
| `backend/Dockerfile` | Builds the FastAPI image on Cloud Run |
| `backend/.dockerignore` | Keeps secrets + local DB out of the image |
| `backend/app/storage.py` | New helper: writes to GCS when `GCS_BUCKET` is set, local disk otherwise |
| `backend/app/routers/users.py` | Avatar upload now uses `save_upload()` |
| `backend/app/routers/admin.py` | Homepage image upload now uses `save_upload()` |
| `backend/main.py` | CORS allowlist now read from `CORS_ORIGINS` env var |
| `frontend-web/Dockerfile` | Multi-stage Node build for Next.js standalone |
| `frontend-web/next.config.ts` | `output: "standalone"` + `storage.googleapis.com` remote pattern |
| `frontend-web/firebase.json` | Hosting → Cloud Run rewrite |
| `frontend-mobile/android/app/build.gradle` | `key.properties` + release signing wired in (falls back to debug signing if key.properties is missing) |
| `frontend-mobile/.gitignore` | Ignores `key.properties`, `*.jks`, `*.keystore` |

**Nothing I did changes local dev behavior.** `uvicorn main:app --reload` and `npm run dev` still work exactly as before.

---

## Step 1 — Install missing tools

1. **gcloud CLI:** https://cloud.google.com/sdk/docs/install-sdk#windows
   - Download the installer, run it, check "Add gcloud to PATH"
   - Verify: `gcloud --version`

2. **Docker Desktop — optional, skip it.** `gcloud run deploy --source .` uploads your source to **Cloud Build** (Google's cloud) and builds the image there, so your laptop doesn't need Docker.
   - Only install it if you want to `docker build` locally to test the Dockerfile before pushing. Docker Desktop is free for personal use / students / small businesses: https://www.docker.com/products/docker-desktop/
   - Cloud Build gives you 120 free build-minutes per day, which covers normal deploy cadence.

---

## Step 2 — Enable billing

Cloud Run, Cloud Storage, and Secret Manager need a billing account.

1. https://console.cloud.google.com/billing
2. Link a card to **MySmartStudy** (`mysmartstudy-71f7c`)
3. Set a budget alert for $20/month so nothing surprises you

---

## Step 3 — Authenticate the CLIs

Run these once (each opens a browser):

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project mysmartstudy-71f7c
firebase login   # you may already be logged in
firebase use mysmartstudy-71f7c
```

---

## Step 4 — Enable required APIs

**Windows Command Prompt (cmd)** — one line:

```
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com storage.googleapis.com cloudscheduler.googleapis.com
```

**Git Bash / PowerShell / macOS / Linux** — multi-line is fine:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com
```

> The `\` at the end of each bash line is a line-continuation character. Windows `cmd` treats it as a literal backslash and errors out. If you're in cmd, collapse to one line (or switch to Git Bash, which came with Git for Windows — right-click any folder → "Git Bash Here").

---

## Step 5 — Create the Cloud Storage bucket for uploads

```bash
gcloud storage buckets create gs://mysmartstudy-uploads --location=asia-southeast1
gcloud storage buckets add-iam-policy-binding gs://mysmartstudy-uploads --member=allUsers --role=roles/storage.objectViewer
```

Verify: `gcloud storage buckets list` should include `gs://mysmartstudy-uploads/`.

> If you see older guides using `gsutil mb ...` / `gsutil iam ch ...`, those still work but may fail with "python3.13: command not found" on Windows because gsutil ships a separate Python. `gcloud storage` is the modern replacement and uses the gcloud CLI's own bundled Python.

---

## Step 6 — Create secrets

You need three secret values. Pick/grab them first, then create the secrets:

1. **JWT secret** — any long random string (e.g., `openssl rand -hex 32` or a 40+ character password)
2. **Gemini API key** — whatever you already use in local dev (check `backend/.env` or wherever you keep it)
3. **Firebase admin key** — the file is already at `backend/serviceAccountKey.json`

```bash
# JWT secret
printf "%s" "YOUR_LONG_RANDOM_SECRET_HERE" | gcloud secrets create jwt-secret --data-file=-

# Gemini API key
printf "%s" "YOUR_GEMINI_KEY_HERE" | gcloud secrets create gemini-key --data-file=-

# Firebase admin service account JSON
gcloud secrets create firebase-admin-key --data-file=backend/serviceAccountKey.json
```

Grant the Cloud Run runtime service account access:

```bash
PROJECT_NUMBER=$(gcloud projects describe mysmartstudy-71f7c --format="value(projectNumber)")
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for s in jwt-secret gemini-key firebase-admin-key; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

Also grant that same service account permission to write to the bucket:

```bash
gsutil iam ch serviceAccount:${RUNTIME_SA}:objectAdmin gs://mysmartstudy-uploads
```

---

## Step 7 — Deploy the backend

```bash
cd backend
gcloud run deploy mysmartstudy-api \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 1Gi --cpu 1 --timeout 300 \
  --min-instances 0 --max-instances 10 \
  --set-secrets "SECRET_KEY=jwt-secret:latest,GEMINI_API_KEY=gemini-key:latest,FIREBASE_ADMIN_JSON=firebase-admin-key:latest" \
  --set-env-vars "^@^GCS_BUCKET=mysmartstudy-uploads@CORS_ORIGINS=http://localhost:3000,https://mysmartstudy-71f7c.web.app,https://mysmartstudy-71f7c.firebaseapp.com"
```

The first build takes 5–10 minutes. At the end, it prints a URL like:

```
Service URL: https://mysmartstudy-api-xxxxxxxx-as.a.run.app
```

**Write that URL down — every next step uses it.** Call it `<BACKEND_URL>` below.

> **This deployment's backend URL:** `https://mysmartstudy-api-qf5vai3csq-as.a.run.app`

**Smoke test:**
```bash
curl https://mysmartstudy-api-xxxxxxxx-as.a.run.app/
# should return: {"message":"MySmartStudy API is running","docs":"/docs"}
```

**Notes on the command above:**
- `FIREBASE_ADMIN_JSON=firebase-admin-key:latest` passes the service account JSON **as a regular env var** (not a mounted file). `firestore.py` / `auth.py` check for this env var first and `json.loads()` the content. Fallback order: `FIREBASE_ADMIN_JSON` → `FIREBASE_SERVICE_ACCOUNT_PATH` → local `backend/serviceAccountKey.json`.
- Using an env var instead of mounting a file sidesteps a Git Bash MSYS pain point: paths like `/secrets/firebase-admin-key.json` get silently rewritten to `C:\Program Files\Git\secrets\...` before `gcloud` sees them, and the container starts with a broken path.
- `^@^` at the start of `--set-env-vars` tells gcloud "use `@` as the key-value separator instead of `,`" — needed because `CORS_ORIGINS` itself contains commas. Without this override you get `Bad syntax for dict arg`.

---

## Step 8 — Deploy the frontend web

1. Create `frontend-web/.env.production`:

   ```
   NEXT_PUBLIC_API_URL=<BACKEND_URL>/api
   ```

   Plus whatever `NEXT_PUBLIC_FIREBASE_*` values you have in `.env.local`.

2. Deploy to Cloud Run:

   ```bash
   cd frontend-web
   gcloud run deploy mysmartstudy-web \
     --source . \
     --region asia-southeast1 \
     --allow-unauthenticated \
     --memory 512Mi --cpu 1 \
     --min-instances 0 --max-instances 10
   ```

3. Front it with Firebase Hosting (gives you a `.web.app` URL + CDN + future custom domain):

   ```bash
   firebase deploy --only hosting
   ```

   You'll get `https://mysmartstudy-71f7c.web.app` — open it, log in, verify everything works.

---

## Step 9 — Post-deploy config

1. **Firebase Auth → Authorized Domains** (Console → Authentication → Settings → Authorized domains):
   add `mysmartstudy-71f7c.web.app` and `mysmartstudy-71f7c.firebaseapp.com` if not already present.

2. **Deploy Firestore rules + indexes** (if you have `firestore.rules` / `firestore.indexes.json`):
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

3. **Test end-to-end** on the live site:
   - Register / log in
   - Upload a profile photo → confirm URL is `https://storage.googleapis.com/mysmartstudy-uploads/avatars/...`
   - Create a map
   - Create a course, join it from another account

---

## Step 10 — Build and distribute the mobile APK

### 10a. Point the app at production

Edit `frontend-mobile/lib/services/api_service.dart` line ~10:

```dart
// before
static const String _base = "http://10.0.2.2:8000/api";
// after
static const String _base = "<BACKEND_URL>/api";
```

### 10b. Generate the release keystore (one-time, keep it forever)

```bash
keytool -genkey -v \
  -keystore "$HOME/mysmartstudy-release.jks" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias mysmartstudy
```

It prompts for a keystore password, key password, and owner details. **Back this file up somewhere safe** — losing it means future updates can't be signed as the same app.

### 10c. Create `frontend-mobile/android/key.properties`

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=mysmartstudy
storeFile=C:/Users/ASUS/mysmartstudy-release.jks
```

(Note: forward slashes, not backslashes. And remember `.gitignore` already excludes this file — don't commit it.)

### 10d. Build

```bash
cd frontend-mobile
flutter clean
flutter pub get
flutter build apk --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk` (~50–200 MB).

### 10e. Install locally to sanity-check

```bash
adb install build/app/outputs/flutter-apk/app-release.apk
```

Log in, upload a profile photo, confirm it talks to the live backend.

### 10f. Send via Telegram

1. Open Telegram chat / channel / group
2. Paperclip → **File** (NOT "Photo" — that re-compresses and breaks the APK)
3. Attach `build/app/outputs/flutter-apk/app-release.apk`
4. Send

Receivers tap the APK → Download → tap the file → allow "Install unknown apps" for Telegram → Install.

---

## Step 11 — Scheduled jobs (optional, do later)

APScheduler inside Cloud Run is unreliable once containers scale to zero. If the jobs in `backend/app/scheduler.py` matter (e.g., daily reminders, streak checks), expose each as an HTTP endpoint protected by a shared token, then use Cloud Scheduler:

```bash
gcloud scheduler jobs create http daily-reminders \
  --schedule="0 8 * * *" \
  --uri="<BACKEND_URL>/api/internal/run-reminders" \
  --http-method=POST \
  --headers="X-Internal-Token=<YOUR_SHARED_TOKEN>" \
  --location=asia-southeast1
```

---

## Step 12 — Custom domain (optional)

1. Firebase Console → Hosting → **Add custom domain** → `yourdomain.com`
2. Add the TXT + A records at your registrar
3. Wait up to 24h for SSL
4. After it's live, re-deploy the backend with your custom domain added to `CORS_ORIGINS`:

   ```bash
   gcloud run services update mysmartstudy-api \
     --region asia-southeast1 \
     --update-env-vars "CORS_ORIGINS=http://localhost:3000,https://mysmartstudy-71f7c.web.app,https://yourdomain.com"
   ```

5. Firebase Auth → Authorized Domains → add `yourdomain.com`

---

## Redeploy cheatsheet

```bash
# Backend code change
gcloud run deploy mysmartstudy-api --source backend/ --region asia-southeast1

# Frontend code change
gcloud run deploy mysmartstudy-web --source frontend-web/ --region asia-southeast1
firebase deploy --only hosting

# New APK
cd frontend-mobile && flutter clean && flutter build apk --release
# then re-send via Telegram
```

---

## Monthly cost at low traffic

~$5–15/month. Cloud Run scales to zero. Budget alert in Step 2 catches anything unexpected.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `PERMISSION_DENIED` on first deploy | Billing not enabled, or APIs from Step 4 not enabled yet |
| Backend 500s on avatar upload | Runtime SA missing `objectAdmin` on the bucket (end of Step 6) |
| Frontend can't reach backend (CORS error) | `CORS_ORIGINS` env var doesn't include the frontend's actual URL — update via `gcloud run services update` |
| Mobile login fails on a real phone | `api_service.dart` still points at `10.0.2.2`, or the backend URL is `http://` (Android blocks cleartext) |
| APK installs but crashes on launch | Not signed correctly — check `key.properties` paths use forward slashes |
| `gcloud run deploy` hangs on build | First Cloud Build is slow; check https://console.cloud.google.com/cloud-build/builds |
