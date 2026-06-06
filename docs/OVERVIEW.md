# LocalScore — Overview (what's built)

A one-page description of the whole product as it stands today. For how to run it
see [CURRENT_STATE.md](CURRENT_STATE.md); for the code tour see
[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

## What it is
A free-tier, **real-time cricket live-scoring platform** for local tournaments and
grounds (CricHeroes / Cricbuzz-style, built for community sport). Admins create
teams and schedule/score matches ball-by-ball; spectators watch live on **web** and
a **mobile app**, with scorecards, charts, AI predictions, stats, leaderboards and
push notifications. The core (teams/tournaments/venues) is sport-agnostic and ready
to extend beyond cricket.

## The four parts
| Component | Tech | Hosted on |
|---|---|---|
| **Backend** (REST + realtime + scoring engine) | FastAPI, async SQLAlchemy 2, Pydantic v2, Socket.IO, Alembic | Render |
| **Web** (spectator + admin) | React + TypeScript + Vite, Redux Toolkit, React Query, Tailwind, recharts | Vercel |
| **Mobile app** (spectator + scorer) | Expo SDK 54 / React Native, expo-router, React Query | EAS builds |
| **AI service** (win-probability) | FastAPI (separate microservice) | Render |
| Database | TiDB Cloud (MySQL) in prod; SQLite locally | TiDB Cloud |

---

## Features (all done)

**Accounts & roles** — JWT auth (access + refresh); three roles: **PUBLIC**
(spectator, no login), **MATCH_ADMIN** (scores their assigned matches),
**SUPER_ADMIN** (everything + approves tournaments, manages users/settings).

**Teams & players** — full CRUD; team logo, city, coach; **captain / vice-captain /
wicket-keeper**; players with **jersey number** (shown as `#N` badges everywhere),
batting style, flexible bowling style, role, age, photo. Teams sorted newest-first.

**Venues** — grounds with city / address / capacity.

**Tournaments** — formats **league / round-robin / knockout**; **auto-generated
fixtures** (overs, venue, schedule, matches-per-day); **standings with NRR**;
super-admin **approval** gate before fixtures; rename / delete; **knockout bracket
view** (round 1 = real fixtures, later rounds project the winners advancing).

**Matches** — create with two teams, venue, tournament, date/time, **overs capped at
50**; matches **auto-approve** (show immediately); **animated coin-toss**; creator
auto-assigned to score and assignees emailed.

**Scoring engine (web + app)** — ball-by-ball: runs, all **extras**
(wide/no-ball/bye/leg-bye with correct penalties), all **wicket types** including
**caught → pick the fielder** (credits the catch), **free hit**, **strike
rotation**, **undo**, run-out end selection, lock players mid-over, at-crease
restore, innings/target handling, and a **match-complete celebration**. The
authoritative score is returned instantly (no flicker).

**Live spectating** — live score (runs/wkts/overs/CRR/RRR + squad-based max
wickets), full **scorecard** (batting + bowling), **commentary** feed; realtime via
Socket.IO with a polling fallback.

**Analytics** — **Manhattan** (runs per over, tooltip "Over N — R runs · W wkt") and
a single **worm** comparing **both teams'** cumulative runs as separate lines.

**AI win-probability** — separate service returns win % + projected score + key
factors; **wickets-in-hand uses real squad size**; cached per score-state (one call
shared by all viewers); degrades gracefully ("warming up") if asleep.

**Player stats & awards** — career **batting / bowling / fielding** aggregates;
**leaderboards** (most runs, most wickets, **MVP** by all-round impact);
**per-tournament** leaderboards + **Tournament MVP**; **Player of the Match** on
completed matches. All names link to a player career screen.

**Engagement** — **push notifications** on match-live and result (tap → opens that
Match Centre); **follow a team/tournament** (per device) so notifications target
followers instead of everyone.

**Emails** (Brevo / Resend / SMTP) — admin **welcome**, **match-assignment**,
pre-match **reminder** — all with a **branded HTML** version + plain-text fallback.

**Admin tools** — manage users (create / role / active / delete), per-page
background images, **test-email** diagnostics, run housekeeping on demand, export AI
training data, image uploads (logos / photos).

**Reliability & ops** — `/health` (liveness) + `/ready` (DB-aware); **DSN-gated
Sentry** on web + backend; **GitHub Actions CI** (ruff + pytest + `alembic upgrade
head` + web/mobile typecheck); rate limiting; Redis-or-in-memory cache.

**Automatic housekeeping** — purges **completed matches > 7 days** and **stale
match-admin accounts > 15 days** (with their matches) to keep the free-tier DB
small, retires no-show matches, sends reminders. **Teams, players and venues are
never auto-deleted** (windows are configurable).

---

## Data model (tables)
`users`, `teams`, `players`, `venues`, `tournaments`, `tournament_teams`
(standings), `matches`, `match_admins` (assignment), `innings`, `balls`,
`player_match_stats` (denormalized per-player-per-match), `push_tokens`, `follows`,
`app_settings`. The `balls` table is the immutable source of truth;
`player_match_stats` is updated transactionally for fast scorecard / leaderboard
reads. Full diagram: [ER_DIAGRAM.md](ER_DIAGRAM.md).

## Deployment
Web → **Vercel** (auto-deploy on push); backend + AI → **Render** (Docker,
`render.yaml`, migrate-on-boot); DB → **TiDB Cloud**; app → **EAS** builds. CI runs
on every push. Details: [DEPLOYMENT_AND_SCALING.md](DEPLOYMENT_AND_SCALING.md).

## Not done / on hold
- **Play Store submission** — intentionally on hold (EAS builds work for testing).
- **App crash reporting** — `@sentry/react-native` removed (broke EAS builds);
  Sentry stays on web + backend.
- **Optional / future** ([NEXT_STEPS.md](NEXT_STEPS.md)): LLM commentary via Gemini,
  trained XGBoost win-probability model, shareable match cards, multi-instance scale
  hardening (Redis + Socket.IO adapter), offline scoring, multi-sport.
