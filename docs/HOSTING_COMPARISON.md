# Hosting Comparison — Google Cloud vs Railway vs Koyeb

Comparing three hosting options for **MySmartStudy** at **~100 active users**, with **auto-scaling** required.

Stack recap: Next.js 16 frontend (SSR), FastAPI backend, Firestore (managed by Google), Gemini API, file uploads.

---

## 1. Traffic Assumptions for 100 Users

| Metric | Estimate |
|---|---|
| Daily active users | ~30–50 |
| Concurrent peak users | ~10–15 |
| API requests per user per day | ~200 (maps, quizzes, polling) |
| Total API requests/month | ~600k |
| AI (Gemini) calls/month | ~3k |
| Frontend page views/month | ~150k |
| Bandwidth out/month | ~15–25 GB |
| File uploads (avatars, homepage images) | ~2 GB total stored |
| Backend avg CPU | ~0.25 vCPU sustained, bursts to 1 vCPU |
| Backend avg RAM | ~512 MB |
| Frontend avg RAM | ~300 MB |

---

## 2. Side-by-Side Comparison

| Feature | Google Cloud (Cloud Run + Firebase) | Railway | Koyeb |
|---|---|---|---|
| **Pricing model** | Pay-per-use (per-request, per-CPU-second) | Usage-based ($/GB-RAM-hr, $/vCPU-hr) + $5 plan fee | Flat per-instance/month + usage |
| **Free tier** | 2M requests, 360k GB-s memory, 180k vCPU-s /month (generous) | $5 credit/month on Hobby plan ($5 fee) | 1 free Nano service (512MB/0.1vCPU), limited |
| **Auto-scaling** | ✅ 0 → N instances, scale-to-zero | ✅ Horizontal autoscaling (Pro plan $20/mo) | ✅ Built-in, scale-to-zero supported |
| **Scale-to-zero (cold starts)** | ✅ Yes (~1–3s cold start) | ⚠️ Optional; default keeps 1 warm | ✅ Yes (~1–2s cold start) |
| **Custom domain + SSL** | ✅ Free | ✅ Free | ✅ Free |
| **CDN / edge caching** | ✅ Firebase Hosting (global) | ❌ Origin only | ✅ Global edge network included |
| **Deploy method** | `gcloud run deploy` or Cloud Build from Git | Git push (GitHub connect) | Git push or Docker |
| **Docker support** | ✅ Native | ✅ Native | ✅ Native |
| **Secrets mgmt** | Secret Manager (separate service) | Built-in env vars UI | Built-in secrets UI |
| **Logs & metrics** | Cloud Logging + Monitoring (powerful, steep) | Clean built-in dashboard | Built-in, decent |
| **Managed DB (for if you ever leave Firestore)** | Cloud SQL, Firestore | Postgres, MySQL, Mongo, Redis | Postgres via add-on |
| **Scheduled jobs** | Cloud Scheduler (separate) | Cron jobs built-in | Cron built-in |
| **Region coverage** | 40+ regions globally | US, EU (limited) | 8 regions (US, EU, Asia) |
| **Complexity / learning curve** | High (enterprise-grade) | Very low (PaaS) | Low–medium |
| **Free support** | Docs + community | Community (Discord) | Discord + docs |
| **Lock-in** | Medium (containers are portable) | Low | Low |
| **Best for MySmartStudy** | Already on Firebase/Firestore, long-term serious | Fast MVP iteration | Middle-ground: simple + fast global |

---

## 3. Full Cost Breakdown — 100 Users

### Option A — Google Cloud (Cloud Run + Firebase Hosting + Firestore)

| Line Item | Calculation | Monthly Cost |
|---|---|---|
| Cloud Run — backend (FastAPI) | ~600k req, 0.25 vCPU avg, 512MB, scale-to-zero. Well within free tier. | **$0–2** |
| Cloud Run — frontend (Next.js SSR) | ~150k SSR req, 300MB. Mostly free tier. | **$0–1** |
| Firebase Hosting | 10GB storage + 25GB transfer free. 15GB used. | **$0** |
| Firestore | ~1M reads, 200k writes, 1GB storage. Free tier = 50k reads/20k writes/day. Slight overage. | **$1–3** |
| Cloud Storage (file uploads) | 2 GB stored, minimal egress | **$0.10** |
| Secret Manager | 3 secrets, low access | **$0.20** |
| Cloud Scheduler | 3–5 jobs | **$0.30** (or free — first 3 jobs free) |
| Cloud Build (deploys) | Free tier covers 120 build-min/day | **$0** |
| Cloud Logging | Free tier 50GB/mo | **$0** |
| Gemini API (Google AI Studio) | ~3k calls, Flash model | **$2–5** |
| Egress bandwidth (Cloud Run → users) | ~20GB @ $0.12/GB | **$2.40** |
| **Subtotal** | | **~$6–14/mo** |

**Auto-scaling**: native, free. Scales 0 → 1000 instances with `--max-instances`. Cold start ~1–3s.

### Option B — Railway

