# LocalScore — Deployment & Scaling Guide

Hand this file to any engineer or agent. It says **what's already built**, **how
it's deployed today**, and **exactly what to change to run it at large scale**.

---

## 1. What's been built (phase log)

| Phase | Delivered |
|------:|-----------|
| 1–6 | Core platform: auth/roles, teams/players/venues, tournaments + fixtures + standings, ball-by-ball scoring engine, live scorecard/commentary, web + app, realtime via Socket.IO, image uploads, email. |
| 7 | AI win-probability service (heuristic, no keys) wired into web + app, cached. |
| 8 | Mobile app to feature-parity (scoring, toss, analytics, admin). |
| 9 | Player career stats + global leaderboards (web + app). |
| 10 | Tournament-scoped leaderboards, MVP ranking, Tournament MVP, Player of the Match. |
| 11 | Reliability: match-assignment email, `/ready` probe, **DSN-gated Sentry** (backend + web). |
| 12 | Engagement: match push notifications + tap-to-open, **follow team/tournament** (targeted alerts), **HTML emails**, **knockout bracket view**. |

Quality bar in place: **GitHub Actions CI** (ruff lint + pytest + `alembic
upgrade head` on a fresh DB) for backend, typecheck/build for web & mobile.

> The app's `@sentry/react-native` was removed (it broke EAS Android builds);
> error tracking remains on web + backend. Re-add later with a setup verified
> for Expo SDK 54 / RN 0.81 if you want app crash reporting.

---

## 2. How it's deployed today (free tier)

```
              ┌─────────────┐     ┌──────────────────┐
  Browser ───▶│  web (Vercel)│────▶│ backend (Render) │───▶ TiDB Cloud (MySQL)
   App  ──────┴─────────────┘     │  FastAPI+SocketIO │───▶ AI svc (Render)
                                   └──────────────────┘───▶ media (local disk / S3-R2)
```
- **web** → **Vercel** (`web/vercel.json`), auto-deploys on push to `main`.
- **backend** + **ai-service** → **Render** via the blueprint `render.yaml`
  (Docker, auto-deploy on push). Backend start = migrate then boot (`backend/start.sh`).
- **DB** → **TiDB Cloud** (external, TLS). Local dev uses SQLite.
- **app** → **EAS builds** (Expo). Play Store submission is **on hold**.
- **CI** → GitHub Actions (`.github/workflows/ci.yml`).

### Deploy steps
1. **Backend/AI**: Render → New → **Blueprint** → point at the repo → fill the
   `sync: false` secrets (DB URLs, CORS, SMTP, S3, AI URL). Pushes auto-deploy.
2. **Web**: import the repo in Vercel; set `VITE_API_URL`, `VITE_SOCKET_URL`
   (and optionally `VITE_SENTRY_DSN`). Pushes auto-deploy.
3. **App build**: `cd mobile && eas build -p android --profile preview` (APK to
   test) or `--profile production` (AAB). Store submit only when you choose to.

### Required environment variables (production)
**Backend (Render):** `SECRET_KEY`, `DATABASE_URL`, `SYNC_DATABASE_URL`,
`DB_SSL=true`, `BACKEND_CORS_ORIGINS`, `FRONTEND_URL`, `AI_SERVICE_URL`,
`MAINTENANCE_TOKEN`, email (`BREVO_API_KEY` **or** `SMTP_*` / `RESEND_*`),
object storage (`STORAGE_BACKEND=s3` + `S3_*` for Cloudflare R2/AWS), optional
`REDIS_URL`, optional `SENTRY_DSN`. Retention: `COMPLETED_MATCH_RETENTION_DAYS`,
`ADMIN_RETENTION_DAYS` (default 365 — see §4).
**Web (Vercel):** `VITE_API_URL`, `VITE_SOCKET_URL`, optional `VITE_SENTRY_DSN`.
**App (EAS):** `EXPO_PUBLIC_SENTRY_DSN` (only if app Sentry is re-added).

---

## 3. Scaling to "big level" — the playbook

Do these in order. Each is independent; stop when you've met your load target.

### Step 0 — Get off free tier (always-on)
- Render: bump `localscore-backend` and `localscore-ai` from `plan: free` to
  `starter`/`standard` (free sleeps after ~15 min → cold starts). This alone
  removes the warm-up delays.

### Step 1 — Database (the first bottleneck)
- TiDB Cloud: move from Serverless to a **Dedicated** cluster as reads grow.
- Ensure **indexes** exist on hot filters: `matches(status, scheduled_at)`,
  `balls(innings_id, sequence)`, `player_match_stats(match_id, player_id)`,
  `follows(team_id)/(tournament_id)`. Add any missing via an Alembic migration.
