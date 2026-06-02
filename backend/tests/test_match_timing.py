"""Time-based match bucketing: due-live, no-show, and never-move-while-scoring."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.models.enums import MatchStatus
from app.models.match import Match
from app.services.match_timing import (
    expected_play_minutes,
    is_due_live,
    is_noshow,
    noshow_deadline,
)


def _match(**kw) -> Match:
    base = dict(
        team_a_id=1,
        team_b_id=2,
        overs_limit=20,
        status=MatchStatus.SCHEDULED,
        scheduled_at=datetime(2026, 6, 2, 9, 0),
    )
    base.update(kw)
    return Match(**base)


def test_expected_play_grows_with_overs():
    assert expected_play_minutes(20) < expected_play_minutes(50)


def test_scheduled_before_start_is_neither():
    m = _match()
    before = m.scheduled_at - timedelta(minutes=5)
    assert not is_due_live(m, before)
    assert not is_noshow(m, before)


def test_scheduled_at_start_is_due_live():
    m = _match()
    assert is_due_live(m, m.scheduled_at + timedelta(minutes=1))
    assert not is_noshow(m, m.scheduled_at + timedelta(minutes=1))


def test_past_full_window_is_noshow():
    m = _match()
    after = noshow_deadline(m) + timedelta(minutes=1)
    assert is_noshow(m, after)
    assert not is_due_live(m, after)


def test_live_match_is_never_due_or_noshow():
    # A match that's actually being scored stays put regardless of the clock.
    m = _match(status=MatchStatus.LIVE)
    way_later = m.scheduled_at + timedelta(days=2)
    assert not is_due_live(m, way_later)
    assert not is_noshow(m, way_later)


def test_no_scheduled_time_is_inert():
    m = _match(scheduled_at=None)
    assert not is_due_live(m)
    assert not is_noshow(m)
