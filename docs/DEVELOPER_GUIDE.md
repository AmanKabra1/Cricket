# LocalScore — Developer Guide (read this first)

A map of the codebase for someone reading it for the **first time**: what lives
where, and how a request flows from the URL down to the database and back.

LocalScore is a free-tier **live cricket scoring** platform. It has four parts,
each in its own top-level folder:

| Folder | What it is | Tech | Runs on |
|--------|-----------|------|---------|
| `backend/` | REST + realtime API + **AI** (the brain) | FastAPI, SQLAlchemy (async), Socket.IO; AI in `app/ai` | Hugging Face / Render |
| `web/` | Spectator + admin website | React + Vite + Redux + React Query + Tailwind | Vercel |
| `mobile/` | The app (spectator + scorer) | Expo / React Native, expo-router | EAS builds |
| `docs/` | These guides | Markdown | — |

The database is **TiDB Cloud** (MySQL-compatible). Locally you can use **SQLite**.

---

## 1. Backend — the most important folder

Path: `backend/app/`. This is a layered app. The golden rule:

> **Routers (controllers) handle HTTP. Services hold the logic. Models are the
> tables. Schemas validate in/out. Never put business logic in a router.**

```
backend/app/
  main.py            ← app startup: builds FastAPI, mounts Socket.IO, CORS,
                        background loops (maintenance + AI warmup), /health, /ready
  core/              ← cross-cutting infrastructure (no business logic)
    config.py        ←   ALL settings/env vars (one Settings class)
    database.py      ←   async engine + session factory + Base
    security.py      ←   password hashing, JWT create/decode
    cache.py         ←   Redis (or in-memory fallback) for hot reads
    ratelimit.py     ←   request rate limiting
  api/
    deps.py          ← reusable dependencies: DbSession, CurrentUser,
                        require_admin, require_super_admin  (auth/role gates)
    router.py        ← stitches all v1 routers under /api/v1
    v1/              ← THE CONTROLLERS — one file per resource
       auth.py          login / refresh / me
       teams.py         teams + players (CRUD)
       venues.py        grounds
       tournaments.py   tournaments, fixtures, standings, approval
       matches.py       create match, assign admins, toss, start innings
       scoring.py       record a ball, undo, at-crease  (the live engine entry)
       public.py        no-auth reads: dashboard, live, scorecard, analytics,
                        leaderboards, AI prediction proxy
       push.py          register device token, follow/unfollow team/tournament
       uploads.py       image upload (logos/photos)
       admin.py         super-admin: users, settings, test-email, training data
       maintenance.py   trigger housekeeping (also runs automatically)
  services/          ← THE LOGIC — pure-ish functions, no FastAPI here
       scoring_engine.py   apply a ball, extras/wickets/strike rotation,
                           finalize result, update PlayerMatchStats
       scoreboard.py       build the live score + full scorecard payloads
       tournament_engine.py generate fixtures, recompute standings (NRR)
       player_stats.py     career aggregates, leaderboards, player-of-match
       match_timing.py     "is it live yet / a no-show?" time logic
       push.py             send Expo push (broadcast / to followers)
       email.py            send email (Brevo/Resend/SMTP) + HTML templates
       storage.py          save images (local disk or S3/Cloudflare R2)
       maintenance.py      purge old matches, expire stale admins, reminders
       training_data.py    export labelled rows for the AI model
  models/            ← THE TABLES (SQLAlchemy ORM) — one file per table
       team.py player.py venue.py tournament.py match.py innings.py ball.py
       stats.py (PlayerMatchStats) user.py push.py follow.py setting.py
       enums.py (MatchStatus, UserRole, WicketType, …)
  schemas/           ← Pydantic request/response shapes (validation + JSON)
  realtime/
       socket.py        ← Socket.IO server; emits live score to spectators
  alembic/versions/  ← database migrations (schema history)
  tests/             ← pytest (unit + a smoke test)
```

### How one request flows (example: scoring a ball)