- Tune the SQLAlchemy pool in `core/database.py` (`pool_size`, `max_overflow`)
  to match instance count × workers.

### Step 2 — Make the backend horizontally scalable  ⚠️ key step
Today a single instance works because cache + Socket.IO are **in-memory**. To run
**multiple instances** behind a load balancer you MUST externalize both:
- **Set `REDIS_URL`** to a managed Redis. `core/cache.py` already switches to
  Redis automatically when it's set (shared hot-read cache across instances).
- **Socket.IO adapter**: add a Redis manager so realtime events fan out across
  instances. In `realtime/socket.py`, construct the `AsyncServer` with
  `socketio.AsyncRedisManager(REDIS_URL)` as `client_manager`. Without this,
  a ball scored on instance A won't reach spectators connected to instance B.
- Then increase Render instance count / Uvicorn workers (e.g. Gunicorn with
  `-k uvicorn.workers.UvicornWorker -w N`).

### Step 3 — Media at scale
- Set `STORAGE_BACKEND=s3` with **Cloudflare R2** (S3-compatible, free egress) —
  `storage.py` already supports it. Serve via the R2/CDN public URL. Don't serve
  user images off the app server's local disk in production.

### Step 4 — AI service
- Keep it a separate service so it scales independently. The backend already
  **caches predictions by score state** (one AI call per unique moment shared by
  all spectators) and degrades gracefully if it's down. To use a real LLM, set
  `OPENAI_API_KEY`/`GEMINI_API_KEY` and flip `AI_COMMENTARY_ENABLED` — watch cost.

### Step 5 — Read scaling & spikes
- The dashboard/live/scorecard endpoints are cached (short TTL) in `public.py` —
  with Redis this shields the DB during a popular match.
- Put **Cloudflare** in front for static + edge caching of public GET responses.
- Consider read replicas (TiDB) if analytics/leaderboards queries get heavy.

### Step 6 — Observability & ops
- Turn on **Sentry** (set `SENTRY_DSN` / `VITE_SENTRY_DSN`).
- Use **`/ready`** (DB-aware) as the load-balancer health check; `/health` for
  liveness. Add an uptime monitor.
- Structured logs are in place; ship them to a log service if needed.

### Step 7 — Load test before launch
- Target the stated goal (e.g. 10k concurrent spectators on one match). Tools:
  k6 / Locust against `/public/matches/{id}/live` + a Socket.IO load script.
  Fix whatever saturates first (usually DB connections or single-instance
  Socket.IO — Steps 1–2).

### Step 8 — App store (when ready)
- Currently **on hold**. When publishing: finalize icon/splash/version in
  `app.json`, `eas build -p android --profile production`, then
  `eas submit -p android`. Repeat for iOS if needed.

### Capacity ladder (rough)
| Stage | Setup |
|------|-------|
| Hundreds | Current: 1 Render instance (starter), TiDB serverless, in-memory cache. |
| Thousands | + Redis (cache **and** Socket.IO adapter), 2–3 instances, R2 media. |
| 10k+ on a match | + multiple instances behind LB, TiDB dedicated, Cloudflare edge cache, load-tested. |

---

## 4. Data-retention safety (important)

A background job (`services/maintenance.py`, runs automatically; also
`POST /api/v1/admin/maintenance/run`) does housekeeping:
- deletes **completed/abandoned matches** older than `COMPLETED_MATCH_RETENTION_DAYS`,
- deletes **MATCH_ADMIN** accounts older than `ADMIN_RETENTION_DAYS` (+ their matches),
- marks no-show scheduled matches as abandoned, sends reminders.

**Teams, players and venues are NEVER auto-deleted.** Defaults were tightened
from 7/15 days to **365 days** so real history doesn't disappear. If you need
free-tier cleanup, lower them — but prefer the manual scripts in
`backend/reset_and_seed.sql` (soft reset keeps teams/admins). If these are set as
**env vars on Render**, change them there too (env overrides the code default).

---

## 5. One-glance checklist for a fresh large-scale deploy
- [ ] Render services on a paid plan (no sleep).
- [ ] TiDB dedicated; hot indexes present; pool sized.
- [ ] `REDIS_URL` set **and** Socket.IO Redis adapter wired (Step 2).
- [ ] `STORAGE_BACKEND=s3` + R2/S3 creds.
- [ ] CORS (`BACKEND_CORS_ORIGINS`) + `FRONTEND_URL` correct.
- [ ] Email provider verified sender; `SENTRY_DSN` set.
- [ ] Retention env vars sane; backups/exports planned.
- [ ] Load test passed for the target concurrency.
- [ ] CI green on `main`.
