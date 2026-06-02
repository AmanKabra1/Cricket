"""Scoring-engine correctness: a full over with runs, extras, boundaries, wicket."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models.enums import ExtraType, WicketType
from app.models.innings import Innings
from app.models.match import Match
from app.models.player import Player
from app.models.stats import PlayerMatchStats
from app.models.team import Team
from app.services.scoring_engine import (
    ScoringError,
    finalize_match_result,
    record_ball,
    undo_last_ball,
)

pytestmark = pytest.mark.asyncio


async def test_finalize_result(db):
    a = Team(name="Alpha")
    b = Team(name="Beta")
    db.add_all([a, b])
    await db.flush()
    match = Match(team_a_id=a.id, team_b_id=b.id, overs_limit=20)
    match.team_a, match.team_b = a, b
    # Innings 1: Alpha 150; Innings 2: Beta chasing 151.
    match.innings = [
        Innings(innings_number=1, batting_team_id=a.id, bowling_team_id=b.id, total_runs=150),
        Innings(innings_number=2, batting_team_id=b.id, bowling_team_id=a.id,
                total_runs=151, total_wickets=6, target=151),
    ]
    finalize_match_result(match)
    assert match.winner_team_id == b.id
    assert match.result_text == "Beta won by 4 wickets"

    # Beta falls short → Alpha wins by runs.
    match.innings[1].total_runs = 140
    finalize_match_result(match)
    assert match.winner_team_id == a.id
    assert match.result_text == "Alpha won by 10 runs"

    # Equal scores → tie.
    match.innings[1].total_runs = 150
    finalize_match_result(match)
    assert match.winner_team_id is None
    assert match.result_text == "Match tied"


async def _setup(db):
    bat = Team(name="Bat XI")
    bowl = Team(name="Bowl XI")
    db.add_all([bat, bowl])
    await db.flush()
    striker = Player(team_id=bat.id, name="Striker")
    non_striker = Player(team_id=bat.id, name="Non-striker")
    bowler = Player(team_id=bowl.id, name="Bowler")
    keeper = Player(team_id=bowl.id, name="Keeper")
    db.add_all([striker, non_striker, bowler, keeper])
    await db.flush()
    match = Match(team_a_id=bat.id, team_b_id=bowl.id, overs_limit=20)
    db.add(match)
    await db.flush()
    innings = Innings(
        match_id=match.id,
        innings_number=1,
        batting_team_id=bat.id,
        bowling_team_id=bowl.id,
    )
    db.add(innings)
    await db.flush()
    return match, innings, striker, non_striker, bowler, keeper


async def _ball(db, match, innings, striker, non_striker, bowler, **kw):
    defaults = dict(
        runs_batsman=0,
        extra_type=ExtraType.NONE,
        extra_runs=0,
        is_wicket=False,
        wicket_type=WicketType.NONE,
        dismissed_player_id=None,
        fielder_id=None,
        commentary=None,
        overs_limit=20,
    )
    defaults.update(kw)
    return await record_ball(
        db,
        match_id=match.id,
        innings=innings,
        striker_id=striker.id,
        non_striker_id=non_striker.id,
        bowler_id=bowler.id,
        **defaults,
    )


async def test_full_over(db):
    match, innings, striker, non_striker, bowler, keeper = await _setup(db)

    await _ball(db, match, innings, striker, non_striker, bowler, runs_batsman=4)   # FOUR
    await _ball(db, match, innings, striker, non_striker, bowler, runs_batsman=6)   # SIX
    await _ball(db, match, innings, striker, non_striker, bowler, runs_batsman=1)   # single
    await _ball(db, match, innings, striker, non_striker, bowler,
                extra_type=ExtraType.WIDE, extra_runs=0)                            # wide (+1)
    await _ball(db, match, innings, striker, non_striker, bowler,
                extra_type=ExtraType.LEG_BYE, extra_runs=2)                         # 2 leg byes
    await _ball(db, match, innings, striker, non_striker, bowler, runs_batsman=0)   # dot
    out = await _ball(db, match, innings, striker, non_striker, bowler,
                      is_wicket=True, wicket_type=WicketType.CAUGHT,
                      dismissed_player_id=striker.id, fielder_id=keeper.id)         # caught

    # Total runs: 4 + 6 + 1 + 1(wide) + 2(leg bye) + 0 + 0 = 14
    assert innings.total_runs == 14
    # Legal deliveries: 6 (the wide doesn't count); over complete on the 6th legal ball
    assert innings.legal_balls == 6
    assert innings.total_wickets == 1
    assert innings.extras_wide == 1
    assert innings.extras_leg_bye == 2
    assert out.over_completed is True

    striker_stats = await db.scalar(
        select(PlayerMatchStats).where(PlayerMatchStats.player_id == striker.id)
    )
    # Batter: 4+6+1 = 11 off 5 balls faced (wide & leg-bye-faced rules):
    #   FOUR(faced) SIX(faced) single(faced) wide(not faced) legbye(faced) dot(faced) wicket(faced) = 6 faced
    assert striker_stats.runs_scored == 11
    assert striker_stats.balls_faced == 6
    assert striker_stats.fours == 1
    assert striker_stats.sixes == 1
    assert striker_stats.is_out is True

    bowler_stats = await db.scalar(
        select(PlayerMatchStats).where(PlayerMatchStats.player_id == bowler.id)
    )
    # Bowler concedes 4+6+1+1(wide) = 12 (leg byes not charged), 1 wicket (caught)
    assert bowler_stats.runs_conceded == 12
    assert bowler_stats.wickets == 1
    assert bowler_stats.legal_balls_bowled == 6

    keeper_stats = await db.scalar(
        select(PlayerMatchStats).where(PlayerMatchStats.player_id == keeper.id)
    )
    assert keeper_stats.catches == 1


async def test_no_ball_and_undo(db):
    match, innings, striker, non_striker, bowler, _ = await _setup(db)

    await _ball(db, match, innings, striker, non_striker, bowler,
                extra_type=ExtraType.NO_BALL, runs_batsman=4)
    # No-ball: 1 penalty + 4 off bat = 5 runs, 0 legal balls, batter +4 but no ball faced
    assert innings.total_runs == 5
    assert innings.legal_balls == 0
    assert innings.extras_no_ball == 1

    await _ball(db, match, innings, striker, non_striker, bowler, runs_batsman=2)
    assert innings.total_runs == 7
    assert innings.legal_balls == 1

    undone = await undo_last_ball(db, match.id, innings)
    assert undone is True
    assert innings.total_runs == 5
    assert innings.legal_balls == 0


async def test_free_hit_rules(db):
    match, innings, striker, non_striker, bowler, keeper = await _setup(db)
    # Add more batters so a single dismissal doesn't end the innings (all-out).
    db.add_all([Player(team_id=striker.team_id, name=f"Bat{i}") for i in range(3)])
    await db.flush()

    # No-ball → the NEXT delivery is a free hit.
    nb = await _ball(db, match, innings, striker, non_striker, bowler,
                     extra_type=ExtraType.NO_BALL, runs_batsman=0)
    assert nb.ball.is_free_hit is False  # the no-ball itself isn't the free hit

    # On the free hit the batter can't be bowled/caught etc. — only run out.
    with pytest.raises(ScoringError):
        await _ball(db, match, innings, striker, non_striker, bowler,
                    is_wicket=True, wicket_type=WicketType.BOWLED,
                    dismissed_player_id=striker.id)

    # A wide on the free hit keeps the NEXT delivery a free hit too.
    fh_wide = await _ball(db, match, innings, striker, non_striker, bowler,
                          extra_type=ExtraType.WIDE, extra_runs=0)
    assert fh_wide.ball.is_free_hit is True

    # Run out IS allowed on a free hit; this legal ball ends the free-hit period.
    ro = await _ball(db, match, innings, striker, non_striker, bowler,
                     is_wicket=True, wicket_type=WicketType.RUN_OUT,
                     dismissed_player_id=non_striker.id)
    assert ro.ball.is_free_hit is True
    assert innings.total_wickets == 1

    # The following delivery is no longer a free hit.
    after = await _ball(db, match, innings, striker, non_striker, bowler, runs_batsman=1)
    assert after.ball.is_free_hit is False
