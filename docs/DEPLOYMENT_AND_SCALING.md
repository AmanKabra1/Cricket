# LocalScore — Deployment & Scaling Guide

The single source for **deploying** LocalScore and **scaling** it to large traffic.
Hand this to any engineer or agent.

---

## 1. What's been built (phase log)

| Phase | Delivered |
|------:|-----------|
| 1–6 | Core platform: auth/roles, teams/players/venues, tournaments + fixtures + standings, ball-by-ball scoring engine, live scorecard/commentary, web + app, realtime (Socket.IO), image uploads, email. |
| 7 | AI win-probability service (heuristic, no keys) wired into web + app, cached. |
| 8 | Mobile app to feature-parity (scoring, toss, analytics, admin). |
| 9 | Player career stats + global leaderboards. |
| 10 | Tournament leaderboards, MVP ranking, Tournament MVP, Player of the Match. |
| 11 | Reliability: match-assignment email, `/ready` probe, DSN-gated **Sentry** (backend + web). |
| 12 | Engagement: match push notifications + tap-to-open, **follow team/tournament**, **HTML emails**, **knockout bracket view**. |

Quality bar: **GitHub Actions CI** — backend (ruff + pytest + `alembic upgrade head`
on a fresh DB), ai-service (ruff + pytest), web (`tsc` + Vite build), mobile (`tsc`).

> The app's `@sentry/react-native` was removed (it broke EAS Android builds);
> error tracking remains on web + backend.

---

## 2. Topology

```
        Vercel (CDN + React)         Render (Docker containers)             Managed
   ┌──────────────────────────┐   ┌───────────────────────────────┐  ┌──────────────┐
   │  web (static, edge-cached)│──▶│  backend ×N (FastAPI ASGI)     │─▶│ TiDB Cloud   │
   │  app (Expo / EAS)         │──▶│  ai-service ×M                  │  │ (MySQL-compat)│
   └──────────────────────────┘   │  redis (managed) — cache+pubsub │  └──────────────┘
                                   └───────────────────────────────┘  ┌──────────────┐
                                                                       │ S3 / R2 + CDN│  (media)
                                                                       └──────────────┘
```
The backend is **stateless** → scales horizontally behind the platform load
balancer. The realtime layer is the scaling-critical piece (see §4).

- **web** → **Vercel** (`web/vercel.json`), auto-deploys on push to `main`.
- **backend** + **ai-service** → **Render** via blueprint `render.yaml` (Docker,
  auto-deploy). Backend start = migrate then boot (`backend/start.sh`,
  `uvicorn app.main:socket_app`).
- **DB** → **TiDB Cloud** (TLS). Local dev = SQLite.
- **app** → **EAS builds** (Play Store submission on hold).

### Automation (`.github/workflows/`)
- **ci.yml** — on every push/PR: backend (ruff + pytest + `alembic upgrade head`),
  ai-service (ruff + pytest), web (`tsc` + Vite build), mobile (`tsc`).
- **deploy.yml** — optional Render deploy-hook trigger after CI is green (no-op
  unless the hook secrets are set; Render/Vercel also auto-deploy on push).
- **keep-alive.yml** — pings the free Render services so they don't sleep.
- **maintenance.yml** — hourly cron → housekeeping (purge/expire/reminders) as a
  backup to the in-process scheduler.
- **train-ai-model.yml** — nightly (02:30 UTC) retrain of the win-probability model.

### Required env vars (production)
**Backend (Render):** `SECRET_KEY`, `DATABASE_URL`, `SYNC_DATABASE_URL`,
`DB_SSL=true`, `BACKEND_CORS_ORIGINS`, `FRONTEND_URL`, `AI_SERVICE_URL`,
`MAINTENANCE_TOKEN`, email (`BREVO_API_KEY` **or** `SMTP_*` / `RESEND_*`), object
storage (`STORAGE_BACKEND=s3` + `S3_*`), optional `REDIS_URL`, optional
`SENTRY_DSN`. Retention: `COMPLETED_MATCH_RETENTION_DAYS` (default 7),
`ADMIN_RETENTION_DAYS` (default 15) — raise to keep more history (§6).
**Web (Vercel):** `VITE_API_BASE_URL`, `VITE_SOCKET_URL`, optional `VITE_SENTRY_DSN`.
**App (EAS):** `EXPO_PUBLIC_SENTRY_DSN` (only if app Sentry is re-added).

---

## 3. First deploy on free tiers (step by step)

**Free stack:** Web → Vercel Hobby · Backend + AI → Render Free · DB → TiDB Cloud
Serverless · Redis/Images → skip for V1 · AI text → templates (no key).
You'll need free accounts: **GitHub, TiDB Cloud, Render, Vercel.**