| Line Item | Calculation | Monthly Cost |
|---|---|---|
| Hobby plan fee (required) | Includes $5 usage credit | **$5** |
| Backend (FastAPI) | 0.5 vCPU avg, 1GB RAM, 24/7 = ~$8 vCPU + $5 RAM = **~$13** minus $5 credit | **~$8** |
| Frontend (Next.js) | 0.25 vCPU, 512MB, 24/7 = ~$4 vCPU + $2.50 RAM | **~$6.50** |
| Cron jobs | Included | **$0** |
| Bandwidth (egress) | 100GB included, then $0.10/GB. Well under. | **$0** |
| Custom domain / SSL | Free | **$0** |
| **Pro plan** (required for horizontal autoscaling) | $20/mo replaces Hobby fee; includes $20 usage credit | swap $5 → $20 |
| **External Firestore** (still used) | Same as GCP | **$1–3** |
| **External Gemini API** | Same | **$2–5** |
| **External GCS or Cloudinary** for uploads | ~$1 | **$1** |
| **Subtotal (Hobby, no horizontal autoscale)** | | **~$22–28/mo** |
| **Subtotal (Pro, with horizontal autoscale)** | $20 + $1 overage + $1–3 Firestore + $2–5 Gemini + $1 storage | **~$25–30/mo** |

**Auto-scaling**: vertical scale-up is automatic on Hobby; **horizontal auto-scaling requires the Pro plan ($20/mo)**. Scale-to-zero is available but off by default — you pay for idle time unless configured.

### Option C — Koyeb

| Line Item | Calculation | Monthly Cost |
|---|---|---|
| Free Nano instance (backend) | 512MB/0.1 vCPU — too small for FastAPI with Gemini | **not viable alone** |
| Starter — eco-nano (backend) | 0.25 vCPU, 512MB, $2.70/mo with scale-to-zero | **~$2.70** |
| Starter — eco-nano (frontend) | 0.25 vCPU, 512MB | **~$2.70** |
| Scale-to-zero | Supported, reduces bill on idle hours | included |
| Bandwidth | 100GB included | **$0** |
| Global edge CDN | Included | **$0** |
| Cron | Built-in | **$0** |
| Custom domain / SSL | Free | **$0** |
| **External Firestore** | Same as GCP | **$1–3** |
| **External Gemini API** | Same | **$2–5** |
| **External storage (GCS/Cloudinary)** for uploads | ~$1 | **$1** |
| **Subtotal** | | **~$10–15/mo** |

**Auto-scaling**: horizontal autoscaling is built-in on all paid plans (scale based on concurrent requests/CPU). Scale-to-zero is native and free.

---

## 4. Three-Way Monthly Cost Summary @ 100 Users

| Provider | Monthly Cost | Autoscaling | Scale-to-Zero | Cold Start | Setup Effort |
|---|---|---|---|---|---|
| **Google Cloud** (Cloud Run + Firebase) | **$6–14** | ✅ Native, free | ✅ | 1–3s | High |
| **Railway** (Hobby, no horizontal) | **$22–28** | Vertical only | Opt-in | 2–4s | Very low |
| **Railway** (Pro, full horizontal) | **$25–30** | ✅ Full | Opt-in | 2–4s | Very low |
| **Koyeb** (Starter) | **$10–15** | ✅ Native, free | ✅ | 1–2s | Low |

---

## 5. Scaling to 1,000 Users (Projection)

If MySmartStudy grows 10×:

| Provider | Est. Monthly Cost |
|---|---|
| Google Cloud | ~$25–50 |
| Railway (Pro) | ~$60–100 |
| Koyeb | ~$40–70 |

Cloud Run wins as you scale because you pay only per request/CPU-second. Railway's per-GB-hour model gets expensive when instances run 24/7.

---

## 6. Recommendation for MySmartStudy

**Winner: Google Cloud (Cloud Run + Firebase Hosting)**

Reasons:
1. **You already use Firestore + Firebase Auth** — staying in GCP avoids cross-cloud egress charges and latency
2. **Cheapest at 100 users (~$6–14/mo)**
3. **Best auto-scaling**: scale-to-zero is native, and `--min-instances=0 --max-instances=10` handles bursts for free
4. **Best CDN** via Firebase Hosting (global edge, HTTP/3)
5. **Future-proof**: same platform from 100 → 100k users with no migration

**Pick Koyeb if**: you want simpler deploys than gcloud and are willing to pay ~$4/mo extra for that UX. Good fit if you want a GCP-lite experience without the console complexity.

**Pick Railway only if**: you need a bundled Postgres/Redis/Mongo in the same platform and you value the cleanest developer UX over cost. For 100 users with Firestore already in place, it's the most expensive option with the least upside.

---

## 7. Auto-Scaling Configs

### Google Cloud Run
```bash
gcloud run deploy mysmartstudy-api \
  --min-instances=0 --max-instances=10 \
  --concurrency=80 \
  --cpu=1 --memory=1Gi
```
Scales on concurrent requests per instance. Free.

### Railway (Pro plan required for horizontal)
Service → Settings → **Replicas** → set Min 1, Max 5. Enable **Autoscaling** toggle. Pick CPU or memory threshold.

### Koyeb
```bash
koyeb service create mysmartstudy-api \
  --min-scale 0 --max-scale 10 \
  --autoscaling-concurrent-requests 50
```
Or set in dashboard under Service → Scaling.

---

## 8. Decision Matrix

| Priority | Best Choice |
|---|---|
| Lowest cost at 100 users | **Google Cloud** |
| Lowest cost at 1000+ users | **Google Cloud** |
| Fastest time-to-deploy from zero | **Railway** |
| Simplest + global edge + scale-to-zero | **Koyeb** |
| Already using Firestore/Firebase | **Google Cloud** (no-brainer) |
| Need bundled Postgres + Redis | **Railway** |
| Least vendor lock-in | **Koyeb** |

For MySmartStudy specifically: **Google Cloud**. You're already in the ecosystem, the cost is lowest, and auto-scaling is best-in-class.
