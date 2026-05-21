# AI Redeploy Instructions

Instructions for an AI assistant to redeploy **backend**, **frontend-web**, and **frontend-mobile** from the repo root. Run every command from the repo root unless stated otherwise.

## Environment

- **GCP project**: `mysmartstudy-71f7c`
- **Region**: `asia-southeast1`
- **Cloud Run services**: `mysmartstudy-api`, `mysmartstudy-web`
- **gcloud account**: `akmalhakimi1150@gmail.com`
- **Windows gcloud binary**: `C:\Users\ASUS\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud`
- **Live URLs**:
  - API: `https://mysmartstudy-api-393385396386.asia-southeast1.run.app`
  - Web: `https://mysmartstudy-web-393385396386.asia-southeast1.run.app`

If `gcloud` isn't on PATH (bash):

```bash
export PATH="$PATH:/c/Users/ASUS/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
```

## Preflight (run once per session)

```bash
gcloud config set project mysmartstudy-71f7c
gcloud config list
```

If the output shows a different account or no active credentials, ask the user to run `gcloud auth login` in their terminal — **do not run interactive auth commands yourself** (they block the tool).

---

## 1. Backend — `backend/` → Cloud Run `mysmartstudy-api`

```bash
gcloud run deploy mysmartstudy-api \
  --source backend/ \
  --region asia-southeast1 \
  --quiet
```

- Uses `backend/Dockerfile`.
- Env vars persist across revisions (`SECRET_KEY`, `GCS_BUCKET`, `GEMINI_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `FRONTEND_URL`). Do **not** pass `--clear-env-vars`.
- Expected build time: 4–8 min. Use `run_in_background: true` and stream with Monitor if available, otherwise just wait.

**Update a single env var without rebuilding**:

```bash
gcloud run services update mysmartstudy-api \
  --region asia-southeast1 \
  --update-env-vars KEY=VALUE
```

**Verify**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://mysmartstudy-api-393385396386.asia-southeast1.run.app/docs
# expect 200
```

---

## 2. Frontend Web — `frontend-web/` → Cloud Run `mysmartstudy-web`

```bash
gcloud run deploy mysmartstudy-web \
  --source frontend-web/ \
  --region asia-southeast1 \
  --quiet
```

- Uses `frontend-web/Dockerfile` (Next.js 16, Turbopack build).
- `NEXT_PUBLIC_API_URL` is **baked at build time**. If the backend URL changes, redeploy web with:
  ```bash
  gcloud run services update mysmartstudy-web \
    --region asia-southeast1 \
    --update-env-vars NEXT_PUBLIC_API_URL=https://mysmartstudy-api-393385396386.asia-southeast1.run.app/api
  ```
  and then redeploy the source (env-var-only update is not enough because the value is inlined by Next.js at build).
- Expected build time: 3–6 min.

**Verify**: open `https://mysmartstudy-web-393385396386.asia-southeast1.run.app` or curl `/`.

---

## 3. Frontend Mobile — `frontend-mobile/` → Flutter release APK

```bash
cd frontend-mobile
flutter pub get
flutter build apk --release
```

- Output: `frontend-mobile/build/app/outputs/flutter-apk/app-release.apk` (~100 MB).
- Expected time: 1–2 min (much longer on first build).
- **Important**: the `flutter build` command must be run from inside `frontend-mobile/`. If running in a background shell, prefix with `cd frontend-mobile &&`.

**Smaller per-ABI APKs** (optional):

```bash
flutter build apk --release --split-per-abi
# outputs: app-armeabi-v7a-release.apk, app-arm64-v8a-release.apk, app-x86_64-release.apk
```

**Preflight checks** (run if build fails):

```bash
flutter doctor
flutter analyze lib/
```

**Install on a connected device**:

```bash
flutter install --release
```

---

## Deploy everything sequentially (safe default)

```bash
# 1. Backend
gcloud run deploy mysmartstudy-api --source backend/ --region asia-southeast1 --quiet

# 2. Web
gcloud run deploy mysmartstudy-web --source frontend-web/ --region asia-southeast1 --quiet

# 3. Mobile APK
cd frontend-mobile && flutter pub get && flutter build apk --release && cd ..
```

## Deploy everything in parallel

Run each in a separate background Bash call (three concurrent background processes). Then wait for all three to finish before verifying.

---

## Rollback

```bash
# List revisions
gcloud run revisions list --service mysmartstudy-api --region asia-southeast1

# Route 100% traffic to a prior revision
gcloud run services update-traffic mysmartstudy-api \
  --region asia-southeast1 \
  --to-revisions mysmartstudy-api-00042-abc=100
```

---

## Common failure modes

| Symptom | Fix |
|---|---|
| `Permission denied` during deploy | Ask user to re-run `gcloud auth login` + `gcloud auth application-default login`. |
| Cloud Build times out (>10 min) | `gcloud config set builds/timeout 1800s` then retry. |
| Web shows stale API URL | `NEXT_PUBLIC_API_URL` is baked at build time. Redeploy web with `--source frontend-web/`, not an env-var-only update. |
| Broken profile pics after deploy | Confirm `GCS_BUCKET=mysmartstudy-uploads` is set on `mysmartstudy-api`. |
| Flutter Gradle errors | `cd frontend-mobile/android && ./gradlew clean` then retry. |
| Flutter build says "No pubspec.yaml file found" | You are in the wrong cwd. Prefix with `cd frontend-mobile &&`. |
| `auth/unauthorized-domain` on web Google sign-in | Add the Cloud Run domain to Firebase Console → Authentication → Settings → Authorized domains, and to the Google Cloud OAuth client's JavaScript origins. |

---

## Rules for the AI running this

1. **Never** run `gcloud auth login`, `gcloud auth application-default login`, or any interactive prompt yourself — ask the user to run them via the `!` prefix in the Claude Code prompt.
2. **Never** pass `--clear-env-vars` to a `gcloud run deploy` — it wipes production secrets.
3. **Never** force-push, delete Cloud Run services, or delete revisions without explicit user confirmation.
4. **Never** skip hooks (`--no-verify`) or bypass signing on git commands.
5. Long deploys: use `run_in_background: true` on the Bash call; the harness will notify you on completion. Don't poll with sleep.
6. After each deploy, run the `curl` verify step for that target and report the HTTP status to the user.
7. If any step fails, stop and report the exact error — do not retry blindly.
