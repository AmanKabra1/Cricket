# System Architecture — LocalScore

## 1. Overview

LocalScore is a real-time, multi-tenant sports scoring platform. The defining constraints:

- **Public read at scale** — up to **10,000 concurrent live-score viewers** with no login, and **100,000+ registered users** overall.
- **Authenticated write by few** — only assigned match admins/umpires push ball-by-ball updates.
- **Low-latency fan-out** — a single ball update must reach thousands of viewers in well under a second.
- **Read-heavy** — viewers vastly outnumber scorers (~1000:1). The architecture optimizes for cheap, cacheable reads and a clean write path.

The system is a set of independently deployable services behind an API gateway / load balancer.

```
                            ┌──────────────────────────────┐
        Spectators ───────▶ │   CDN (static web assets)     │
        (no login)          └──────────────────────────────┘
                                          │
   ┌───────────────┐         ┌────────────▼─────────────┐
   │  Web (React)  │         │   Load Balancer / Ingress │
   │ Mobile (RN)   │────────▶│      (TLS, routing)       │
   └───────────────┘         └───────┬──────────┬────────┘
        ▲   ▲                         │          │
        │   │ WebSocket (Socket.IO)   │ REST     │ REST
        │   └─────────────────────────┘          │
        │                              ┌──────────▼───────────┐      ┌──────────────────┐
        │                              │   FastAPI backend     │─────▶│  AI service       │
        │   live events                │  (N stateless pods)   │ REST │  (FastAPI + ML)   │
        └──────────────────────────────│  REST + Socket.IO ASGI│      │  XGBoost/LightGBM │
                                        └───┬───────┬───────┬───┘      │  LangChain/LLM    │
                                            │       │       │          └──────────────────┘
                              ┌─────────────▼┐  ┌───▼────┐ ┌▼──────────┐
                              │ TiDB (MySQL)  │  │ Redis  │ │ S3 / MinIO│
                              │  primary data │  │ pub/sub│ │  media    │
                              │               │  │ +cache │ │           │
                              └───────────────┘  └────────┘ └───────────┘
```

## 2. Services

### 2.1 Backend (FastAPI, ASGI)
The core service. Stateless — any pod can serve any request. Responsibilities:
- REST API (`/api/v1/...`) for auth, CRUD (teams, players, matches, tournaments), scoring, and public reads.
- Socket.IO server mounted on the same ASGI app for realtime fan-out.
- Business logic: the **cricket scoring engine** (the heart of the product) and **stats aggregation**.
- RBAC enforcement and per-match admin authorization.

Stateless design means we scale horizontally by adding pods behind the load balancer.

### 2.2 Realtime layer (Socket.IO + Redis)
Socket.IO clients join a **room per match** (`match:{id}`). When a scorer posts a ball:
1. The scoring engine persists the ball + updated innings totals in a single DB transaction.
2. The backend emits a `score_update` event to room `match:{id}`.
3. With multiple backend pods, Socket.IO uses the **Redis pub/sub adapter** so an event emitted on pod A reaches viewers connected to pod B.

This decouples write throughput (small — a few scorers) from read fan-out (large — thousands of viewers), which is the whole game for live scoring at scale.

### 2.3 AI service (Phase 4)
A separate Python FastAPI microservice so heavy ML/LLM dependencies (XGBoost, LightGBM, LangChain) never bloat or destabilize the core API. The backend calls it over HTTP and caches results in Redis. Endpoints: win-probability, projected score, best-player index, commentary generation, match summary, player insights. Phase 1 ships the architecture with **heuristic stubs**; trained models are swapped in once real match data accumulates.

### 2.4 Database (TiDB)
TiDB is MySQL wire-compatible and horizontally scalable (distributed SQL), so we get the familiar SQLAlchemy/MySQL developer experience locally and elastic scale in production without re-architecting. Locally we run MySQL 8 in Docker; production points `DATABASE_URL` at TiDB Cloud.

### 2.5 Object storage (S3 / MinIO)
Team logos, player photos, and match images. Uploads go through the backend (validation + auth), which returns the object's public URL. Locally, MinIO provides an S3-compatible API; production uses AWS S3 + CloudFront.

## 3. Request paths

**Public read (the hot path):**
`Viewer → LB → backend → Redis cache hit → JSON`. Live-score endpoints are cached in Redis with short TTLs and invalidated on each ball, so the DB is shielded from the read storm. The heaviest realtime traffic rides the WebSocket, not REST polling.

**Scoring write:**
`Admin → LB → backend (authz: is this admin assigned to this match?) → scoring engine → DB txn → Redis cache invalidate → Socket.IO emit → fan-out to room`.

## 4. Authentication & authorization
- **JWT** access tokens (short-lived) + refresh tokens (long-lived). Passwords hashed with bcrypt (passlib).
- **RBAC roles:** `PUBLIC` (registered but unprivileged), `MATCH_ADMIN`, `SUPER_ADMIN`. Most read endpoints require no auth at all.
- **Per-match authorization:** a `match_admins` association table assigns admins to specific matches; scoring endpoints check membership. Super admins bypass the check.

See [API.md](API.md) for the full auth flow.

## 5. Multi-sport extensibility
Cricket-specific logic (overs, innings, ball-by-ball) lives behind a `ScoringEngine` interface in `app/services/`. Matches carry a `sport` discriminator. Adding football/kabaddi means implementing a new engine + event schema without touching teams/players/tournaments/venues, which are sport-agnostic. Phase 1 implements only `CricketScoringEngine`.

## 6. Observability & reliability (production)
- Structured JSON logging, request IDs, `/health` and `/ready` probes.
- Metrics (Prometheus) on request latency, Socket.IO connections, DB pool usage.
- Graceful degradation: if the AI service is down, AI tabs show "unavailable" but live scoring is unaffected.

See [DEPLOYMENT.md](DEPLOYMENT.md) for scaling strategy, security hardening, and cost estimates.
