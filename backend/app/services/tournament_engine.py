"""Tournament engine: fixture generation and standings (points table + NRR).

Standings are recomputed from all completed tournament matches rather than
incrementally adjusted — this keeps the table correct even after a result is
edited or a ball is undone, at negligible cost for local-tournament sizes.

Points: win = 2, tie / no-result = 1, loss = 0 (standard local-league scoring).
Net run rate = (runs scored / overs faced) − (runs conceded / overs bowled),
where a side bowled out counts the full over quota (per NRR convention).
"""
from __future__ import annotations

from datetime import datetime, timedelta
from itertools import combinations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import MatchStatus, TournamentFormat, TournamentStatus
from app.models.match import Match
from app.models.tournament import Tournament, TournamentTeam
from app.models.user import User

WIN_POINTS = 2
DRAW_POINTS = 1


async def generate_fixtures(
    db: AsyncSession,
    tournament: Tournament,
    *,
    overs_limit: int = 20,
    venue_id: int | None = None,
    start_at: datetime | None = None,
    interval_minutes: int = 180,
    matches_per_day: int = 2,
) -> list[Match]:
    """Create SCHEDULED matches for the tournament's participating teams.

    Each match inherits overs_limit + venue_id. If a start time is given, matches
    are laid out across match-days: up to `matches_per_day` per day spaced by
    `interval_minutes` from the daily start time, then the next day resumes at the
    same time — so a big tournament spans several days instead of running overnight.
    """
    team_ids = [s.team_id for s in tournament.standings]
    if len(team_ids) < 2:
        raise ValueError("Tournament needs at least two teams to generate fixtures")

    existing = await db.scalar(
        select(Match.id).where(Match.tournament_id == tournament.id).limit(1)
    )
    if existing:
        raise ValueError("Fixtures already generated for this tournament")

    pairings: list[tuple[int, int]] = []
    fmt = tournament.format
    if fmt in (TournamentFormat.LEAGUE, TournamentFormat.ROUND_ROBIN, TournamentFormat.GROUP_STAGE):
        # Single round-robin: every team plays every other once.
        pairings = list(combinations(team_ids, 2))
    elif fmt == TournamentFormat.KNOCKOUT:
        # First-round bracket; later rounds are created as results come in.
        pairings = [
            (team_ids[i], team_ids[i + 1]) for i in range(0, len(team_ids) - 1, 2)
        ]

    # Fixtures are public only once the tournament has been approved.
    approved = tournament.status in (
        TournamentStatus.APPROVED,
        TournamentStatus.ONGOING,
        TournamentStatus.COMPLETED,
    )
    # The tournament's creator is auto-assigned to score its matches, so once a
    # super admin approves the tournament that admin can score without being
    # added to each match by hand.
    creator = await db.get(User, tournament.created_by) if tournament.created_by else None

    created: list[Match] = []
    for i, (a, b) in enumerate(pairings):
        scheduled_at = None
        if start_at:
            day = i // matches_per_day  # which match-day
            slot = i % matches_per_day  # position within that day
            scheduled_at = start_at + timedelta(days=day, minutes=interval_minutes * slot)
        match = Match(
            tournament_id=tournament.id,
            team_a_id=a,
            team_b_id=b,
            venue_id=venue_id,
            scheduled_at=scheduled_at,
            overs_limit=overs_limit,
            status=MatchStatus.SCHEDULED,
            approved=approved,
        )
        if creator:
            match.admins = [creator]
        db.add(match)
        created.append(match)
    await db.flush()
    return created


def _innings_runs_overs(inn, overs_limit: int) -> tuple[int, float]:
    """Runs scored and overs faced for NRR (all-out → full quota)."""
    overs = overs_limit if inn.total_wickets >= 10 else inn.legal_balls / 6
    return inn.total_runs, overs or 0.0


async def recompute_standings(db: AsyncSession, tournament_id: int) -> None:
    # The session uses autoflush=False, so pending changes (e.g. a match just
    # marked COMPLETED with its winner) aren't visible to the queries below until
    # we flush — without this the table is recomputed from stale data.
    await db.flush()

    rows = (
        await db.scalars(
            select(TournamentTeam).where(TournamentTeam.tournament_id == tournament_id)
        )
    ).all()
    by_team = {r.team_id: r for r in rows}
    # Reset, and track cumulative for/against for NRR.
    agg = {tid: {"rf": 0.0, "of": 0.0, "ra": 0.0, "oa": 0.0} for tid in by_team}
    for r in rows:
        r.played = r.won = r.lost = r.tied = r.no_result = r.points = 0
        r.net_run_rate = 0.0

    matches = (
        await db.scalars(
            select(Match).where(
                Match.tournament_id == tournament_id,
                Match.status == MatchStatus.COMPLETED,
            )
        )
    ).all()

    for m in matches:
        if m.team_a_id not in by_team or m.team_b_id not in by_team:
            continue
        by_team[m.team_a_id].played += 1
        by_team[m.team_b_id].played += 1

        # NRR accumulation from the two innings.
        for inn in m.innings:
            runs, overs = _innings_runs_overs(inn, m.overs_limit)
            batting, bowling = inn.batting_team_id, inn.bowling_team_id
            if batting in agg:
                agg[batting]["rf"] += runs
                agg[batting]["of"] += overs
            if bowling in agg:
                agg[bowling]["ra"] += runs
                agg[bowling]["oa"] += overs

        # Result → points.
        if m.winner_team_id and m.winner_team_id in by_team:
            loser = m.team_b_id if m.winner_team_id == m.team_a_id else m.team_a_id
            by_team[m.winner_team_id].won += 1
            by_team[m.winner_team_id].points += WIN_POINTS
            if loser in by_team:
                by_team[loser].lost += 1
        else:
            # No winner recorded → treat as tie/no-result, a point each.
            for tid in (m.team_a_id, m.team_b_id):
                by_team[tid].tied += 1
                by_team[tid].points += DRAW_POINTS

    for tid, r in by_team.items():
        a = agg[tid]
        for_rate = a["rf"] / a["of"] if a["of"] else 0.0
        against_rate = a["ra"] / a["oa"] if a["oa"] else 0.0
        r.net_run_rate = round(for_rate - against_rate, 3)

    await db.flush()


async def apply_match_result(db: AsyncSession, match: Match) -> None:
    """Hook called when a match is completed; refreshes its tournament table."""
    if match.tournament_id:
        await recompute_standings(db, match.tournament_id)
