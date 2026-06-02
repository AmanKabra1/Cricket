"""Build live-score and full scorecard views from persisted state.

Auto-calculates current run rate (CRR), required run rate (RRR), strike rate,
and economy — the derived numbers spectators expect.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ball import Ball
from app.models.enums import ExtraType
from app.models.innings import Innings
from app.models.match import Match
from app.models.player import Player
from app.models.stats import PlayerMatchStats


async def _next_is_free_hit(db: AsyncSession, innings: Innings) -> bool:
    """Whether the NEXT delivery in this innings is a free hit (after a no-ball,
    persisting across further illegal deliveries until a legal ball is bowled)."""
    last = await db.scalar(
        select(Ball).where(Ball.innings_id == innings.id).order_by(Ball.sequence.desc()).limit(1)
    )
    if last is None:
        return False
    if last.extra_type == ExtraType.NO_BALL:
        return True
    return bool(last.is_free_hit and not last.is_legal_delivery)


def _run_rate(runs: int, legal_balls: int) -> float:
    overs = legal_balls / 6
    return round(runs / overs, 2) if overs else 0.0


def _required_run_rate(target: int, runs: int, legal_balls: int, overs_limit: int) -> float | None:
    if target is None:
        return None
    runs_needed = target - runs
    balls_left = overs_limit * 6 - legal_balls
    if balls_left <= 0 or runs_needed <= 0:
        return 0.0
    return round(runs_needed / (balls_left / 6), 2)


def innings_score(inn: Innings, overs_limit: int) -> dict:
    return {
        "innings_id": inn.id,
        "innings_number": inn.innings_number,
        "batting_team_id": inn.batting_team_id,
        "bowling_team_id": inn.bowling_team_id,
        "runs": inn.total_runs,
        "wickets": inn.total_wickets,
        "overs": inn.overs_str,
        "extras": inn.total_extras,
        "run_rate": _run_rate(inn.total_runs, inn.legal_balls),
        "target": inn.target,
        "required_run_rate": _required_run_rate(
            inn.target, inn.total_runs, inn.legal_balls, overs_limit
        ),
        "is_closed": inn.is_closed,
    }


async def build_live_score(db: AsyncSession, match: Match) -> dict:
    open_innings = next((i for i in match.innings if not i.is_closed), None)
    free_hit = await _next_is_free_hit(db, open_innings) if open_innings else False
    return {
        "match_id": match.id,
        "status": match.status,
        "overs_limit": match.overs_limit,
        "free_hit": free_hit,
        "innings": [innings_score(inn, match.overs_limit) for inn in match.innings],
    }


async def build_scorecard(db: AsyncSession, match: Match) -> dict:
    """Full batting + bowling cards per innings, joined with player names."""
    innings_cards = []
    for inn in match.innings:
        stats = (
            await db.scalars(
                select(PlayerMatchStats).where(PlayerMatchStats.match_id == match.id)
            )
        ).all()
        player_ids = {s.player_id for s in stats}
        players = {
            p.id: p
            for p in (
                await db.scalars(select(Player).where(Player.id.in_(player_ids or {0})))
            ).all()
        }

        batting = [
            {
                "player_id": s.player_id,
                "name": players[s.player_id].name if s.player_id in players else "—",
                "photo_url": players[s.player_id].photo_url if s.player_id in players else None,
                "runs": s.runs_scored,
                "balls": s.balls_faced,
                "fours": s.fours,
                "sixes": s.sixes,
                "strike_rate": s.strike_rate,
                "is_out": s.is_out,
            }
            for s in stats
            # Show a batter once they've been at the crease (faced a ball, scored,
            # or got out) — incl. a duck / run-out without facing.
            if s.team_id == inn.batting_team_id
            and (s.balls_faced > 0 or s.runs_scored > 0 or s.is_out)
        ]
        bowling = [
            {
                "player_id": s.player_id,
                "name": players[s.player_id].name if s.player_id in players else "—",
                "photo_url": players[s.player_id].photo_url if s.player_id in players else None,
                "overs": f"{s.legal_balls_bowled // 6}.{s.legal_balls_bowled % 6}",
                "runs_conceded": s.runs_conceded,
                "wickets": s.wickets,
                "economy": s.economy,
            }
            for s in stats
            if s.team_id == inn.bowling_team_id and s.legal_balls_bowled > 0
        ]
        # Ensure the current bowler appears even before completing a delivery.
        if inn.current_bowler_id and inn.current_bowler_id not in {b["player_id"] for b in bowling}:
            bp = players.get(inn.current_bowler_id) or await db.get(Player, inn.current_bowler_id)
            if bp and bp.team_id == inn.bowling_team_id:
                bowling.append(
                    {
                        "player_id": bp.id,
                        "name": bp.name,
                        "photo_url": bp.photo_url,
                        "overs": "0.0",
                        "runs_conceded": 0,
                        "wickets": 0,
                        "economy": 0.0,
                    }
                )

        # Ensure the two batters currently at the crease appear even if they
        # haven't faced a ball yet (shown 0* — standard cricket scorecard).
        shown = {b["player_id"] for b in batting}
        for pid in (inn.current_striker_id, inn.current_non_striker_id):
            if pid and pid not in shown:
                p = players.get(pid)
                if not p:
                    p = await db.get(Player, pid)
                if p and p.team_id == inn.batting_team_id:
                    batting.append(
                        {
                            "player_id": pid,
                            "name": p.name,
                            "photo_url": p.photo_url,
                            "runs": 0,
                            "balls": 0,
                            "fours": 0,
                            "sixes": 0,
                            "strike_rate": 0.0,
                            "is_out": False,
                        }
                    )
                    shown.add(pid)

        card = innings_score(inn, match.overs_limit)
        card["batting"] = sorted(batting, key=lambda b: b["player_id"])
        card["bowling"] = sorted(bowling, key=lambda b: b["player_id"])
        innings_cards.append(card)

    return {"match_id": match.id, "status": match.status, "innings": innings_cards}
