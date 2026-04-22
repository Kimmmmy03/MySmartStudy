# MySmartStudy — Deployment Guide

How to deploy the three parts of MySmartStudy:

1. **Backend** (FastAPI + Firestore) → Google Cloud Run
2. **Frontend Web** (Next.js 16) → Google Cloud Run + Firebase Hosting
3. **Frontend Mobile** (Flutter) → build a signed APK and distribute via Telegram

---

## Architecture

| Component | Hosted on | Why |
|---|---|---|
| Backend (`backend/`) | **Cloud Run** | Containerized Python, scales to zero, free HTTPS |
| Database | **Firestore** | Already used by the app |
| File uploads | **Cloud Storage** | Cloud Run's filesystem is ephemeral |
| Secrets | **Secret Manager** | Never bake keys into images |
| Frontend Web (`frontend-web/`) | **Cloud Run** + **Firebase Hosting** | Next.js 16 App Router needs Node; Hosting adds CDN + custom domain |
| Frontend Mobile (`frontend-mobile/`) | Signed APK shared via Telegram | No Play Store step |
| Scheduled jobs | **Cloud Scheduler** → Cloud Run | APScheduler in-container won't survive scale-to-zero |

---

## Prerequisites (one-time)

1. **Google Cloud account** with billing enabled: https://console.cloud.google.com
2. **Install CLIs:**
   - `gcloud`: https://cloud.google.com/sdk/docs/install
   - `firebase`: `npm install -g firebase-tools`
3. **Authenticate:**
   ```bash
   gcloud auth login
   gcloud auth application-default login
   firebase login
   ```
4. **Pick / create a project** (can reuse an existing Firebase project):
   ```bash
   gcloud projects create mysmartstudy-prod --name="MySmartStudy"
   gcloud config set project mysmartstudy-prod
   ```
5. **Enable APIs:**
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

---

# Part 1 — Deploy the Backend

### 1.1 Move file uploads to Cloud Storage

Cloud Run filesystems are wiped between instances. Avatars and homepage images must live in a bucket.

```bash
gsutil mb -l asia-southeast1 gs://mysmartstudy-uploads
gsutil iam ch allUsers:objectViewer gs://mysmartstudy-uploads   # public read
```

Replace local file writes in `backend/app/routers/users.py` (avatar upload) and `backend/app/routers/admin.py` (homepage images) with:

```python
from google.cloud import storage
_gcs = storage.Client()
_bucket = _gcs.bucket("mysmartstudy-uploads")

def upload_to_gcs(file_bytes: bytes, path: str, content_type: str) -> str:
    blob = _bucket.blob(path)
    blob.upload_from_string(file_bytes, content_type=content_type)
    return f"https://storage.googleapis.com/mysmartstudy-uploads/{path}"
```

Then remove `app.mount("/uploads", StaticFiles(...))` from `backend/main.py`.

### 1.2 Create `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
```

### 1.3 Create `backend/.dockerignore`

```
__pycache__/
*.pyc
.env
.venv/
uploads/
mysmartstudy.db
firebase-admin-key.json
```

### 1.4 Store secrets

```bash
echo -n "your-long-random-secret" | gcloud secrets create jwt-secret --data-file=-
echo -n "your-gemini-key"         | gcloud secrets create gemini-key --data-file=-
gcloud secrets create firebase-admin-key --data-file=./firebase-admin-key.json
```

### 1.5 Update CORS in `backend/main.py`

```python
allow_origins=[
    "http://localhost:3000",
    "https://mysmartstudy.com",             # your custom domain
    "https://mysmartstudy-prod.web.app",    # Firebase Hosting default
],
```

### 1.6 Deploy to Cloud Run

```bash
cd backend
gcloud run deploy mysmartstudy-api \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 1Gi --cpu 1 --timeout 300 \
  --min-instances 0 --max-instances 10 \
  --set-secrets "SECRET_KEY=jwt-secret:latest,GEMINI_API_KEY=gemini-key:latest,FIREBASE_ADMIN_JSON=firebase-admin-key:latest" \
  --set-env-vars "GCS_BUCKET=mysmartstudy-uploads,ENV=production"
```

**Copy the URL it prints** — something like `https://mysmartstudy-api-xxx-as.a.run.app`. You'll plug this into the web frontend and the mobile APK.

### 1.7 Scheduled jobs

For each job in `backend/app/scheduler.py`, expose it as a protected HTTP endpoint (e.g., `POST /api/internal/run-reminders` with an `X-Internal-Token` header), then schedule it:

```bash
gcloud scheduler jobs create http daily-reminders \
  --schedule="0 8 * * *" \
  --uri="https://mysmartstudy-api-xxx-as.a.run.app/api/internal/run-reminders" \
  --http-method=POST \
  --headers="X-Internal-Token=your-shared-token" \
  --location=asia-southeast1
```

### 1.8 Redeploy later

```bash
gcloud run deploy mysmartstudy-api --source backend/ --region asia-southeast1
```

---

# Part 2 — Deploy the Frontend Web

Next.js 16 App Router uses Server Components, so you need a Node runtime. Run the app on Cloud Run and put Firebase Hosting in front for CDN + custom domain.

### 2.1 Set `frontend-web/.env.production`

```
NEXT_PUBLIC_API_URL=https://mysmartstudy-api-xxx-as.a.run.app/api
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_SITE_URL=https://mysmartstudy.com
```

### 2.2 Configure `next.config.ts`

```ts
const nextConfig = {
  output: "standalone",
  images: { remotePatterns: [{ protocol: "https", hostname: "storage.googleapis.com" }] },
};
export default nextConfig;
```