> ⚠️ Render Free services **sleep after ~15 min idle** → first request wakes in
> ~30–60s. Fine for a demo; bump to `starter` for always-on.

**Step 1 — DB: TiDB Cloud Serverless**
1. tidbcloud.com → create a **Serverless** cluster (free).
2. `CREATE DATABASE localscore;` in the SQL editor.
3. **Connect** → copy host, port `4000`, user (`xxxxx.root`), password. Use as:
   - `DATABASE_URL` = `mysql+aiomysql://USER:PASS@HOST:4000/localscore`
   - `SYNC_DATABASE_URL` = `mysql+pymysql://USER:PASS@HOST:4000/localscore`
   - `DB_SSL=true` (TiDB requires TLS; handled via system CA — no `?ssl=` params).

**Step 2 — Backend + AI: Render**
1. render.com → **New → Blueprint** → connect the repo. It reads `render.yaml`
   and proposes `localscore-backend` + `localscore-ai` (both free).
2. Set the backend `sync:false` env vars: the DB URLs + `DB_SSL=true`,
   `BACKEND_CORS_ORIGINS` (blank for now), `AI_SERVICE_URL` (the AI service's
   internal Render URL, e.g. `http://localscore-ai:10000`), `S3_*` (blank in V1).
3. Deploy. The backend runs `alembic upgrade head` on boot → TiDB tables created.
   Wait for `/health` green at `https://localscore-backend-XXXX.onrender.com/health`.

**Step 3 — Web: Vercel**
1. vercel.com → **Add New → Project** → import repo. **Root Directory: `web`**
   (Vite auto-detected via `web/vercel.json`).
2. Env: `VITE_API_BASE_URL=https://localscore-backend-XXXX.onrender.com/api/v1`,
   `VITE_SOCKET_URL=https://localscore-backend-XXXX.onrender.com`. Deploy.

**Step 4 — Connect CORS + first super admin**
1. In Render, set backend `BACKEND_CORS_ORIGINS` to your Vercel URL → redeploy.
2. Register a user on the site, then promote in the TiDB SQL editor:
   `UPDATE localscore.users SET role='SUPER_ADMIN' WHERE email='you@example.com';`
3. Log in → **Manage** → create teams/players/a match → score it. Spectators need
   no login.

**Email (Brevo — free 300/day):** brevo.com → **SMTP & API** (login + generate
key) → verify a sender. Set on Render: `SMTP_HOST=smtp-relay.brevo.com`,
`SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM=LocalScore <verified@domain>`,
`FRONTEND_URL=https://<vercel-app>`. (Or use `BREVO_API_KEY` for the HTTPS API.)

**Turning on optional bits later**
| Feature | To enable |
|---|---|
| Always-on (no cold start) | Render plan → `starter` (~$7/mo each) |
| Image uploads | Cloudflare R2 (free 10GB) or S3 → set `STORAGE_BACKEND=s3` + `S3_*` |
| Redis (multi-instance) | managed Redis / Upstash → set `REDIS_URL` (+ §4 Socket.IO adapter) |
| AI LLM commentary | set `OPENAI_API_KEY`/`GEMINI_API_KEY` + `AI_COMMENTARY_ENABLED` |
| App store release | EAS Build + Apple/Google accounts (on hold) |

---

## 4. Scaling to "big level" — the playbook

Target: ~100k registered users, ~10k concurrent live-score viewers. Do these in
order; stop when you meet your load goal.

**Step 0 — Off free tier:** Render `localscore-backend` + `localscore-ai` →
`starter`/`standard` (no sleep, no cold starts).

**Step 1 — Database:** TiDB Serverless → **Dedicated** as reads grow. Ensure
indexes on hot filters: `matches(status, scheduled_at)`, `balls(innings_id,
sequence)`, `player_match_stats(match_id, player_id)`, `follows(team_id)/(tournament_id)`.
Tune the SQLAlchemy pool in `core/database.py`.

**Step 2 — Horizontal backend (the key step).** The read storm is the hard part:
viewers outnumber scorers ~1000:1 and want sub-second updates — **don't let them
poll REST**. Today cache + Socket.IO are **in-memory**, so to run >1 instance you
MUST externalize both:
- **Set `REDIS_URL`** → `core/cache.py` auto-switches to Redis (shared hot-read
  cache; one ball → one write → cache invalidate → all instances serve fresh).
- **Socket.IO Redis adapter** → in `realtime/socket.py` build the `AsyncServer`
  with `client_manager=socketio.AsyncRedisManager(REDIS_URL)`, so a ball scored on
  instance A reaches viewers connected to instance B. Without this, realtime
  breaks across instances.
- Then raise instance count / Uvicorn workers. Each pod handles a few thousand
  sockets; 3–5 pods cover 10k concurrent.

