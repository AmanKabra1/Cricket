"""Cricket scoring engine.

Pure-ish cricket rules layered over the ORM. Every delivery is applied inside a
single transaction by the caller; this module mutates the `Innings`, appends an
immutable `Ball`, and updates the denormalized `PlayerMatchStats` so reads stay
cheap. It also derives over/ball numbering, detects innings completion, and
produces fallback commentary.

Run conventions (the scorer supplies `extra_runs` as the FULL extra contribution
for that delivery, excluding the automatic 1-run penalty for wides/no-balls):

    NONE     legal ball; runs_batsman to bat & total; 1 ball faced
    WIDE     illegal; total += 1 + extra_runs (all to bowler & extras_wide)
    NO_BALL  illegal; total += 1 (penalty) + runs_batsman (off bat) + extra_runs (byes)
    BYE      legal ball; total += extra_runs to extras_bye (not charged to bowler)
    LEG_BYE  legal ball; total += extra_runs to extras_leg_bye (not charged to bowler)
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ball import Ball
from app.models.enums import ExtraType, WicketType
from app.models.innings import Innings
from app.models.player import Player
from app.models.stats import PlayerMatchStats

# Wicket types credited to the bowler.
_BOWLER_WICKETS = {
    WicketType.BOWLED,
    WicketType.CAUGHT,
    WicketType.LBW,
    WicketType.STUMPED,
    WicketType.HIT_WICKET,
}


class ScoringError(ValueError):
    """Raised when a delivery is illegal given the current match state."""


@dataclass
class BallOutcome:
    ball: Ball
    innings_closed: bool
    over_completed: bool


async def _stats_row(
    db: AsyncSession, match_id: int, player_id: int, team_id: int
) -> PlayerMatchStats:
    row = await db.scalar(
        select(PlayerMatchStats).where(
            PlayerMatchStats.match_id == match_id,
            PlayerMatchStats.player_id == player_id,
        )
    )
    if row is None:
        row = PlayerMatchStats(match_id=match_id, player_id=player_id, team_id=team_id)
        db.add(row)
        await db.flush()
    return row


def _auto_commentary(event_runs: int, ball: Ball, striker_name: str, bowler_name: str) -> str:
    if ball.is_wicket:
        return f"OUT! {striker_name} departs — {ball.wicket_type.value.replace('_', ' ').title()} off {bowler_name}."
    if ball.extra_type == ExtraType.WIDE:
        return f"Wide signalled. {ball.extra_runs + 1} extra run(s)."
    if ball.extra_type == ExtraType.NO_BALL:
        return f"No ball! Free hit pressure on {bowler_name}."
    if ball.runs_batsman == 6:
        return f"SIX! {striker_name} goes big off {bowler_name}."
    if ball.runs_batsman == 4:
        return f"FOUR! Beautifully struck by {striker_name}."
    if event_runs == 0:
        return f"Dot ball. {bowler_name} keeps it tight."
    return f"{event_runs} run(s) to {striker_name}."


async def record_ball(
    db: AsyncSession,
    *,
    match_id: int,
    innings: Innings,
    striker_id: int,
    non_striker_id: int,
    bowler_id: int,
    runs_batsman: int,
    extra_type: ExtraType,
    extra_runs: int,
    is_wicket: bool,
    wicket_type: WicketType,
    dismissed_player_id: int | None,
    fielder_id: int | None,
    commentary: str | None,
    overs_limit: int,
) -> BallOutcome:
    if innings.is_closed:
        raise ScoringError("Innings is already closed")

    is_legal = extra_type in (ExtraType.NONE, ExtraType.BYE, ExtraType.LEG_BYE)

    # --- numbering (based on current legal-ball count) ---
    over_number = innings.legal_balls // 6 + 1
    ball_in_over = innings.legal_balls % 6 + 1
    # Sequence from the DB (the in-memory collection won't reflect just-added balls).
    max_seq = await db.scalar(
        select(func.coalesce(func.max(Ball.sequence), 0)).where(
            Ball.innings_id == innings.id
        )
    )
    sequence = int(max_seq) + 1

    # --- run accounting ---
    total_delta = 0
    bowler_conceded = 0
    bat_runs = 0
    bat_ball_faced = 0

    if extra_type == ExtraType.NONE:
        bat_runs = runs_batsman
        bat_ball_faced = 1
        total_delta = runs_batsman
        bowler_conceded = runs_batsman
    elif extra_type == ExtraType.WIDE:
        wide_total = 1 + extra_runs
        total_delta = wide_total
        bowler_conceded = wide_total
        innings.extras_wide += wide_total
    elif extra_type == ExtraType.NO_BALL:
        bat_runs = runs_batsman  # off the bat, but not a ball faced
        total_delta = 1 + runs_batsman + extra_runs
        bowler_conceded = 1 + runs_batsman + extra_runs
        innings.extras_no_ball += 1 + extra_runs
    elif extra_type == ExtraType.BYE:
        bat_ball_faced = 1
        total_delta = extra_runs
        innings.extras_bye += extra_runs  # not charged to bowler
    elif extra_type == ExtraType.LEG_BYE:
        bat_ball_faced = 1
        total_delta = extra_runs
        innings.extras_leg_bye += extra_runs

    # --- apply to innings ---
    innings.total_runs += total_delta
    if is_legal:
        innings.legal_balls += 1
    if is_wicket and wicket_type != WicketType.RETIRED_HURT:
        innings.total_wickets += 1

    # --- batter stats ---
    striker_stats = await _stats_row(db, match_id, striker_id, innings.batting_team_id)
    striker_stats.runs_scored += bat_runs
    striker_stats.balls_faced += bat_ball_faced
    if extra_type == ExtraType.NONE and runs_batsman == 4:
        striker_stats.fours += 1
    if extra_type == ExtraType.NONE and runs_batsman == 6:
        striker_stats.sixes += 1

    # --- bowler stats ---
    bowler_stats = await _stats_row(db, match_id, bowler_id, innings.bowling_team_id)
    bowler_stats.runs_conceded += bowler_conceded
    if is_legal:
        bowler_stats.legal_balls_bowled += 1
    if is_wicket and wicket_type in _BOWLER_WICKETS:
        bowler_stats.wickets += 1

    # --- dismissal & fielding ---
    if is_wicket and dismissed_player_id is not None:
        dismissed_team = (
            innings.batting_team_id
            if dismissed_player_id in (striker_id, non_striker_id)
            else innings.batting_team_id
        )
        dismissed_stats = await _stats_row(db, match_id, dismissed_player_id, dismissed_team)
        if wicket_type != WicketType.RETIRED_HURT:
            dismissed_stats.is_out = True
    if is_wicket and wicket_type == WicketType.CAUGHT and fielder_id is not None:
        fielder_stats = await _stats_row(db, match_id, fielder_id, innings.bowling_team_id)
        fielder_stats.catches += 1

    # --- persist the ball ---
    ball = Ball(
        innings_id=innings.id,
        sequence=sequence,
        over_number=over_number,
        ball_in_over=ball_in_over,
        striker_id=striker_id,
        non_striker_id=non_striker_id,
        bowler_id=bowler_id,
        runs_batsman=runs_batsman if extra_type in (ExtraType.NONE, ExtraType.NO_BALL) else 0,
        extra_type=extra_type,
        extra_runs=extra_runs,
        is_wicket=is_wicket,
        wicket_type=wicket_type,
        dismissed_player_id=dismissed_player_id,
        fielder_id=fielder_id,
        is_legal_delivery=is_legal,
    )

    if not commentary:
        striker = await db.get(Player, striker_id)
        bowler = await db.get(Player, bowler_id)
        commentary = _auto_commentary(
            total_delta,
            ball,
            striker.name if striker else "Batter",
            bowler.name if bowler else "Bowler",
        )
    ball.commentary = commentary
    db.add(ball)

    # --- completion checks ---
    over_completed = is_legal and innings.legal_balls % 6 == 0
    all_out = innings.total_wickets >= 10
    overs_done = innings.legal_balls >= overs_limit * 6
    target_chased = innings.target is not None and innings.total_runs >= innings.target

    innings_closed = all_out or overs_done or target_chased
    if innings_closed:
        innings.is_closed = True

    await db.flush()
    return BallOutcome(ball=ball, innings_closed=innings_closed, over_completed=over_completed)


async def undo_last_ball(db: AsyncSession, match_id: int, innings: Innings) -> bool:
    """Reverse the most recent delivery (scorer mis-entry). Returns False if none."""
    last = await db.scalar(
        select(Ball)
        .where(Ball.innings_id == innings.id)
        .order_by(Ball.sequence.desc())
        .limit(1)
    )
    if last is None:
        return False

    is_legal = last.is_legal_delivery
    # Reverse innings aggregates
    if last.extra_type == ExtraType.WIDE:
        wide_total = 1 + last.extra_runs
        innings.total_runs -= wide_total
        innings.extras_wide -= wide_total
    elif last.extra_type == ExtraType.NO_BALL:
        innings.total_runs -= 1 + last.runs_batsman + last.extra_runs
        innings.extras_no_ball -= 1 + last.extra_runs
    elif last.extra_type == ExtraType.BYE:
        innings.total_runs -= last.extra_runs
        innings.extras_bye -= last.extra_runs
    elif last.extra_type == ExtraType.LEG_BYE:
        innings.total_runs -= last.extra_runs
        innings.extras_leg_bye -= last.extra_runs
    else:
        innings.total_runs -= last.runs_batsman

    if is_legal:
        innings.legal_balls -= 1
    if last.is_wicket and last.wicket_type != WicketType.RETIRED_HURT:
        innings.total_wickets -= 1
    innings.is_closed = False

    # Reverse batter stats
    striker_stats = await _stats_row(db, match_id, last.striker_id, innings.batting_team_id)
    if last.extra_type in (ExtraType.NONE, ExtraType.NO_BALL):
        striker_stats.runs_scored -= last.runs_batsman
    if last.extra_type in (ExtraType.NONE, ExtraType.BYE, ExtraType.LEG_BYE):
        striker_stats.balls_faced -= 1
    if last.extra_type == ExtraType.NONE and last.runs_batsman == 4:
        striker_stats.fours -= 1
    if last.extra_type == ExtraType.NONE and last.runs_batsman == 6:
        striker_stats.sixes -= 1

    # Reverse bowler stats
    bowler_stats = await _stats_row(db, match_id, last.bowler_id, innings.bowling_team_id)
    if last.extra_type == ExtraType.WIDE:
        bowler_stats.runs_conceded -= 1 + last.extra_runs
    elif last.extra_type == ExtraType.NO_BALL:
        bowler_stats.runs_conceded -= 1 + last.runs_batsman + last.extra_runs
    elif last.extra_type == ExtraType.NONE:
        bowler_stats.runs_conceded -= last.runs_batsman
    if is_legal:
        bowler_stats.legal_balls_bowled -= 1
    if last.is_wicket and last.wicket_type in _BOWLER_WICKETS:
        bowler_stats.wickets -= 1

    if last.is_wicket and last.dismissed_player_id is not None:
        dismissed_stats = await _stats_row(
            db, match_id, last.dismissed_player_id, innings.batting_team_id
        )
        dismissed_stats.is_out = False
    if last.is_wicket and last.wicket_type == WicketType.CAUGHT and last.fielder_id is not None:
        fielder_stats = await _stats_row(db, match_id, last.fielder_id, innings.bowling_team_id)
        fielder_stats.catches = max(0, fielder_stats.catches - 1)

    await db.delete(last)
    await db.flush()
    return True
