# Delivery Roadmap — LocalScore

A phased plan. Each phase produces something runnable and testable before the
next begins. **Phase 1 is complete** (this commit).

## ✅ Phase 1 — Backend foundation (DONE)
- Monorepo + self-contained git repo, Docker Compose local stack (MySQL/TiDB-compatible, Redis, MinIO).
- FastAPI app: settings, async SQLAlchemy 2, Alembic migration, all 11 core tables.
- JWT auth (access + refresh) + RBAC (public / match-admin / super-admin) + per-match authorization.
- **Cricket scoring engine**: ball-by-ball, all extras (wide/no-ball/bye/leg-bye),
  all dismissal types, auto strike-rate / economy / CRR / RRR, undo, innings/over completion.
- REST API (33 routes) for teams, players, venues, tournaments, matches, scoring, public reads, admin.
- Socket.IO realtime fan-out (Redis-backed) for score/commentary/status.
- AI prediction proxy with graceful degradation.
- Tests: scoring-engine unit tests + full end-to-end API smoke test (all green).

## Phase 2 — Backend hardening
- Object-storage upload endpoints (team logos, player photos, match images) → MinIO/S3.
- Tournament engine: fixture generation (league/knockout/round-robin/group), auto points-table + NRR updates on match completion.
- Player career aggregates (cross-match stats) + leaderboards.
- Wagon-wheel / Manhattan / worm data endpoints (derive from `balls`).
- Redis caching layer for hot public reads; rate limiting; structured logging + `/ready`.
- Expanded test suite + CI (GitHub Actions: lint, type-check, test).

## Phase 3 — Web frontend (React + TS + Vite)
- Public app: dashboard, match center (live/scorecard/commentary/XI/wagon-wheel/stats/AI tabs), teams, players, tournaments, leaderboards.
- Admin console: match creation, ball-by-ball scoring UI, roster management.
- Redux Toolkit + React Query for state/data; Socket.IO client for live updates.
- Tailwind + Bootstrap 5, dark/light themes, mobile-first, the cricket-green/navy/white system.

## Phase 4 — AI service (Python microservice)
- FastAPI service with feature pipeline over historical `balls`/stats.
- Win-probability + projected score (XGBoost/LightGBM) once data accumulates; heuristic fallback until then.
- Best-player performance index; player insights (strengths/weaknesses/form).
- LLM commentary + match summaries (LangChain + OpenAI), cached in Redis.

## Phase 5 — Mobile app (React Native)
- Shared API contract with web; spectator-first, plus a lightweight scoring mode for admins.
- Android + iOS builds.

## Phase 6 — DevOps & production
- Multi-stage Docker images; GitHub Actions build/push/deploy.
- Deploy: web → Vercel, backend + AI → Railway/Render, DB → TiDB Cloud, media → S3 + CloudFront.
- Autoscaling, observability (Prometheus/Grafana, Sentry), load testing to the 10k-concurrent target.

## Multi-sport (post-cricket)
- Implement additional `ScoringEngine` strategies (football, kabaddi, volleyball, basketball) behind the existing interface; teams/players/tournaments/venues already sport-agnostic.