### 2.3 Create `frontend-web/Dockerfile`

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
```

### 2.4 Deploy to Cloud Run

```bash
cd frontend-web
gcloud run deploy mysmartstudy-web \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 512Mi --cpu 1 \
  --min-instances 0 --max-instances 10
```

### 2.5 Wire Firebase Hosting → Cloud Run

`frontend-web/firebase.json`:

```json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      { "source": "**", "run": { "serviceId": "mysmartstudy-web", "region": "asia-southeast1" } }
    ]
  }
}
```

Deploy:
```bash
firebase deploy --only hosting
```

### 2.6 Custom domain

1. Firebase Console → Hosting → **Add custom domain** → `mysmartstudy.com`
2. Add the TXT + A records it shows you at your domain registrar
3. SSL provisions automatically in ~24h

### 2.7 Redeploy later

```bash
gcloud run deploy mysmartstudy-web --source frontend-web/ --region asia-southeast1
firebase deploy --only hosting
```

---

# Part 3 — Build & Distribute the Mobile APK

Flutter app in `frontend-mobile/` talks to the same backend. Build a signed release APK and share it via Telegram — no Play Store.

### 3.1 Prerequisites

- Flutter SDK (3.x+): https://docs.flutter.dev/get-started/install
- Android SDK + build tools (install via Android Studio)
- JDK 17 (bundled with recent Android Studio)
- Verify with `flutter doctor` — all Android toolchain checks green

### 3.2 Point the app at production

`frontend-mobile/lib/services/api_service.dart` currently hard-codes the emulator loopback:

```dart
static const String _base = "http://10.0.2.2:8000/api";
```

Change it to your Cloud Run URL from Part 1.6:

```dart
static const String _base = "https://mysmartstudy-api-xxx-as.a.run.app/api";
```

> `10.0.2.2` only works from the Android emulator. A real device cannot reach it — login will fail.

### 3.3 Create a release keystore (one-time)

Keep this file safe. Losing it means you cannot publish updates signed as the same app.

```bash
keytool -genkey -v \
  -keystore ~/mysmartstudy-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias mysmartstudy
```

### 3.4 Wire the keystore into Gradle

Create `frontend-mobile/android/key.properties` (do NOT commit):

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=mysmartstudy
storeFile=C:/Users/you/mysmartstudy-release.jks
```

Add `key.properties` to `frontend-mobile/.gitignore`.

In `frontend-mobile/android/app/build.gradle`, above the `android { }` block:

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside `android { }`, replace the default `buildTypes.release` block:

```groovy
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

### 3.5 Bump version (every release)

In `frontend-mobile/pubspec.yaml`:

```yaml
version: 1.0.0+1   # <name>+<buildNumber> — bump the number for each release
```

### 3.6 Build the APK

```bash
cd frontend-mobile
flutter clean
flutter pub get
flutter build apk --release
```

Output:

```
build/app/outputs/flutter-apk/app-release.apk
```

### 3.7 Send via Telegram

1. Open the Telegram chat / channel / group you want to share with.
2. Tap the paperclip / attach icon → **File** (NOT "Photo" — that re-compresses).
3. Pick `frontend-mobile/build/app/outputs/flutter-apk/app-release.apk`.
4. Send. Telegram accepts files up to 2 GB, so the APK (~50–200 MB) is fine.

**What users do to install:**
- Tap the APK in Telegram → **Download**
- Tap the downloaded file → Android prompts: **Allow this source to install apps** → toggle on for Telegram
- Tap **Install**

### 3.8 Release checklist

- [ ] `api_service.dart` `_base` points to the live Cloud Run URL (not `10.0.2.2`)
- [ ] The Cloud Run URL is HTTPS (Android blocks cleartext HTTP by default)
- [ ] Version bumped in `pubspec.yaml`
- [ ] Keystore + `key.properties` backed up somewhere outside the repo
- [ ] Tested the APK on a real device before sharing

---

## Post-Deploy Checklist

- [ ] Firebase Auth → Authorized Domains: add `mysmartstudy.com` and `*.web.app`
- [ ] Deploy Firestore rules & indexes: `firebase deploy --only firestore:rules,firestore:indexes`
- [ ] End-to-end test on the live domain: login, map creation, file upload
- [ ] End-to-end test on a real phone with the production APK
- [ ] Billing alert: Console → Billing → Budgets & alerts

---

## Ongoing Operations

| Task | Command |
|---|---|
| Tail backend logs | `gcloud run services logs tail mysmartstudy-api --region asia-southeast1` |
| Tail web logs | `gcloud run services logs tail mysmartstudy-web --region asia-southeast1` |
| Redeploy backend | `gcloud run deploy mysmartstudy-api --source backend/ --region asia-southeast1` |
| Redeploy web | `gcloud run deploy mysmartstudy-web --source frontend-web/ --region asia-southeast1` + `firebase deploy --only hosting` |
| Rebuild APK | `cd frontend-mobile && flutter clean && flutter build apk --release` |
| Auto-deploy on git push | Cloud Build trigger: Console → Cloud Build → Triggers → Connect GitHub |

---

## Estimated Monthly Cost (low traffic)

| Item | Cost |
|---|---|
| Cloud Run (backend + web, scale to zero) | ~$0–5 |
| Firestore | ~$0–3 |
| Cloud Storage (uploads) | ~$1 |
| Firebase Hosting | free tier |
| Secret Manager | ~$0.30 |
| **Total** | **~$5–15/month** at <10k monthly users |

Telegram distribution is free. Keystore is a one-time artifact.
