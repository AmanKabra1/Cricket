"""Send push notifications via the Expo Push API.

Best-effort and fire-and-forget: failures are logged, never raised, so a push
problem can't break scoring. Expo's endpoint needs no API key for basic sends.
"""
from __future__ import annotations

import logging

import httpx
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.follow import Follow
from app.models.push import PushToken

logger = logging.getLogger("localscore.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _send(title: str, body: str, data: dict | None, tokens: list[str]) -> int:
    """Push one message to a set of Expo tokens. Best-effort; returns count sent."""
    messages = [
        {"to": tok, "title": title, "body": body, "sound": "default", "data": data or {}}
        for tok in tokens
        if isinstance(tok, str) and tok.startswith("ExponentPushToken")
    ]
    if not messages:
        return 0
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            for i in range(0, len(messages), 100):
                await client.post(EXPO_PUSH_URL, json=messages[i : i + 100])
    except Exception as exc:  # noqa: BLE001 — never let a push break the request
        logger.warning("push send failed: %s", exc)
    return len(messages)


async def broadcast(db: AsyncSession, title: str, body: str, data: dict | None = None) -> int:
    """Send a notification to every registered device. Returns count attempted."""
    tokens = list((await db.scalars(select(PushToken.token))).all())
    return await _send(title, body, data, tokens)


async def broadcast_to_followers(
    db: AsyncSession,
    title: str,
    body: str,
    data: dict | None = None,
    *,
    team_ids: list[int] | None = None,
    tournament_id: int | None = None,
) -> int:
    """Notify only devices following any of the given teams or the tournament."""
    conds = []
    if team_ids:
        conds.append(Follow.team_id.in_(team_ids))
    if tournament_id is not None:
        conds.append(Follow.tournament_id == tournament_id)
    if not conds:
        return 0
    tokens = list((await db.scalars(select(Follow.token).where(or_(*conds)).distinct())).all())
    return await _send(title, body, data, tokens)


async def broadcast_bg(title: str, body: str, data: dict | None = None) -> None:
    """Background-task entrypoint: opens its own session so it can run after the
    HTTP response is sent (keeps scoring/innings endpoints fast)."""
    try:
        async with AsyncSessionLocal() as db:
            await broadcast(db, title, body, data)
    except Exception as exc:  # noqa: BLE001
        logger.warning("push broadcast_bg failed: %s", exc)


async def broadcast_followers_bg(
    title: str, body: str, data: dict | None, team_ids: list[int] | None, tournament_id: int | None
) -> None:
    """Background-task entrypoint for follower-targeted notifications."""
    try:
        async with AsyncSessionLocal() as db:
            await broadcast_to_followers(
                db, title, body, data, team_ids=team_ids, tournament_id=tournament_id
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("push broadcast_followers_bg failed: %s", exc)