```
POST /api/v1/matches/42/scoring/ball   (web/app sends the delivery)
      │
      ▼
api/v1/scoring.py            ← CONTROLLER: validates body (schemas/match.py:BallEvent),
  (the route function)         checks auth via Depends(require_admin) from api/deps.py
      │  calls
      ▼
services/scoring_engine.py   ← LOGIC: updates the Ball/Innings, runs/extras/wickets,
                               rotates strike, credits PlayerMatchStats (e.g. a catch),
                               finalizes the result if the innings/match ended
      │  reads/writes via
      ▼
models/ (Ball, Innings, Match, PlayerMatchStats)  ← TABLES via the async session
      │  then
      ▼
services/scoreboard.py       ← builds the authoritative live-score dict
      │  controller then…
      ├─ writes it to core/cache.py            (so spectators' polls are instant)
      ├─ emits it via realtime/socket.py        (instant push to open clients)
      └─ returns JSON (shaped by schemas/) to the caller
```

The same pattern everywhere: **router → service → model → schema out**. If you're
adding a feature, find the matching router, add/extend a service, touch models
only for new columns (and write an Alembic migration), expose via a schema.

### Auth & roles
`core/security.py` issues JWTs. `api/deps.py` turns a token into a `CurrentUser`
and provides `require_admin` / `require_super_admin`. Three roles (in
`models/enums.py`): `PUBLIC`, `MATCH_ADMIN`, `SUPER_ADMIN`.

### Database changes
1. Edit/add a model in `models/`.
2. `cd backend && alembic revision -m "what changed"` then fill the `upgrade()`.
   (Or hand-write it, like the files already in `alembic/versions/`.)
3. `alembic upgrade head` locally to test. CI runs this on a fresh SQLite DB.
   ⚠️ Never query the live ORM model inside a data migration (columns may not
   exist yet at that point in history) — use raw SQL / a guard (see
   `a7b8c9d0e1f2_recompute_wicket_results.py`).

---

## 2. Web (`web/src/`)

```
main.tsx        ← entry: providers (Redux, React Query, Router, Theme), initSentry()
App.tsx         ← routes
pages/          ← one component per screen (Dashboard, MatchCenter, Scoring,
                  Teams, TeamDetail, Tournaments, TournamentDetail, Leaderboards,
                  PlayerDetail, Login; admin/ and matchcenter/ subfolders)
components/     ← reusable UI (MatchCard, Bracket, Spinner, …)
api/            ← hooks.ts (React Query reads) + admin.ts (mutations) + lib axios
hooks/          ← useTeamMap etc.
store/          ← Redux (auth slice)
theme/          ← light/dark theme context
types.ts        ← shared TS types mirroring the API
```
Data fetching is **React Query** hooks in `api/hooks.ts` (e.g. `useDashboard`,
`useLiveScore`, `usePostBall`). Components never call axios directly.

## 3. Mobile (`mobile/`)

Uses **expo-router** (file = route). `app/` is the route tree:
```
app/_layout.tsx        ← root providers + push registration
app/(tabs)/            ← bottom tabs: index(Home), teams, tournaments, stats, account
app/match/[id].tsx     ← Match Centre (live, scorecard, commentary, analytics, prediction)
app/score/[id].tsx     ← the SCORER (toss, ball-by-ball) — admins only
app/team/[id] · tournament/[id] · player/[id] · login · admin/*
src/api/    src/components/    src/hooks/    src/lib/ (api, pushToken)   theme.tsx
```
Same data layer idea as web (React Query). `src/lib/api.ts` is the axios client
+ token store. The app talks to the SAME backend as the web.

## 4. AI engine (`backend/app/ai/`) — in-process
No separate service. `features.py` turns a live score into features;
`win_probability.py` returns win prob + projected score + insight (heuristic by
default; optional trained model / Gemini LLM). Also `best_player`, `commentary`,
`summary`, `insights`. Exposed via `api/v1/public.py` (`/prediction`, cached) and
`api/v1/ai.py` (`/api/v1/ai/*`). Training pipeline: `app/ai/train/`.

---

## Where do I make a change?
- **New screen / UI** → `web/src/pages` or `mobile/app`.
- **New API endpoint** → add a route in `backend/app/api/v1/<resource>.py`, put
  logic in `backend/app/services/`, shape it with `backend/app/schemas/`.
- **New/changed table** → `backend/app/models/` + an Alembic migration.
- **New setting / secret** → `backend/app/core/config.py` (then set the env var).
- **Scoring rule** → `backend/app/services/scoring_engine.py`.

See `CURRENT_STATE.md` for how to run everything, and
`DEPLOYMENT_AND_SCALING.md` for deploy + scaling.
