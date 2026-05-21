# Redeploy Quick Reference

How to redeploy the three targets: backend API, web frontend, and mobile APK.

| Target  | Runtime              | Time     |
| ------- | -------------------- | -------- |
| Backend | Cloud Run            | ~4–8 min |
| Web     | Cloud Run            | ~3–6 min |
| Mobile  | Flutter release APK  | ~1–2 min |

---

## Project details

- **GCP project**: `mysmartstudy-71f7c`
- **Region**: `asia-southeast1`
- **Cloud Run services**: `mysmartstudy-api`, `mysmartstudy-web`
- **gcloud account**: `akmalhakimi1150@gmail.com`
- **Windows gcloud path**: `C:\Users\ASUS\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud`

If `gcloud` is not on PATH, open a shell and run:

```bash
export PATH="$PATH:/c/Users/ASUS/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
```

Confirm login + project before deploying:

```bash
gcloud auth login                                  # only if session expired
gcloud config set project mysmartstudy-71f7c
gcloud config list
```

---

## 1. Backend (`backend/` → Cloud Run `mysmartstudy-api`)

From the repo root:

```bash
gcloud run deploy mysmartstudy-api \
  --source backend/ \
  --region asia-southeast1 \
  --quiet
```

Source deploy uses the `backend/Dockerfile`. Existing env vars (`SECRET_KEY`, `GCS_BUCKET`, `GEMINI_API_KEY`, SMTP creds, etc.) persist across revisions unless you pass `--clear-env-vars`.

**To update an env var without changing code**:

```bash
gcloud run services update mysmartstudy-api \
  --region asia-southeast1 \
  --update-env-vars GCS_BUCKET=mysmartstudy-uploads
```

**Verify after deploy**:

```bash
curl https://mysmartstudy-api-393385396386.asia-southeast1.run.app/docs
```

---

## 2. Web (`frontend-web/` → Cloud Run `mysmartstudy-web`)

From the repo root:

```bash
gcloud run deploy mysmartstudy-web \
  --source frontend-web/ \
  --region asia-southeast1 \
  --quiet
```

Uses `frontend-web/Dockerfile`. `NEXT_PUBLIC_API_URL` is baked in at build time — if it ever changes, pass `--update-env-vars NEXT_PUBLIC_API_URL=https://...` or set it in the Dockerfile build args.

**Verify after deploy**: open [https://mysmartstudy-web-393385396386.asia-southeast1.run.app](https://mysmartstudy-web-393385396386.asia-southeast1.run.app)

---

## 3. Mobile APK (`frontend-mobile/` → release APK)

```bash
cd frontend-mobile
flutter pub get
flutter build apk --release
```

Output: `frontend-mobile/build/app/outputs/flutter-apk/app-release.apk` (~100 MB).

**Split per ABI** (smaller downloads, 3 separate APKs):

```bash
flutter build apk --release --split-per-abi
```

Outputs: `app-armeabi-v7a-release.apk`, `app-arm64-v8a-release.apk`, `app-x86_64-release.apk`.

**Install on a connected device**:

```bash
flutter install --release
```

**Before building**, verify dependencies:

```bash
flutter doctor
flutter analyze lib/
```

---

## Deploy everything (parallel)

```bash
# In one terminal
gcloud run deploy mysmartstudy-api --source backend/  --region asia-southeast1 --quiet

# In a second terminal
gcloud run deploy mysmartstudy-web --source frontend-web/ --region asia-southeast1 --quiet

# In a third terminal
cd frontend-mobile && flutter build apk --release
```

---

## Rollback

List revisions:

```bash
gcloud run revisions list --service mysmartstudy-api --region asia-southeast1
```

Route 100% traffic to a previous revision:

```bash
gcloud run services update-traffic mysmartstudy-api \
  --region asia-southeast1 \
  --to-revisions mysmartstudy-api-00042-abc=100
```

---

## Common issues

- **Deploy fails with "Permission denied"** — re-login: `gcloud auth login` and `gcloud auth application-default login`.
- **Build timeout** — Cloud Build default is 10 min. For larger builds: `gcloud config set builds/timeout 1800s`.
- **Web shows stale API URL** — `NEXT_PUBLIC_API_URL` is baked at build time; redeploy web after the backend URL changes.
- **Broken profile pics post-deploy** — ensure `GCS_BUCKET` env var is set on the API service; the `/api/auth/me` endpoint self-heals legacy `/uploads/` paths only when GCS is active.
- **Flutter build fails with Gradle errors** — `cd frontend-mobile/android && ./gradlew clean` then retry.
