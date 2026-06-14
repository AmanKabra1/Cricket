# LocalScore — Current State & How to Run

What works today across **app**, **web**, and **backend**, and the exact commands
to run each locally.

## What the product does

LocalScore is a **live cricket scoring** platform. Admins create teams, schedule
matches/tournaments and score ball-by-ball; spectators watch live on the web or
app with scorecards, charts, AI win-probability, leaderboards and notifications.

### Features (all live)
- **Auth & roles** — PUBLIC (spectator), MATCH_ADMIN (scores their matches),
  SUPER_ADMIN (everything + approves tournaments, manages users/settings).
- **Teams & players** — CRUD, logos/photos, captain/vice-captain/keeper, jersey
  numbers (shown as #N badges everywhere), batting/bowling styles.
- **Venues**, **tournaments** (league / round-robin / knockout), auto-generated
  **fixtures**, **standings** with NRR, super-admin **approval** for tournaments.
- **Matches** auto-approve (show immediately); toss with animated coin; overs
  capped at 50.
- **Ball-by-ball scoring** (web + app): all wicket types incl. **caught → pick the
  fielder** (credits the catch), extras, free hit, strike rotation, undo, locking
  players mid-over, match-complete celebration.
- **Live spectating** — live score, full scorecard, commentary, **analytics**
  (Manhattan per-over bars + a single worm comparing both teams' cumulative runs),
  **AI win-probability** (wickets-in-hand uses real squad size).
- **Player stats** — career batting/bowling/fielding, **leaderboards** (runs,
  wickets, MVP), per-tournament leaderboards + **Tournament MVP**, **Player of
  the Match**.
- **Engagement** — push notifications on match-live & result (tap → opens the
  Match Centre), **follow a team/tournament** for targeted alerts, **knockout
  bracket view**.
- **Emails** (Brevo/Resend/SMTP) — admin welcome, match assignment, pre-match
  reminder, all with branded **HTML** + plain-text fallback.
- **Reliability** — `/health` (liveness) & `/ready` (DB check), DSN-gated
  **Sentry** on web + backend, CI (lint + tests + migrations).
- **Auto-housekeeping** — purges old matches & stale admins (long retention; see
  note below), retires no-show matches, sends reminders.

> ⚠️ **Auto-deletion — by design, to keep the free-tier DB small.** A background
> job deletes **completed/abandoned matches** older than
> `COMPLETED_MATCH_RETENTION_DAYS` (default **7 days**) and **MATCH_ADMIN
> accounts** older than `ADMIN_RETENTION_DAYS` (default **15 days**, with their
> matches). This is intentional so old data doesn't pile up. **Teams, players and
> venues are NEVER auto-deleted.** To keep history longer, raise these (code
> default or the env var on Render). Manual reset tools live in
> `backend/reset_and_seed.sql`.

---

## Run it locally

Prerequisites: **Python 3.12**, **Node 18+**, npm. (No DB server needed — the
backend falls back to SQLite locally.)

### 1) Backend (REST + realtime) — port 8000
```powershell
cd backend
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Local dev uses SQLite + sensible defaults; create a .env only to override.
$env:DATABASE_URL = "sqlite+aiosqlite:///./local.db"
$env:SYNC_DATABASE_URL = "sqlite:///./local.db"
alembic upgrade head            # create the tables
uvicorn app.main:socket_app --reload --port 8000
```
API docs at http://localhost:8000/docs · health at `/health` · readiness `/ready`.
(`app.main:socket_app` mounts BOTH the REST API and the Socket.IO server.)

### 2) Web — port 5173
```powershell
cd web
npm install
# point the web at your local API:
"VITE_API_BASE_URL=http://localhost:8000/api/v1`nVITE_SOCKET_URL=http://localhost:8000" | Out-File -Encoding utf8 .env.local
npm run dev
```
Open http://localhost:5173. Build = `npm run build`; typecheck happens in build.

### 3) Mobile app
```powershell
cd mobile
npm install
npx expo start          # press a (Android) / i (iOS) / scan QR in Expo Go
```
The app's API base is in `app.json` → `extra.apiBaseUrl`. For local testing point
it at your machine's LAN IP (not localhost) so a phone can reach it, or build a
dev client. Push notifications need a **development/production build** (not Expo Go).

Useful: `npm run typecheck` (mobile & web) before committing.

### 4) AI — no separate service
The AI runs **in-process** inside the backend (`backend/app/ai`), so there's
nothing extra to start. Predictions: `GET /api/v1/public/matches/{id}/prediction`;
raw tools: `GET /api/v1/ai/health`, `POST /api/v1/ai/win-probability`, etc.
Set `GEMINI_API_KEY` to enable LLM commentary/insights (templates without it).
To (optionally) train the model: `pip install -r requirements-ml.txt` then
`python -m app.ai.train.train_win_probability` from `backend/`.

---

## Quick smoke test (curl)
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/public/dashboard
curl -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@localscore.dev","password":"adminpass"}'
```

## Secrets / API keys reference
**Nothing is required to run locally** — defaults are safe and the app degrades
gracefully. Keys matter only for production or optional features.

| Key | Service | Required? | Notes |
|-----|---------|-----------|-------|
| `SECRET_KEY` | backend | Yes in prod (any value locally) | JWT signing. Generate: `python -c "import secrets;print(secrets.token_urlsafe(48))"`. Auto-generated on Render. |
| `DATABASE_URL` / `SYNC_DATABASE_URL` | backend | Yes | Local: SQLite. Prod: TiDB Cloud strings (+ `DB_SSL=true`). |
| `REDIS_URL` | backend | No (in-memory fallback) | Needed in prod for multi-instance cache + Socket.IO fan-out. |
| `STORAGE_BACKEND` + `S3_*` | backend | No (only image uploads) | `s3` for AWS S3 / Cloudflare R2; else local disk. |
| `BREVO_API_KEY` / `SMTP_*` / `RESEND_*` | backend | No (email off if unset) | Any one provider enables email. |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | backend / web | No | Error tracking; inert until set. |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | backend (app/ai) | No | LLM commentary/insights; templates used without it. |

## Tests / quality
```powershell
cd backend ; python -m pytest -q                 # unit + smoke
cd backend ; ruff check app                       # lint (CI uses --select E9,F63,F7,F82)
cd web ; npm run build                             # type-checks + builds
cd mobile ; npm run typecheck
```

See `DEVELOPER_GUIDE.md` for the architecture and `DEPLOYMENT_AND_SCALING.md`
for deploying and scaling.
