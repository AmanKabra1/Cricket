"""Build live-score and full scorecard views from persisted state.

Auto-calculates current run rate (CRR), required run rate (RRR), strike rate,
and economy — the derived numbers spectators expect.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.innings import Innings
from app.models.match import Match
from app.models.player import Player
from app.models.stats import PlayerMatchStats


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
    return {
        "match_id": match.id,
        "status": match.status,
        "overs_limit": match.overs_limit,
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
                "runs": s.runs_scored,
                "balls": s.balls_faced,
                "fours": s.fours,
                "sixes": s.sixes,
                "strike_rate": s.strike_rate,
                "is_out": s.is_out,
            }
            for s in stats
            if s.team_id == inn.batting_team_id and s.balls_faced > 0
        ]
        bowling = [
            {
                "player_id": s.player_id,
                "name": players[s.player_id].name if s.player_id in players else "—",
                "overs": f"{s.legal_balls_bowled // 6}.{s.legal_balls_bowled % 6}",
                "runs_conceded": s.runs_conceded,
                "wickets": s.wickets,
                "economy": s.economy,
            }
            for s in stats
            if s.team_id == inn.bowling_team_id and s.legal_balls_bowled > 0
        ]
        card = innings_score(inn, match.overs_limit)
        card["batting"] = sorted(batting, key=lambda b: b["player_id"])
        card["bowling"] = sorted(bowling, key=lambda b: b["player_id"])
        innings_cards.append(card)

    return {"match_id": match.id, "status": match.status, "innings": innings_cards}
