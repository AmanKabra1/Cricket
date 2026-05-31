# Running LocalScore locally + secrets reference

Verified working: backend (REST + WebSocket), AI service, web build, mobile
type-check. This is the practical "how to run it" guide.

## Option A — Full stack with Docker (recommended)

Prereq: Docker Desktop.

```bash
cd Cricket
cp .env.example .env                 # PowerShell: copy .env.example .env
docker compose up -d --build         # db (MySQL) + redis + minio + backend + ai-service
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.seed
```

Open:
- Backend API docs: http://localhost:8000/docs
- AI service docs:  http://localhost:8100/docs
- MinIO console:    http://localhost:9001  (minioadmin / minioadmin)

Web app (separate terminal):
```bash
cd web
npm install
npm run dev          # http://localhost:5173  (proxies /api + /socket.io → :8000)
```

## Option B — Manual, no Docker (lightest; uses SQLite)

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1                 # Windows PowerShell
pip install -r requirements.txt            # includes uvicorn, alembic, etc.

# Use SQLite so no MySQL is needed:
$env:DATABASE_URL="sqlite+aiosqlite:///./dev.db"
$env:SYNC_DATABASE_URL="sqlite:///./dev.db"
$env:ALEMBIC_DATABASE_URL="sqlite:///./dev.db"
$env:SECRET_KEY="local-dev-secret"

alembic upgrade head
python -m app.seed                         # demo teams, players, a live match
uvicorn app.main:socket_app --port 8000 --reload
```

### AI service (separate terminal)
```bash
cd ai-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --port 8100 --reload
```

### Web
```bash
cd web && npm install && npm run dev
```

### Mobile (optional)
```bash
cd mobile && npm install && npm run start   # needs Expo Go app or Android/iOS emulator
```

## Demo logins (after seeding)

| Role        | Email                | Password   |
|-------------|----------------------|------------|
| Super Admin | super@localscore.dev | superadmin |
| Match Admin | admin@localscore.dev | adminpass  |

Spectators need **no login** — all `/public/*` reads are open.

## Quick smoke test (curl)
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/public/dashboard
# login → token
curl -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@localscore.dev","password":"adminpass"}'
```

---

## Secrets / API keys reference

**Nothing is required to run locally** — the app generates/uses safe defaults and
degrades gracefully. Keys matter only for production or to enable optional features.

| Key | Where | Required? | Notes |
|-----|-------|-----------|-------|
| `SECRET_KEY` | backend | **Yes in prod** (any value locally) | JWT signing. Generate: `python -c "import secrets;print(secrets.token_urlsafe(48))"`. On Render it's auto-generated. |
| `DATABASE_URL` / `SYNC_DATABASE_URL` | backend | Yes (local: SQLite or Docker MySQL) | Prod = TiDB Cloud connection strings. |
| `REDIS_URL` | backend | No (falls back to in-memory) | Needed in prod for multi-pod caching + Socket.IO fan-out. |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` / `S3_ENDPOINT_URL` | backend | No (only for image uploads) | Local: MinIO (minioadmin/minioadmin). Prod: AWS S3. |
| `OPENAI_API_KEY` | ai-service | **No (optional)** | Enables LLM commentary/summaries. Without it, templates are used. Get from platform.openai.com. |
| `RENDER_DEPLOY_HOOK_BACKEND` / `_AI` | GitHub secrets | No | Only for the optional CI→Render deploy trigger. |

So to "run fully" right now you need **zero external keys**. To switch on AI text,
add one `OPENAI_API_KEY`. Everything else has a working local default.

---

## Is the code on GitHub? (No — yet)

The project is committed to a **local git repository** (6 commits) but has **no
remote**, so it does **not** appear in your GitHub account. Nothing was pushed.

To publish it later (planned for "V2"):
```bash
# 1. Create an empty repo on github.com (no README/license).
# 2. From the Cricket folder:
cd Cricket
git remote add origin https://github.com/<your-username>/localscore.git
git push -u origin main
```
After that, the repo (and the GitHub Actions CI in `.github/workflows/`) appears
in your account.

## Deploying (planned for "V2")
See [DEPLOYMENT.md](DEPLOYMENT.md) for the full step-by-step: TiDB Cloud →
Render Blueprint (`render.yaml`) for backend + AI + Redis → Vercel for web.
