# API Reference — LocalScore (v1)

Base URL: `/api/v1`. Interactive docs are served at `/docs` (Swagger) and `/redoc`.
All request/response bodies are JSON. Times are ISO-8601 UTC.

## Authentication

JWT bearer tokens. Obtain a token via `/auth/login`, then send
`Authorization: Bearer <access_token>` on protected calls. Public read endpoints
need no token.

| Role          | Capability                                                        |
|---------------|-------------------------------------------------------------------|
| *(none)*      | All `/public/*` reads, list teams/players/matches/tournaments     |
| `MATCH_ADMIN` | Create teams/players/matches/tournaments; score **assigned** matches |
| `SUPER_ADMIN` | Everything + approve tournaments + manage users/roles             |

### Auth endpoints
| Method | Path                | Auth | Body                                  | Notes |
|--------|---------------------|------|---------------------------------------|-------|
| POST   | `/auth/register`    | —    | `{email, password, full_name}`        | Always creates a `PUBLIC` user |
| POST   | `/auth/login`       | —    | `{email, password}`                   | → `{access_token, refresh_token}` |
| POST   | `/auth/refresh`     | —    | `{refresh_token}`                     | New token pair |
| GET    | `/auth/me`          | ✓    | —                                     | Current user |

## Teams & players
| Method | Path                          | Auth   | Notes |
|--------|-------------------------------|--------|-------|
| GET    | `/teams?city=`                | —      | List teams |
| GET    | `/teams/{id}`                 | —      | Team + roster |
| POST   | `/teams`                      | admin  | `{name, city?, coach?, logo_url?}` |
| PATCH  | `/teams/{id}`                 | admin  | Partial update (incl. `captain_id`) |
| GET    | `/teams/{id}/players`         | —      | Roster |
| POST   | `/teams/{id}/players`         | admin  | Add player |
| PATCH  | `/teams/players/{player_id}`  | admin  | Update player |

## Venues & tournaments
| Method | Path                                  | Auth        | Notes |
|--------|---------------------------------------|-------------|-------|
| GET    | `/venues`                             | —           | |
| POST   | `/venues`                             | admin       | |
| GET    | `/tournaments`                        | —           | |
| POST   | `/tournaments`                        | admin       | `{name, format, start_date?, end_date?, team_ids[]}` |
| POST   | `/tournaments/{id}/approve`           | super admin | |
| GET    | `/tournaments/{id}/standings`         | —           | Points table |

## Matches
| Method | Path                          | Auth  | Notes |
|--------|-------------------------------|-------|-------|
| GET    | `/matches?status_filter=LIVE` | —     | List matches |
| GET    | `/matches/{id}`               | —     | Match detail |
| POST   | `/matches`                    | admin | `{team_a_id, team_b_id, venue_id?, overs_limit, admin_ids[]}` — creator auto-assigned |
| POST   | `/matches/{id}/toss`          | admin* | `{toss_winner_id, decision: BAT\|BOWL}` |
| POST   | `/matches/{id}/innings`       | admin* | `{batting_team_id, bowling_team_id}` — opens innings, sets target on 2nd |

`*` = must be **assigned** to that match (super admin bypasses).

## Scoring (assigned admins)
| Method | Path                                  | Notes |
|--------|---------------------------------------|-------|
| POST   | `/matches/{id}/scoring/ball`          | Record a delivery — see body below |
| POST   | `/matches/{id}/scoring/undo`          | Reverse the last delivery |
| POST   | `/matches/{id}/scoring/result`        | `{winner_team_id?, result_text}` → marks COMPLETED |

**Ball body:**
```json
{
  "striker_id": 1, "non_striker_id": 2, "bowler_id": 12,
  "runs_batsman": 4,
  "extra_type": "NONE",          // NONE|WIDE|NO_BALL|BYE|LEG_BYE
  "extra_runs": 0,
  "is_wicket": false,
  "wicket_type": "NONE",         // NONE|BOWLED|CAUGHT|LBW|RUN_OUT|STUMPED|HIT_WICKET|RETIRED_HURT
  "dismissed_player_id": null,
  "fielder_id": null,
  "commentary": null             // omitted → auto-generated
}
```
Run conventions: `extra_runs` is the full extra contribution **excluding** the
automatic 1-run penalty for wides/no-balls (the engine adds that). Response
includes `{ball_id, innings_closed, over_completed, live_score}`.

## Public reads (no auth)
| Method | Path                                        | Notes |
|--------|---------------------------------------------|-------|
| GET    | `/public/dashboard`                         | `{live[], upcoming[], recent[]}` |
| GET    | `/public/matches/{id}/live`                 | Live score (runs/wkts/overs/CRR/RRR per innings) |
| GET    | `/public/matches/{id}/scorecard`            | Full batting + bowling cards |
| GET    | `/public/matches/{id}/commentary?limit=50`  | Ball-by-ball commentary feed |
| GET    | `/public/matches/{id}/prediction`           | AI win-probability (degrades gracefully) |

## Super admin
| Method | Path                              | Notes |
|--------|-----------------------------------|-------|
| GET    | `/admin/users`                    | List users |
| PATCH  | `/admin/users/{id}/role`          | `{role}` — promote to MATCH_ADMIN / SUPER_ADMIN |
| PATCH  | `/admin/users/{id}/active`        | `{is_active}` — enable/disable |

## WebSocket (Socket.IO)

Connect to the same origin at path `/socket.io` (no auth required for viewing).

**Client → server**
- `subscribe_match` `{match_id}` — join the match room
- `unsubscribe_match` `{match_id}` — leave

**Server → client** (emitted to room `match:{id}`)
- `score_update` — the same payload as `/public/matches/{id}/live`
- `commentary` — `{match_id, over, ball, text, is_wicket}`
- `match_status` — `{match_id, status, result?}`

Example (JS):
```js
import { io } from "socket.io-client";
const socket = io("http://localhost:8000", { path: "/socket.io" });
socket.emit("subscribe_match", { match_id: 1 });
socket.on("score_update", (s) => console.log(s.innings));
socket.on("commentary", (c) => console.log(c.text));
```

## Errors
Standard HTTP status codes. Body: `{"detail": "..."}`. Common: `401`
(missing/invalid token), `403` (wrong role or not assigned to match), `404`
(not found), `400` (validation / illegal scoring state), `409` (duplicate email).
