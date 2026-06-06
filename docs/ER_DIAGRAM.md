# Entity-Relationship Model — LocalScore

Rendered with Mermaid (GitHub renders this natively). The SQLAlchemy models in
`backend/app/models/` are the source of truth; this diagram mirrors them.

```mermaid
erDiagram
    USERS ||--o{ MATCH_ADMINS : "assigned to"
    MATCHES ||--o{ MATCH_ADMINS : "managed by"
    USERS ||--o{ TEAMS : "creates"
    USERS ||--o{ TOURNAMENTS : "creates"

    VENUES ||--o{ MATCHES : "hosts"
    TOURNAMENTS ||--o{ MATCHES : "contains"
    TOURNAMENTS ||--o{ TOURNAMENT_TEAMS : "has standings"
    TEAMS ||--o{ TOURNAMENT_TEAMS : "participates"

    TEAMS ||--o{ PLAYERS : "rosters"
    TEAMS ||--o{ MATCHES : "team_a"
    TEAMS ||--o{ MATCHES : "team_b"

    MATCHES ||--o{ INNINGS : "has"
    INNINGS ||--o{ BALLS : "recorded as"
    MATCHES ||--o{ PLAYER_MATCH_STATS : "produces"
    PLAYERS ||--o{ PLAYER_MATCH_STATS : "performs in"
    PLAYERS ||--o{ BALLS : "striker/bowler"

    USERS ||--o{ MATCHES : "created_by"
    USERS ||--o{ VENUES : "created_by"
    USERS ||--o{ PUSH_TOKENS : "owns (nullable)"
    TEAMS ||--o{ FOLLOWS : "followed"
    TOURNAMENTS ||--o{ FOLLOWS : "followed"

    USERS {
        bigint id PK
        string email UK
        string hashed_password
        string full_name
        enum   role "PUBLIC|MATCH_ADMIN|SUPER_ADMIN"
        bool   is_active
        datetime created_at
    }

    MATCH_ADMINS {
        bigint match_id FK
        bigint user_id FK
    }

    VENUES {
        bigint id PK
        string name
        string city
        string address
        int    capacity
        bigint created_by_id FK "-> users.id"
    }

    TEAMS {
        bigint id PK
        string name
        string logo_url
        string city
        bigint captain_id FK "-> players.id"
        bigint vice_captain_id FK "-> players.id"
        bigint wicket_keeper_id FK "-> players.id"
        string coach
        bigint created_by FK "-> users.id"
        datetime created_at
    }

    PLAYERS {
        bigint id PK
        bigint team_id FK
        string name
        int    age
        enum   batting_style "RIGHT_HAND|LEFT_HAND"
        string bowling_style "flexible (FAST/MEDIUM/OFF_SPIN/… or None)"
        enum   role "BATSMAN|BOWLER|ALL_ROUNDER|WICKET_KEEPER"
        int    jersey_number
        string photo_url
    }

    TOURNAMENTS {
        bigint id PK
        string name
        enum   format "LEAGUE|KNOCKOUT|ROUND_ROBIN|GROUP_STAGE"
        enum   status "PENDING|APPROVED|ONGOING|COMPLETED|REJECTED"
        date   start_date
        date   end_date
        bigint created_by FK
        bigint approved_by FK
    }

    TOURNAMENT_TEAMS {
        bigint id PK
        bigint tournament_id FK
        bigint team_id FK
        int    played
        int    won
        int    lost
        int    tied
        int    no_result
        int    points
        float  net_run_rate
    }

    MATCHES {
        bigint id PK
        bigint tournament_id FK "nullable"
        string sport "cricket"
        bigint team_a_id FK
        bigint team_b_id FK
        bigint venue_id FK
        datetime scheduled_at
        int    overs_limit
        enum   status "SCHEDULED|LIVE|INNINGS_BREAK|COMPLETED|ABANDONED"
        bigint toss_winner_id FK "-> teams.id"
        enum   toss_decision "BAT|BOWL"
        bigint winner_team_id FK "-> teams.id"
        string result_text
        bool   approved "auto-true on create"
        bool   reminder_sent
        bigint created_by_id FK "-> users.id"
        datetime created_at
    }

    INNINGS {
        bigint id PK
        bigint match_id FK
        int    innings_number
        bigint batting_team_id FK
        bigint bowling_team_id FK
        int    total_runs
        int    total_wickets
        int    legal_balls "derive overs = balls/6"
        int    extras_wide
        int    extras_no_ball
        int    extras_bye
        int    extras_leg_bye
        int    target "nullable"
        bigint current_striker_id FK "at the crease"
        bigint current_non_striker_id FK "at the crease"
        bigint current_bowler_id FK "bowling now"
        bool   is_closed
    }

    BALLS {
        bigint id PK
        bigint innings_id FK
        int    over_number
        int    ball_in_over
        int    sequence "monotonic per innings"
        bigint striker_id FK
        bigint non_striker_id FK
        bigint bowler_id FK
        int    runs_batsman
        enum   extra_type "NONE|WIDE|NO_BALL|BYE|LEG_BYE"
        int    extra_runs
        bool   is_wicket
        enum   wicket_type "BOWLED|CAUGHT|LBW|RUN_OUT|STUMPED|HIT_WICKET|RETIRED_HURT"
        bigint dismissed_player_id FK
        bigint fielder_id FK
        bool   is_legal_delivery
        bool   is_free_hit
        string commentary
        datetime created_at
    }

    PLAYER_MATCH_STATS {
        bigint id PK
        bigint match_id FK
        bigint player_id FK
        bigint team_id FK
        int    runs_scored
        int    balls_faced
        int    fours
        int    sixes
        int    legal_balls_bowled
        int    runs_conceded
        int    wickets
        int    catches
        bool   is_out
    }

    PUSH_TOKENS {
        bigint id PK
        string token UK "Expo push token"
        bigint user_id FK "nullable (anon spectators)"
        datetime created_at
    }

    FOLLOWS {
        bigint id PK
        string token "device's Expo push token"
        bigint team_id FK "nullable"
        bigint tournament_id FK "nullable"
        datetime created_at
    }

    APP_SETTINGS {
        string key PK
        string value "JSON (e.g. per-page backgrounds)"
    }
```

## Notes on the model

- **`legal_balls` over `overs` float.** Overs are stored as an integer count of legal
  deliveries; the `overs` display string (`12.3`) is computed (`balls // 6` dot `balls % 6`).
  This avoids floating-point drift and makes run-rate math exact.
- **Extras are split by type** on the innings so the scorecard can show the
  `(b 4, lb 2, w 5, nb 1)` breakdown without re-scanning every ball.
- **`PLAYER_MATCH_STATS` is a denormalized aggregate** updated transactionally by the
  scoring engine on every ball. It powers fast scorecard and leaderboard reads without
  aggregating the `balls` table on each request. The `balls` table remains the immutable
  source of truth for replay, undo, and wagon-wheel/commentary tabs.
- **`captain_id` → players** is nullable and set after the roster exists (chicken-and-egg
  on team creation is resolved by a follow-up update).
- **Soft multi-sport:** `matches.sport` defaults to `cricket`; cricket tables
  (innings/balls) only populate for cricket matches.
- **Notifications & follows:** `PUSH_TOKENS` holds each device's Expo token;
  `FOLLOWS` ties a device token to a team/tournament so match-live/result pushes
  target followers. `APP_SETTINGS` is a small key/value store (e.g. per-page
  background images). `created_by`/`created_by_id` on teams/venues/matches record
  the authoring admin.
```
