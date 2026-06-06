# 🏏 LocalScore — Local Sports Live Scoring Platform

A real-time scoring platform for **local cricket tournaments and grounds** —
inspired by CricHeroes, Cricbuzz, and ESPN Cricinfo, but built for community
sport. Cricket-first, with a sport-agnostic core (teams/tournaments/venues) ready
to extend to football, kabaddi, etc.

> **Status:** Phases 1–12 complete — full platform live on **web (Vercel)** and
> **backend/AI (Render)**, with an **Expo app** built via EAS (Play Store
> submission intentionally on hold). See [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)
> for the phase log.

### 📚 Start here
- **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** — first-time code tour: folder structure + request flow (controller → service → model).
- **[docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)** — what the app/web do and how to run everything locally.
- **[docs/DEPLOYMENT_AND_SCALING.md](docs/DEPLOYMENT_AND_SCALING.md)** — how it's deployed and the step-by-step playbook to scale to large traffic.

---

## What it does

Admins create teams/players, schedule matches & tournaments, and score
**ball-by-ball**; spectators watch live on web or app with scorecards, charts, AI
win-probability, leaderboards and push notifications.

**Highlights:** auth + roles (public / match-admin / super-admin) · teams,
players (jersey #, C/VC/WK), venues · tournaments (league / round-robin /
knockout) with auto-fixtures, standings (NRR) and a **knockout bracket** ·
full scoring engine (all wicket types incl. caught→fielder, extras, free hit,
strike rotation, undo) · live scorecard, commentary, **analytics** (Manhattan +
two-team worm) · **AI win-probability** · **player career stats + leaderboards**,
Tournament MVP, Player of the Match · **push notifications** (match live/result,
tap-to-open) + **follow a team/tournament** · **HTML emails** · realtime via
Socket.IO · `/health` + `/ready`, DSN-gated **Sentry** (web + backend), CI.

---

## Monorepo layout

```
Cricket/
├── backend/        FastAPI — REST + Socket.IO, scoring engine, auth/RBAC, Alembic
├── ai-service/     FastAPI microservice — win-probability + commentary
├── web/            React + TypeScript + Vite — spectator & admin web app
├── mobile/         Expo / React Native app (expo-router)
├── docs/           Developer, deployment, architecture & API docs
├── render.yaml     Render blueprint (backend + AI)
├── docker-compose.yml   Optional local stack
└── .github/workflows/   CI (lint + tests + migrations)
```

## Tech stack

| Layer        | Technology                                                        |
|--------------|-------------------------------------------------------------------|
| Backend      | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2  |
| Realtime     | python-socketio (ASGI); Redis pub/sub when scaled to >1 instance  |
| Auth         | JWT (access + refresh), RBAC (public / match-admin / super-admin) |
| Database     | TiDB Cloud (MySQL-compatible) in prod; **SQLite** for local dev   |
| Cache        | Redis when `REDIS_URL` is set; in-memory fallback otherwise       |
| Storage      | Local disk (dev) or S3 / Cloudflare R2 (`STORAGE_BACKEND=s3`)     |
| AI           | FastAPI microservice — heuristic win-probability + trainable model |
| Web          | React, TypeScript, Vite, TailwindCSS, Redux Toolkit, React Query, recharts |
| Mobile       | Expo SDK 54 / React Native, expo-router, React Query              |
| DevOps       | Render (backend + AI), Vercel (web), EAS (app), GitHub Actions CI |

---

## Quick start (local, no Docker)

No DB server needed — the backend falls back to SQLite. Full commands (web, app,
AI, tests) are in **[docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)**.

```powershell
# Backend (REST + realtime) — http://localhost:8000/docs
cd backend
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL = "sqlite+aiosqlite:///./local.db"
$env:SYNC_DATABASE_URL = "sqlite:///./local.db"
alembic upgrade head
python -m app.seed                                   # demo teams + logins
uvicorn app.main:socket_app --reload --port 8000     # socket_app = REST + Socket.IO
```
```powershell
# Web — http://localhost:5173
cd web ; npm install
"VITE_API_URL=http://localhost:8000/api/v1`nVITE_SOCKET_URL=http://localhost:8000" | Out-File -Encoding utf8 .env.local
npm run dev
```
```powershell
# App
cd mobile ; npm install ; npx expo start
```

### With Docker (optional)
```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.seed
# API docs: http://localhost:8000/docs
```

## Demo credentials (after `app.seed`)

| Role        | Email                  | Password   |
|-------------|------------------------|------------|
| Super Admin | super@localscore.dev   | superadmin |
| Match Admin | admin@localscore.dev   | adminpass  |

> Note: a background job purges **old match data** (completed matches > 7 days,
> stale match-admin accounts > 15 days) to keep the free-tier DB small — **teams,
> players and venues are never auto-deleted**. Raise the retention env vars to
> keep history longer (see DEPLOYMENT_AND_SCALING.md §4).

## Documentation

| Doc | What |
|-----|------|
| [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | Code tour: folders + controller→service→model flow |
| [CURRENT_STATE.md](docs/CURRENT_STATE.md) | Features + how to run app/web/backend/AI |
| [DEPLOYMENT_AND_SCALING.md](docs/DEPLOYMENT_AND_SCALING.md) | Deploy topology + scale-up playbook |
| [NEXT_STEPS.md](docs/NEXT_STEPS.md) | Phase log & what's next |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [ER_DIAGRAM.md](docs/ER_DIAGRAM.md) · [API.md](docs/API.md) | System design, data model, API reference |
| [AI_MODULE.md](docs/AI_MODULE.md) · [DEPLOY_FREE.md](docs/DEPLOY_FREE.md) · [RUNNING.md](docs/RUNNING.md) | AI service, free-tier deploy, running notes |

## License

Proprietary — © LocalScore. All rights reserved.
