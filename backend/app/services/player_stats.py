"""Career player statistics + leaderboards, aggregated from per-match stats.

Reads the denormalized `player_match_stats` rows (one per player per match the
scoring engine touched) and rolls them up across all of a player's matches.
"""
from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.player import Player
from app.models.stats import PlayerMatchStats
from app.models.team import Team


def _bat(runs: int, balls: int, outs: int) -> dict:
    return {
        "average": round(runs / outs, 2) if outs else None,  # None = not out / N/A
        "strike_rate": round(runs / balls * 100, 2) if balls else 0.0,
    }


async def player_career(db: AsyncSession, player_id: int) -> dict | None:
    player = await db.get(Player, player_id)
    if not player:
        return None

    s = PlayerMatchStats
    row = (
        await db.execute(
            select(
                func.count(func.distinct(s.match_id)).label("matches"),
                func.coalesce(func.sum(s.runs_scored), 0).label("runs"),
                func.coalesce(func.sum(s.balls_faced), 0).label("balls"),
                func.coalesce(func.sum(s.fours), 0).label("fours"),
                func.coalesce(func.sum(s.sixes), 0).label("sixes"),
                func.coalesce(func.sum(case((s.is_out, 1), else_=0)), 0).label("outs"),
                func.coalesce(func.max(s.runs_scored), 0).label("hs"),
                func.coalesce(func.sum(case(((s.runs_scored >= 50) & (s.runs_scored < 100), 1), else_=0)), 0).label("fifties"),
                func.coalesce(func.sum(case((s.runs_scored >= 100, 1), else_=0)), 0).label("hundreds"),
                func.coalesce(func.sum(case(((s.balls_faced > 0) | (s.runs_scored > 0) | s.is_out, 1), else_=0)), 0).label("inns_bat"),
                func.coalesce(func.sum(s.legal_balls_bowled), 0).label("balls_bowled"),
                func.coalesce(func.sum(s.runs_conceded), 0).label("conceded"),
                func.coalesce(func.sum(s.wickets), 0).label("wickets"),
                func.coalesce(func.max(s.wickets), 0).label("best_wkts"),
                func.coalesce(func.sum(s.catches), 0).label("catches"),
            ).where(s.player_id == player_id)
        )
    ).one()

    overs = row.balls_bowled / 6
    batting = {
        "matches": row.matches,
        "innings": row.inns_bat,
        "runs": row.runs,
        "balls": row.balls,
        "high_score": row.hs,
        "not_outs": max(0, row.inns_bat - row.outs),
        "fours": row.fours,
        "sixes": row.sixes,
        "fifties": row.fifties,
        "hundreds": row.hundreds,
        **_bat(row.runs, row.balls, row.outs),
    }
    bowling = {
        "overs": f"{row.balls_bowled // 6}.{row.balls_bowled % 6}",
        "runs_conceded": row.conceded,
        "wickets": row.wickets,
        "best_wickets": row.best_wkts,
        "economy": round(row.conceded / overs, 2) if overs else 0.0,
        "average": round(row.conceded / row.wickets, 2) if row.wickets else None,
        "strike_rate": round(row.balls_bowled / row.wickets, 2) if row.wickets else None,
    }
    return {
        "player": {
            "id": player.id, "name": player.name, "team_id": player.team_id,
            "role": player.role.value, "batting_style": player.batting_style.value,
            "bowling_style": player.bowling_style, "photo_url": player.photo_url,
            "jersey_number": player.jersey_number,
        },
        "batting": batting,
        "bowling": bowling,
        "fielding": {"catches": row.catches},
    }


def _impact(s: type[PlayerMatchStats]):
    """A simple all-round impact score: runs + 20·wickets + 10·catches."""
    return s.runs_scored + 20 * s.wickets + 10 * s.catches


async def leaderboards(db: AsyncSession, limit: int = 10, tournament_id: int | None = None) -> dict:
    """Top run-scorers, wicket-takers and MVPs — overall or scoped to a tournament."""
    s = PlayerMatchStats
    name_cols = (Player.id, Player.name, Player.photo_url, Team.name.label("team_name"))

    async def _top(metric, having_gt: int):
        q = (
            select(*name_cols, func.coalesce(func.sum(metric), 0).label("value"),
                   func.count(func.distinct(s.match_id)).label("matches"))
            .join(Player, Player.id == s.player_id)
            .join(Team, Team.id == Player.team_id)
        )
        if tournament_id is not None:
            from app.models.match import Match
            q = q.join(Match, Match.id == s.match_id).where(Match.tournament_id == tournament_id)
        q = (
            q.group_by(Player.id, Player.name, Player.photo_url, Team.name)
            .having(func.coalesce(func.sum(metric), 0) > having_gt)
            .order_by(func.coalesce(func.sum(metric), 0).desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).all()
        return [
            {"player_id": r.id, "name": r.name, "photo_url": r.photo_url,
             "team_name": r.team_name, "value": int(r.value), "matches": r.matches}
            for r in rows
        ]

    return {
        "top_run_scorers": await _top(s.runs_scored, 0),
        "top_wicket_takers": await _top(s.wickets, 0),
        "mvps": await _top(_impact(s), 0),  # all-round impact ranking
    }


def _line(r) -> str:
    """A short performance line, e.g. '54 (32) & 2/18'."""
    bat = f"{r.runs} ({r.balls})" if (r.balls or r.runs) else ""
    bowl = f"{r.wickets}/{r.conceded}" if r.balls_bowled else ""
    return " & ".join(x for x in (bat, bowl) if x) or "—"


async def player_of_match(db: AsyncSession, match_id: int) -> dict | None:
    """Best all-round performer in a single match (by impact score)."""
    s = PlayerMatchStats
    row = (
        await db.execute(
            select(
                Player.id, Player.name, Player.photo_url, Team.name.label("team_name"),
                s.runs_scored.label("runs"), s.balls_faced.label("balls"),
                s.wickets.label("wickets"), s.runs_conceded.label("conceded"),
                s.legal_balls_bowled.label("balls_bowled"), s.catches.label("catches"),
                _impact(s).label("impact"),
            )
            .join(Player, Player.id == s.player_id)
            .join(Team, Team.id == Player.team_id)
            .where(s.match_id == match_id, _impact(s) > 0)
            .order_by(_impact(s).desc())
            .limit(1)
        )
    ).first()
    if not row:
        return None
    return {
        "player_id": row.id, "name": row.name, "photo_url": row.photo_url,
        "team_name": row.team_name, "line": _line(row), "impact": int(row.impact),
    }
