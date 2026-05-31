"""Heuristic-path tests — no ML libs or API key required."""
from __future__ import annotations

from app.models import best_player, win_probability
from app.schemas import (
    BestPlayerRequest,
    CommentaryRequest,
    InningsState,
    LiveScoreState,
    PlayerInsightRequest,
    PlayerStatLine,
)
from app.services import commentary, insights


def _state(**inn) -> LiveScoreState:
    defaults = dict(
        innings_number=2, batting_team_id=1, bowling_team_id=2,
        runs=0, wickets=0, overs="0.0", run_rate=0.0, is_closed=False,
    )
    defaults.update(inn)
    return LiveScoreState(match_id=1, overs_limit=20, innings=[InningsState(**defaults)])


def test_chase_cruising_favours_batting():
    # Needs 20 off 60 with 8 wickets — batting side should be heavy favourite.
    s = _state(runs=160, wickets=2, overs="10.0", run_rate=16.0,
               target=180, required_run_rate=2.0)
    wp = win_probability.predict(s)
    assert wp.model == "heuristic"
    assert wp.batting_win_probability > 0.8
    assert abs(wp.batting_win_probability + wp.bowling_win_probability - 1.0) < 1e-6


def test_chase_impossible_favours_bowling():
    # Needs 90 off 6 balls with 1 wicket — bowling side dominant.
    s = _state(runs=110, wickets=9, overs="19.0", run_rate=5.8,
               target=200, required_run_rate=90.0)
    wp = win_probability.predict(s)
    assert wp.bowling_win_probability > 0.8


def test_target_reached_is_certain():
    s = _state(runs=181, wickets=4, overs="18.2", run_rate=9.8,
               target=180, required_run_rate=0.0)
    wp = win_probability.predict(s)
    assert wp.batting_win_probability == 1.0


def test_first_innings_projects_score():
    s = _state(innings_number=1, runs=80, wickets=2, overs="10.0", run_rate=8.0, target=None)
    wp = win_probability.predict(s)
    assert wp.projected_score is not None and wp.projected_score > 80


def test_best_player_ranks_allrounder_top():
    req = BestPlayerRequest(players=[
        PlayerStatLine(player_id=1, name="Bat", runs=60, balls_faced=40, strike_rate=150),
        PlayerStatLine(player_id=2, name="Bowl", runs=5, balls_faced=4, strike_rate=125,
                       wickets=4, economy=5.0, catches=1),
    ])
    resp = best_player.rank(req)
    assert resp.best is not None
    assert resp.best.name == "Bowl"  # 4 wickets outweighs 60 runs in the index


def test_commentary_template_fallback():
    r = commentary.generate(CommentaryRequest(over=4, ball=2, runs=6, striker="A", bowler="B"))
    assert r.source == "template"
    assert "SIX" in r.text


def test_player_insight_hot_form():
    r = insights.generate(PlayerInsightRequest(
        name="X", recent_scores=[55, 70, 48], strike_rates=[140, 150, 135]))
    assert r.form in {"hot", "steady"}
    assert r.strengths
