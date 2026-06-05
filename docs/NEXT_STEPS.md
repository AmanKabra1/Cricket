# LocalScore — Next Steps & Phases

All six build phases (backend, web, AI service, mobile, DevOps) are complete and
deployed on free tiers. This document plans what comes next.

**Order: AI first, then finish the Mobile app, then polish.**
Why AI first — the AI Prediction tab is the only place still showing "coming
soon", the AI microservice is already built (heuristic win-probability + LLM
commentary with a template fallback) and just needs turning on, and it's the
biggest visible differentiator. The mobile app already works for spectators; its
remaining work is lower-risk and can follow.

---

## Free AI options (researched June 2026)

For the LLM parts (commentary, summaries, player insights) — all free, no card:

| Provider | Free tier | Best for |
|---|---|---|
| **Google Gemini (AI Studio)** | ~1,500 req/day, 1M context, multimodal | **Primary** — summaries, insights, commentary |
| **Groq** | very fast (~315 tok/s) | instant ball-by-ball commentary |
| **OpenRouter / Cerebras / SambaNova** | extra free models / throughput | fallbacks (route across to multiply limits) |

The **win-probability / projected-score** model is **not an API** — it's an
XGBoost/LightGBM model trained on our own `balls` data; it runs for free, and a
transparent cricket **heuristic** already works today with **zero keys**.

---

## Phase 7 — Turn AI on (mostly free, staged)

**Stage 7.1 — Ship the heuristic (no keys, ~½ day).**
- Deploy `ai-service` on Render free (already in `render.yaml`); set
  `AI_SERVICE_URL` on the backend.
- Flip the web **AI Prediction** tab from "coming soon" to the live
  win-probability + projected score (the heuristic needs no model/key).
- Verify the backend's graceful-degradation proxy still falls back if the AI
  service sleeps (free tier).

**Stage 7.2 — Free LLM commentary & summaries (~1 day).**
- Add a **Gemini** provider to `ai-service` (env `GEMINI_API_KEY`) alongside the
  existing OpenAI/template path; keep the deterministic template fallback.
- Use it for: auto ball-by-ball commentary, end-of-innings & match summaries,
  and short player "form" notes. Cache results in Redis (per ball / per innings)
  so we stay inside the free request budget.

**Stage 7.3 — Real trained model (~1–2 days).**
- Export historical `balls`/`matches` to a training set (`train/` already
  scaffolds this); train `models/win_probability.joblib`. The loader swaps it in
  automatically — no API change.
- Add a nightly retrain (GitHub Actions cron) + simple model versioning.

**Stage 7.4 — AI analytics insights (~1 day).**
- Momentum/“key moments” detection from the per-over data, "what-if" projection,
  and a natural-language match analysis on the Analytics tab (Gemini).

## Phase 8 — Mobile app to stores

- **Admin lightweight scoring** in the app (API client plumbing already exists).
- **Push notifications**: match starting, wicket, innings break, result (Expo
  push — free).
- **EAS build & submit**: Android (Play) first, then iOS; app icons/splash.
- Offline-friendly read caching for spectators on poor networks.

## Phase 9 — Player stats & leaderboards ✅ DONE

- Player **career aggregates** (batting/bowling/fielding) + screens (web + app).
- Global **leaderboards** (most runs / wickets).

## Phase 10 — Competition stats & awards ✅ DONE

- **Tournament-scoped leaderboards** (per-competition runs/wickets/MVP).
- **MVP** ranking by all-round impact (runs + 20·wkts + 10·catches) — global,
  per-tournament, and a **Tournament MVP** banner.
- **Player of the Match** on completed matches (web + app).
- API: `GET /public/tournaments/{id}/leaderboards`, `GET /public/matches/{id}/best`.

## Phase 11 — Reliability & observability (next)

- **Sentry** (free tier) for backend + web + app, structured logs, `/ready` probe.
- **Match-assignment email** ("you've been assigned to score X vs Y on {date}")
  in addition to the existing 3-hour reminder.

## Phase 12 — Engagement & notifications

- Push/email on match start, wicket clusters, result; **follow a team/tournament**.
- Knockout **bracket view**.

## Later

- Shareable match cards (image/OG) for social sharing.
- Load-test to the 10k-concurrent target; offline-friendly scoring (queue balls).
- Multi-sport: a second `ScoringEngine` (football/kabaddi) behind the existing
  interface (teams/tournaments/venues are already sport-agnostic).

---

## Immediate next action
**Phase 11** — wire Sentry (backend + web + app) and add the match-assignment
email. Then Phase 12 (notifications + bracket view).

> Note: Play Store deploy is intentionally **on hold**; everything else for
> go-live (web on Vercel, backend/AI on Render) is done.
