# Folder Structure — LocalScore

```
Cricket/
├── README.md                    Project overview + quick start
├── docker-compose.yml           Local stack: db + redis + minio + backend
├── .env.example                 Environment template (copy to .env)
├── .gitignore
│
├── docs/
│   ├── ARCHITECTURE.md          System design & components
│   ├── ER_DIAGRAM.md            Entity-relationship model (Mermaid)
│   ├── API.md                   REST + WebSocket reference
│   ├── FOLDER_STRUCTURE.md      This file
│   ├── ROADMAP.md               Phased delivery plan
│   └── DEPLOYMENT.md            Deploy, scaling, security, cost
│
└── backend/                     FastAPI service (Phase 1 — complete)
    ├── Dockerfile
    ├── requirements.txt
    ├── pytest.ini
    ├── alembic.ini
    ├── alembic/
    │   ├── env.py               Migration env (sync URL from settings)
    │   ├── script.py.mako
    │   └── versions/            Migrations (initial schema generated)
    ├── app/
    │   ├── main.py              FastAPI + Socket.IO ASGI entrypoint (socket_app)
    │   ├── seed.py              Demo data seeder
    │   ├── core/
    │   │   ├── config.py        Pydantic settings
    │   │   ├── database.py      Async engine, session, declarative Base
    │   │   └── security.py      Password hashing + JWT helpers
    │   ├── models/              SQLAlchemy ORM (one file per aggregate)
    │   │   ├── enums.py
    │   │   ├── base.py          TimestampMixin
    │   │   ├── user.py          User + match_admins association
    │   │   ├── venue.py  team.py  player.py
    │   │   ├── tournament.py    Tournament + TournamentTeam (standings)
    │   │   ├── match.py  innings.py  ball.py
    │   │   └── stats.py         PlayerMatchStats (denormalized aggregate)
    │   ├── schemas/             Pydantic request/response models
    │   │   ├── auth.py  catalog.py  match.py
    │   ├── api/
    │   │   ├── deps.py          DB session, current-user, RBAC guards
    │   │   ├── router.py        Aggregates all v1 routers
    │   │   └── v1/
    │   │       ├── auth.py          register/login/refresh/me
    │   │       ├── teams.py         teams + players (CRUD)
    │   │       ├── venues.py  tournaments.py  matches.py
    │   │       ├── scoring.py       ball / undo / result (+ realtime emit)
    │   │       ├── public.py        dashboard, live, scorecard, commentary, AI
    │   │       └── admin.py         super-admin user/role management
    │   ├── services/
    │   │   ├── scoring_engine.py    Cricket rules: record_ball / undo_last_ball
    │   │   └── scoreboard.py        Live score + full scorecard builders
    │   └── realtime/
    │       └── socket.py            Socket.IO server + emit helpers (Redis-backed)
    └── tests/
        ├── conftest.py             In-memory SQLite fixture
        ├── test_scoring_engine.py  Rules: over with runs/extras/wicket; no-ball; undo
        └── test_api_smoke.py       Full e2e: login→teams→match→score→public read

# Planned (later phases — see ROADMAP.md)
├── ai-service/      Python ML/LLM microservice            [Phase 4]
├── web/             React + TypeScript + Vite             [Phase 3]
├── mobile/          React Native (Android/iOS)            [Phase 5]
└── infra/           IaC, GitHub Actions workflows         [Phase 6]
```

## Conventions
- **One model file per aggregate**; `models/__init__.py` imports all so Alembic sees full metadata.
- **Routers are thin**; cricket logic lives in `services/`, auth in `core/security.py` + `api/deps.py`.
- **The `balls` table is the immutable source of truth**; `player_match_stats` and innings totals are derived/denormalized for cheap reads and kept consistent transactionally by the engine.
- **`socket_app`** (not `app`) is the ASGI object servers run — it mounts both REST and realtime.
