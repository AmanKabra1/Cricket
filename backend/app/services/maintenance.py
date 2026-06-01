"""Housekeeping jobs: purge old data to keep the (free-tier) DB small, expire
stale admin accounts, and send pre-match reminder emails. Designed to be called
periodically (cron → maintenance endpoint) or by a super admin on demand.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ball import Ball
from app.models.enums import MatchStatus, UserRole
from app.models.innings import Innings
from app.models.match import Match
from app.models.stats import PlayerMatchStats
from app.models.user import User, match_admins
from app.services.email import match_reminder_body, send_email

logger = logging.getLogger("localscore.maintenance")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _delete_matches(db: AsyncSession, match_ids: list[int]) -> int:
    """Delete matches + all their data (balls, innings, stats, admin links).

    Uses set-based bulk DELETEs (a fixed handful of statements regardless of how
    many balls/innings exist) instead of ORM per-row cascade, so it stays fast
    over the network to TiDB. Order respects FKs: balls → innings → match.
    Behaves the same on SQLite and MySQL/TiDB.
    """
    if not match_ids:
        return 0
    innings_subq = select(Innings.id).where(Innings.match_id.in_(match_ids))
    await db.execute(delete(Ball).where(Ball.innings_id.in_(innings_subq)))
    await db.execute(delete(Innings).where(Innings.match_id.in_(match_ids)))
    await db.execute(delete(PlayerMatchStats).where(PlayerMatchStats.match_id.in_(match_ids)))
    await db.execute(delete(match_admins).where(match_admins.c.match_id.in_(match_ids)))
    result = await db.execute(delete(Match).where(Match.id.in_(match_ids)))
    return result.rowcount or len(match_ids)


async def purge_old_matches(db: AsyncSession) -> int:
    """Delete completed/abandoned matches older than the retention window."""
    cutoff = _now() - timedelta(days=settings.COMPLETED_MATCH_RETENTION_DAYS)
    ids = list(
        (
            await db.scalars(
                select(Match.id).where(
                    Match.status.in_([MatchStatus.COMPLETED, MatchStatus.ABANDONED]),
                    Match.updated_at < cutoff,
                )
            )
        ).all()
    )
    n = await _delete_matches(db, ids)
    if n:
        logger.info("purged %d old matches", n)
    return n


async def delete_user_and_matches(db: AsyncSession, user: User) -> int:
    """Delete a user and every match they were assigned to (+ that match data).

    Returns the number of matches removed. Super admins are never auto-deleted.
    """
    ids = list(
        (
            await db.scalars(
                select(match_admins.c.match_id).where(match_admins.c.user_id == user.id)
            )
        ).all()
    )
    n = await _delete_matches(db, ids)
    await db.delete(user)
    return n


async def expire_stale_admins(db: AsyncSession) -> dict:
    """Delete MATCH_ADMIN accounts older than ADMIN_RETENTION_DAYS, with their matches."""
    cutoff = _now() - timedelta(days=settings.ADMIN_RETENTION_DAYS)
    admins = (
        await db.scalars(
            select(User).where(
                User.role == UserRole.MATCH_ADMIN, User.created_at < cutoff
            )
        )
    ).all()
    removed_matches = 0
    for a in admins:
        removed_matches += await delete_user_and_matches(db, a)
    if admins:
        logger.info("expired %d stale admins (%d matches)", len(admins), removed_matches)
    return {"admins": len(admins), "matches": removed_matches}


async def send_due_reminders(db: AsyncSession) -> int:
    """Email assigned admins for matches starting within MATCH_REMINDER_HOURS."""
    now = _now()
    window = now + timedelta(hours=settings.MATCH_REMINDER_HOURS)
    matches = (
        await db.scalars(
            select(Match).where(
                Match.status == MatchStatus.SCHEDULED,
                Match.reminder_sent.is_(False),
                Match.scheduled_at.is_not(None),
                Match.scheduled_at >= now,
                Match.scheduled_at <= window,
            )
        )
    ).all()

    sent = 0
    for m in matches:
        when = m.scheduled_at.strftime("%d %b %Y, %H:%M") if m.scheduled_at else "soon"
        a = m.team_a.name if m.team_a else "Team A"
        b = m.team_b.name if m.team_b else "Team B"
        for admin in m.admins:
            if await send_email(
                admin.email,
                f"Match reminder: {a} vs {b}",
                match_reminder_body(admin.full_name, a, b, when),
            ):
                sent += 1
        m.reminder_sent = True
    return sent


async def run_maintenance(db: AsyncSession) -> dict:
    """Run all jobs in one pass; commit once."""
    purged = await purge_old_matches(db)
    admins = await expire_stale_admins(db)
    reminders = await send_due_reminders(db)
    await db.commit()
    return {
        "purged_matches": purged,
        "expired_admins": admins["admins"],
        "expired_admin_matches": admins["matches"],
        "reminders_sent": reminders,
    }
