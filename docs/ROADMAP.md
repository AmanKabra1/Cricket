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

## ✅ Phase 2 — Backend hardening + scaling (DONE)
- ✅ Object-storage upload endpoints (team logos, player photos, match images) → MinIO/S3.
- ✅ Tournament engine: fixture generation (league/knockout/round-robin/group), auto points-table + NRR recompute on match completion.
- ✅ Manhattan / worm per-over analytics endpoint (derived from `balls`).
- ✅ Redis caching layer for hot public reads (dashboard/live/scorecard) with invalidation on each ball — the 10k-concurrent-viewer scaling lever.
- ✅ Per-IP rate limiting middleware on auth + write endpoints.
- Remaining for later: player career aggregates + leaderboards, structured logging/`/ready`, CI.

## ✅ Phase 3 — Web frontend (React + TS + Vite) (DONE)
- ✅ Public app: dashboard, match center (Live / Scorecard / Commentary / Playing XI / Analytics / AI Prediction tabs), teams, team detail, tournaments + points table & fixtures.
- ✅ Admin console: login + ball-by-ball scoring UI (runs, extras, wickets, undo, start-innings).
- ✅ Redux Toolkit (auth + JWT refresh) + React Query; Socket.IO client pushes live updates into the cache.
- ✅ Tailwind design system + Bootstrap grid, dark/light themes, mobile-first, cricket-green/navy/white.
- ✅ Production Dockerfile (nginx) + build verified (tsc + vite build clean).

## ✅ Phase 4 — AI service (Python microservice) (DONE)
- ✅ Standalone FastAPI service (`ai-service/`, port 8100) wired into docker-compose; backend proxies to it with graceful degradation.
- ✅ Feature pipeline (`app/features.py`) turning live-score state into model features.
- ✅ Win-probability + projected score: transparent cricket **heuristic** now, with a two-tier loader that swaps in a trained **XGBoost/LightGBM** model (`train/train_win_probability.py`) the moment `models/win_probability.joblib` exists — no API change.
- ✅ Best-player performance index; player insights (form + strengths/weaknesses).
- ✅ LLM commentary + match summaries (LangChain + OpenAI) — **optional**, deterministic template fallback when no `OPENAI_API_KEY`.
- ✅ Tests: 7 heuristic-path tests green; app boots and all endpoints verified over HTTP.
- Remaining for later: export real historical data for training; nightly retrain + model versioning; cache AI results in Redis.

## ✅ Phase 5 — Mobile app (React Native / Expo) (DONE)
- ✅ Expo SDK 52 + React Native 0.76 + TypeScript, Expo Router file-based navigation (Android + iOS + web targets).
- ✅ Shared API contract with web: typed React Query hooks, axios client with AsyncStorage JWT + refresh, socket.io-client for live push.
- ✅ Spectator-first screens: dashboard (live/upcoming/recent), teams + squad, tournaments, and a Match Centre (Live / Scorecard / Commentary) with realtime socket updates.
- ✅ Light/dark theme, cricket-green/navy palette; `tsc --noEmit` clean (940 deps installed).
- Remaining for later: admin lightweight scoring mode (API client plumbing already in place); EAS build/submit for store releases.

## Phase 6 — DevOps & production
- Multi-stage Docker images; GitHub Actions build/push/deploy.
- Deploy: web → Vercel, backend + AI → Railway/Render, DB → TiDB Cloud, media → S3 + CloudFront.
- Autoscaling, observability (Prometheus/Grafana, Sentry), load testing to the 10k-concurrent target.

## Multi-sport (post-cricket)
- Implement additional `ScoringEngine` strategies (football, kabaddi, volleyball, basketball) behind the existing interface; teams/players/tournaments/venues already sport-agnostic.
