# Deployment, Scaling, Security & Cost — LocalScore

Target: **100,000 registered users** and **10,000 concurrent live-score viewers**.

## 1. Topology

```
        Vercel (CDN + React)         Railway/Render (containers)        Managed
   ┌──────────────────────────┐   ┌───────────────────────────────┐  ┌──────────────┐
   │  web (static, edge-cached)│──▶│  backend  ×N (FastAPI ASGI)    │─▶│ TiDB Cloud   │
   │  mobile (RN, app stores)  │──▶│  ai-service ×M (ML/LLM)        │  │ (distributed)│
   └──────────────────────────┘   │  redis (managed) — pub/sub+cache│  └──────────────┘
                                   └───────────────────────────────┘  ┌──────────────┐
                                                                       │ S3+CloudFront│
                                                                       │ (media)      │
                                                                       └──────────────┘
```

The backend is **stateless**, so it scales horizontally behind the platform load
balancer. The realtime layer is the scaling-critical piece (see below).

## 2. Scaling strategy

### The read storm is the hard part
Viewers outnumber scorers ~1000:1, and they want sub-second updates. We do **not**
let 10k clients poll REST.

1. **WebSocket fan-out, not polling.** Viewers hold a Socket.IO connection and
   join `match:{id}`. One ball → one DB write → one emit → fan-out to the room.
   Each backend pod handles a few thousand sockets; 3–5 pods cover 10k concurrent.
2. **Redis pub/sub adapter** bridges pods so a ball scored on pod A reaches viewers
   on pod B. Redis is the single coordination point and scales to this easily.
3. **Cache hot REST reads.** `/public/dashboard` and `/public/matches/{id}/live`
   are cached in Redis with short TTLs, invalidated on each ball. The DB never sees
   the read storm.
4. **DB shielded.** Writes are tiny (a handful of scorers). TiDB’s distributed SQL
   handles the write volume of even hundreds of simultaneous matches; read replicas
   absorb scorecard/leaderboard queries.
5. **Denormalized `player_match_stats`** means scorecards are a single indexed
   read, never an aggregation over the `balls` log.

### Autoscaling signals
- Backend pods: scale on **active WebSocket connections** + CPU.
- AI service: scale on request queue depth; it’s isolated so heavy ML never
  affects live scoring.
- Connection draining on deploy so viewers reconnect transparently.

### Capacity sketch (10k concurrent viewers, ~50 live matches)
| Component   | Sizing                                  |
|-------------|------------------------------------------|
| Backend     | 4–6 pods × 1 vCPU / 1–2 GB               |
| Redis       | 1 managed instance, ~1–2 GB             |
| AI service  | 1–2 pods × 2 vCPU / 4 GB (LLM I/O-bound) |
| TiDB Cloud  | Starter/Essential tier, scale tier up as data grows |

## 3. CI/CD (GitHub Actions)

Pipeline (per PR + on merge to `main`):
1. **Lint + type-check** (ruff, mypy) and **test** (pytest with SQLite) for backend; ESLint/tsc + vitest for web.
2. **Build** multi-stage Docker images, push to registry (GHCR).
3. **Migrate**: `alembic upgrade head` against the target DB as a release step.
4. **Deploy**: web → Vercel (preview per PR, prod on merge); backend/ai → Railway/Render.
5. **Smoke test** `/health` post-deploy; auto-rollback on failure.

Secrets (`SECRET_KEY`, DB URL, S3 keys, `OPENAI_API_KEY`) live in the platform
secret store / GitHub Encrypted Secrets — never in the repo.

## 4. Security best practices
- **Auth:** bcrypt password hashing; short-lived access tokens + rotating refresh tokens; `SECRET_KEY` from secrets, rotated periodically.
- **AuthZ:** RBAC on every write; per-match admin assignment checked server-side (never trust the client).
- **Transport:** TLS everywhere (platform-managed certs); HSTS.
- **Input:** Pydantic validation on every body; SQLAlchemy parameterized queries (no string SQL) → no SQLi.
- **CORS:** explicit allow-list (`BACKEND_CORS_ORIGINS`), not `*` in production.
- **Abuse:** rate limiting on auth + write endpoints; request-size limits; upload type/size validation and out-of-band virus scan for images.
- **Data:** least-privilege DB user; encrypted at rest (TiDB Cloud / S3 SSE); PII minimized (only email + name).
- **Ops:** dependency scanning (Dependabot), secret scanning, structured audit logs on admin actions, Sentry for error tracking.
- **Realtime:** Socket.IO read rooms are public by design (scores are public); scoring is REST-only and authenticated, so a malicious socket client cannot mutate state.

## 5. Cost estimation (rough monthly, USD)

Early production at the stated scale. Real numbers vary by provider/region/traffic.

| Item                         | Tier / assumption                          | Est. /mo |
|------------------------------|--------------------------------------------|----------|
| Web hosting (Vercel)         | Pro                                        | $20      |
| Backend (Railway/Render)     | 4–6 small containers                       | $60–120  |
| AI service                   | 1–2 containers                             | $25–60   |
| Redis (managed)              | 1–2 GB                                     | $15–30   |
| TiDB Cloud                   | Starter → Essential as data grows          | $0–100   |
| Object storage + CDN (S3/CF) | media + egress                             | $10–40   |
| LLM API (OpenAI)             | commentary/summaries, usage-based + cached | $20–150  |
| Monitoring (Sentry etc.)     | team tier                                  | $0–30    |
| **Total**                    |                                            | **~$150–550** |

Cost levers: aggressive Redis caching cuts DB tier; cache LLM commentary by
ball-pattern to slash API spend; scale-to-zero the AI service when no live matches.
At 100k users the dominant variables are LLM usage and backend pod count — both
scale with *live-match concurrency*, not total registered users.
