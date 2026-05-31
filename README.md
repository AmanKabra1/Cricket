# 🏏 LocalScore — Local Sports Live Scoring Platform

A production-grade, real-time scoring platform for **local cricket tournaments and grounds** — inspired by CricHeroes, Cricbuzz, and ESPN Cricinfo, but built for community sport. Cricket-first, with an architecture designed to extend to Football, Volleyball, Kabaddi, and Basketball.

> **Status:** Phase 1 — Backend foundation (FastAPI + scoring engine + realtime + auth). See [docs/ROADMAP.md](docs/ROADMAP.md) for the full phased plan.

---

## Monorepo layout

```
Cricket/
├── backend/        FastAPI app — REST + WebSocket, scoring engine, auth/RBAC
├── ai-service/     Python AI microservice (predictions, commentary, insights)  [Phase 4]
├── web/            React + TypeScript + Vite spectator & admin web app          [Phase 3]
├── mobile/         React Native app (Android/iOS)                               [Phase 5]
├── infra/          Deployment, CI/CD, IaC                                       [Phase 6]
├── docs/           Architecture, ER diagram, API spec, deployment, scaling
└── docker-compose.yml   Local dev stack (DB + MinIO + Redis + services)
```

## Tech stack

| Layer        | Technology                                                        |
|--------------|-------------------------------------------------------------------|
| Backend      | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2  |
| Realtime     | python-socketio (ASGI) + Redis pub/sub for horizontal scaling     |
| Auth         | JWT (access + refresh), RBAC (public / admin / super-admin)       |
| Database     | TiDB (MySQL-compatible) — local: MySQL 8 via Docker               |
| Cache/PubSub | Redis                                                             |
| Storage      | S3 in prod, MinIO locally (logos, photos, match images)           |
| AI           | FastAPI microservice — Pandas, scikit-learn, XGBoost, LightGBM, LangChain |
| Web          | React, TypeScript, Vite, TailwindCSS + Bootstrap 5, Redux Toolkit, React Query, Socket.IO client |
| Mobile       | React Native (shared API contract)                                |
| DevOps       | Docker, Docker Compose, GitHub Actions; Vercel / Railway / TiDB Cloud |

## Quick start (local)

Prerequisites: **Docker Desktop** and **Docker Compose**.

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Boot the local stack (MySQL/TiDB-compatible + Redis + MinIO + backend)
docker compose up -d --build

# 3. Run database migrations + seed demo data
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.seed

# 4. Open the API docs
#    http://localhost:8000/docs        (Swagger UI)
#    http://localhost:8000/redoc       (ReDoc)
#    http://localhost:9001             (MinIO console — minioadmin/minioadmin)
```

### Run the backend without Docker

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Point DATABASE_URL at a running MySQL/TiDB, then:
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

## Demo credentials (after seeding)

| Role        | Email                  | Password   |
|-------------|------------------------|------------|
| Super Admin | super@localscore.dev   | superadmin |
| Match Admin | admin@localscore.dev   | adminpass  |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture & component design
- [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md) — entity-relationship model
- [docs/API.md](docs/API.md) — REST + WebSocket API reference
- [docs/ROADMAP.md](docs/ROADMAP.md) — phased delivery plan
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploy, scaling, security, cost

## License

Proprietary — © LocalScore. All rights reserved.