**Step 3 — Media:** `STORAGE_BACKEND=s3` with **Cloudflare R2** (free egress) —
`storage.py` already supports it. Serve via the CDN URL, not app-server disk.

**Step 4 — AI service:** stays separate (scales independently). Backend already
**caches predictions by score state** (one call per unique moment) and degrades
gracefully if it's down. Real LLM → set the key + `AI_COMMENTARY_ENABLED` (watch cost).

**Step 5 — Read scaling:** public dashboard/live/scorecard are cached (short TTL)
in `public.py`; with Redis this shields the DB during a popular match. Add
**Cloudflare** edge caching for public GETs; consider TiDB read replicas for heavy
analytics/leaderboards.

**Step 6 — Observability:** turn on Sentry; use `/ready` (DB-aware) as the LB
health check and `/health` for liveness; add an uptime monitor.

**Step 7 — Load test:** k6 / Locust against `/public/matches/{id}/live` + a
Socket.IO script. Fix whatever saturates first (usually DB connections or
single-instance Socket.IO → Steps 1–2).

**Step 8 — App store (when ready):** finalize `app.json`,
`eas build -p android --profile production`, then `eas submit`.

### Capacity sketch (10k concurrent viewers, ~50 live matches)
| Component | Sizing |
|-----------|--------|
| Backend   | 4–6 pods × 1 vCPU / 1–2 GB |
| Redis     | 1 managed instance, ~1–2 GB |
| AI service| 1–2 pods × 2 vCPU / 4 GB |
| TiDB Cloud| Dedicated; scale tier as data grows |

---

## 5. Security best practices
- **Auth:** bcrypt hashing; short-lived access + rotating refresh tokens;
  `SECRET_KEY` from secrets, rotated periodically (rotating it logs everyone out).
- **AuthZ:** RBAC on every write; per-match admin checked server-side.
- **Transport:** TLS everywhere (platform certs); HSTS.
- **Input:** Pydantic validation on every body; parameterized SQL (no SQLi).
- **CORS:** explicit allow-list (`BACKEND_CORS_ORIGINS`), never `*` in prod.
- **Abuse:** rate limiting on auth + writes; request-size + upload type/size limits.
- **Data:** least-privilege DB user; encryption at rest (TiDB/S3); minimal PII.
- **Realtime:** Socket.IO rooms are read-only/public (scores are public); scoring
  is REST-only + authenticated, so a malicious socket can't mutate state.
- **Ops:** dependency + secret scanning, Sentry, audit logs on admin actions.

## 6. Cost estimation (rough monthly, USD, at the stated scale)
| Item | Assumption | Est./mo |
|------|-----------|---------|
| Web (Vercel) | Pro | $20 |
| Backend (Render) | 4–6 small containers | $60–120 |
| AI service | 1–2 containers | $25–60 |
| Redis (managed) | 1–2 GB | $15–30 |
| TiDB Cloud | Starter → Dedicated | $0–100 |
| Object storage + CDN | media + egress | $10–40 |
| LLM API (optional) | usage-based + cached | $20–150 |
| Monitoring (Sentry) | team tier | $0–30 |
| **Total** | | **~$150–550** |

Levers: aggressive Redis caching cuts the DB tier; cache LLM commentary; scale
the AI service to zero when no live matches. The dominant variables are LLM usage
and backend pod count — both scale with **live-match concurrency**, not total users.

---

## 7. Data-retention safety
A background job (`services/maintenance.py`, runs automatically; also
`POST /api/v1/admin/maintenance/run`) deletes **completed/abandoned matches**
older than `COMPLETED_MATCH_RETENTION_DAYS` (default **7**) and **MATCH_ADMIN**
accounts older than `ADMIN_RETENTION_DAYS` (default **15**, with their matches),
retires no-show matches, and sends reminders.

This purge is **intentional** — it keeps the free-tier DB small. **Teams, players
and venues are NEVER auto-deleted.** On a paid DB where you want full history,
**raise** those values (env var on Render overrides the code default). Manual
scripts in `backend/reset_and_seed.sql` give a soft reset that keeps teams/admins.

---

## 8. Fresh large-scale deploy checklist
- [ ] Render services on a paid plan (no sleep).
- [ ] TiDB dedicated; hot indexes present; pool sized.
- [ ] `REDIS_URL` set **and** Socket.IO Redis adapter wired (§4 Step 2).
- [ ] `STORAGE_BACKEND=s3` + R2/S3 creds.
- [ ] CORS (`BACKEND_CORS_ORIGINS`) + `FRONTEND_URL` correct.
- [ ] Email sender verified; `SENTRY_DSN` set.
- [ ] Retention env vars sane; backups/exports planned.
- [ ] Load test passed for target concurrency.
- [ ] CI green on `main`.
