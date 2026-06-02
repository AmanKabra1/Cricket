"""Tournament engine: fixture generation + points-table & NRR recomputation."""
from __future__ import annotations

import pytest

from app.models.enums import MatchStatus, TournamentFormat
from app.models.innings import Innings
from app.models.match import Match
from app.models.team import Team
from app.models.tournament import Tournament, TournamentTeam
from app.services.tournament_engine import generate_fixtures, recompute_standings

pytestmark = pytest.mark.asyncio


async def _teams(db, n):
    teams = [Team(name=f"T{i}") for i in range(n)]
    db.add_all(teams)
    await db.flush()
    return teams


async def test_round_robin_fixtures(db):
    teams = await _teams(db, 4)
    t = Tournament(name="League", format=TournamentFormat.ROUND_ROBIN)
    t.standings = [TournamentTeam(team_id=tm.id) for tm in teams]
    db.add(t)
    await db.flush()

    matches = await generate_fixtures(db, t)
    # 4 teams, single round-robin → C(4,2) = 6 matches
    assert len(matches) == 6
    assert all(m.status == MatchStatus.SCHEDULED for m in matches)

    # Re-generating must be rejected.
    with pytest.raises(ValueError):
        await generate_fixtures(db, t)


async def test_all_formats_generate_fixtures(db):
    # League / Round-robin / Group stage → single round-robin C(n,2).
    for fmt in (TournamentFormat.LEAGUE, TournamentFormat.ROUND_ROBIN, TournamentFormat.GROUP_STAGE):
        teams = await _teams(db, 4)
        t = Tournament(name=f"{fmt.value}", format=fmt)
        t.standings = [TournamentTeam(team_id=tm.id) for tm in teams]
        db.add(t)
        await db.flush()
        matches = await generate_fixtures(db, t)
        assert len(matches) == 6, fmt

    # Knockout → first-round bracket: floor(n/2) matches.
    teams = await _teams(db, 4)
    k = Tournament(name="Cup", format=TournamentFormat.KNOCKOUT)
    k.standings = [TournamentTeam(team_id=tm.id) for tm in teams]
    db.add(k)
    await db.flush()
    matches = await generate_fixtures(db, k)
    assert len(matches) == 2


async def test_fixtures_scheduled_across_days(db):
    from datetime import datetime

    teams = await _teams(db, 4)  # 6 round-robin matches
    t = Tournament(name="Sched", format=TournamentFormat.LEAGUE)
    t.standings = [TournamentTeam(team_id=tm.id) for tm in teams]
    db.add(t)
    await db.flush()
    start = datetime(2026, 6, 10, 10, 0)
    matches = await generate_fixtures(
        db, t, start_at=start, interval_minutes=180, matches_per_day=2
    )
    # 2 per day → match 0,1 on day 0; 2,3 on day 1; 4,5 on day 2.
    assert matches[0].scheduled_at == datetime(2026, 6, 10, 10, 0)
    assert matches[1].scheduled_at == datetime(2026, 6, 10, 13, 0)
    assert matches[2].scheduled_at == datetime(2026, 6, 11, 10, 0)
    assert matches[4].scheduled_at == datetime(2026, 6, 12, 10, 0)


async def test_standings_and_nrr(db):
    a, b = await _teams(db, 2)
    t = Tournament(name="Mini", format=TournamentFormat.LEAGUE)
    t.standings = [TournamentTeam(team_id=a.id), TournamentTeam(team_id=b.id)]
    db.add(t)
    await db.flush()

    match = Match(
        tournament_id=t.id,
        team_a_id=a.id,
        team_b_id=b.id,
        overs_limit=20,
        status=MatchStatus.COMPLETED,
        winner_team_id=a.id,
    )
    db.add(match)
    await db.flush()
    # A bats: 150 in full 20 overs (120 legal balls)
    db.add(Innings(match_id=match.id, innings_number=1, batting_team_id=a.id,
                   bowling_team_id=b.id, total_runs=150, legal_balls=120))
    # B bats: 140 all out (wickets=10 → counts as full 20 overs for NRR)
    db.add(Innings(match_id=match.id, innings_number=2, batting_team_id=b.id,
                   bowling_team_id=a.id, total_runs=140, total_wickets=10, legal_balls=95))
    await db.flush()

    await recompute_standings(db, t.id)

    rows = {r.team_id: r for r in t.standings}
    assert rows[a.id].played == 1 and rows[a.id].won == 1 and rows[a.id].points == 2
    assert rows[b.id].played == 1 and rows[b.id].lost == 1 and rows[b.id].points == 0
    # NRR(A) = 150/20 - 140/20 = +0.5 ; NRR(B) = -0.5
    assert rows[a.id].net_run_rate == 0.5
    assert rows[b.id].net_run_rate == -0.5
