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


async def leaderboards(db: AsyncSession, limit: int = 10) -> dict:
    s = PlayerMatchStats
    name_cols = (Player.id, Player.name, Player.photo_url, Team.name.label("team_name"))

    async def _top(metric, having_gt: int):
        rows = (
            await db.execute(
                select(*name_cols, func.coalesce(func.sum(metric), 0).label("value"),
                       func.count(func.distinct(s.match_id)).label("matches"))
                .join(Player, Player.id == s.player_id)
                .join(Team, Team.id == Player.team_id)
                .group_by(Player.id, Player.name, Player.photo_url, Team.name)
                .having(func.coalesce(func.sum(metric), 0) > having_gt)
                .order_by(func.coalesce(func.sum(metric), 0).desc())
                .limit(limit)
            )
        ).all()
        return [
            {"player_id": r.id, "name": r.name, "photo_url": r.photo_url,
             "team_name": r.team_name, "value": int(r.value), "matches": r.matches}
            for r in rows
        ]

    return {
        "top_run_scorers": await _top(s.runs_scored, 0),
        "top_wicket_takers": await _top(s.wickets, 0),
    }
