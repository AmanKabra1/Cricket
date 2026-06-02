"""Time-based match lifecycle helpers.

A match is created SCHEDULED and only flips to LIVE when an admin starts the
first innings. These helpers let the dashboard (and the maintenance loop) treat
time as a signal too:

  • once its start time arrives, a scheduled match is shown in the LIVE section
    ("starting now") even before the first ball — so spectators know it's on;
  • if its whole expected window passes with NO ball ever scored, it's a no-show
    and gets retired to the recent/older list (auto-marked ABANDONED), instead of
    sitting in "Live" or "Upcoming" forever;
  • a match that IS being scored stays LIVE regardless of the clock — time never
    moves a real, in-progress game.

scheduled_at is stored as the picked wall-clock time (no UTC conversion), so we
compare it against "now" in settings.APP_TIMEZONE.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.core.config import settings
from app.models.enums import MatchStatus
from app.models.match import Match


def local_now() -> datetime:
    """Current naive wall-clock time in the app's configured timezone."""
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).replace(tzinfo=None)
    except Exception:  # noqa: BLE001 — bad tz name / no tzdata → fall back to UTC
        return datetime.utcnow()


def innings_break_minutes(overs: int) -> int:
    base = settings.MATCH_INNINGS_BREAK_MINUTES
    return base if overs <= 20 else base * 2


def expected_play_minutes(overs: int) -> float:
    """Rough total playing time for both innings, BCCI-style pacing."""
    return overs * settings.MATCH_MINUTES_PER_OVER * 2 + innings_break_minutes(overs)


def noshow_deadline(match: Match) -> datetime | None:
    """After this moment, an un-scored scheduled match is considered a no-show."""
    if not match.scheduled_at:
        return None
    minutes = expected_play_minutes(match.overs_limit) + settings.MATCH_NOSHOW_GRACE_MINUTES
    return match.scheduled_at + timedelta(minutes=minutes)


def has_started(match: Match) -> bool:
    """True once a match is actually under way (any ball / non-scheduled status)."""
    return match.status in (
        MatchStatus.LIVE,
        MatchStatus.INNINGS_BREAK,
        MatchStatus.COMPLETED,
    ) or bool(match.innings)


def is_due_live(match: Match, now: datetime | None = None) -> bool:
    """A scheduled match whose start time has arrived but window hasn't elapsed."""
    if match.status != MatchStatus.SCHEDULED or not match.scheduled_at:
        return False
    now = now or local_now()
    deadline = noshow_deadline(match)
    return match.scheduled_at <= now and (deadline is None or now < deadline)


def is_noshow(match: Match, now: datetime | None = None) -> bool:
    """A scheduled match that never started and whose whole window has elapsed."""
    if match.status != MatchStatus.SCHEDULED or not match.scheduled_at:
        return False
    now = now or local_now()
    deadline = noshow_deadline(match)
    return deadline is not None and now >= deadline
