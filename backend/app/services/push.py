"""Send push notifications via the Expo Push API.

Best-effort and fire-and-forget: failures are logged, never raised, so a push
problem can't break scoring. Expo's endpoint needs no API key for basic sends.
"""
from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.push import PushToken

logger = logging.getLogger("localscore.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def broadcast(db: AsyncSession, title: str, body: str, data: dict | None = None) -> int:
    """Send a notification to every registered device. Returns count attempted."""
    tokens = list((await db.scalars(select(PushToken.token))).all())
    if not tokens:
        return 0
    # Expo accepts an array of messages; chunk to stay well under limits.
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
        logger.warning("push broadcast failed: %s", exc)
    return len(messages)


async def broadcast_bg(title: str, body: str, data: dict | None = None) -> None:
    """Background-task entrypoint: opens its own session so it can run after the
    HTTP response is sent (keeps scoring/innings endpoints fast)."""
    try:
        async with AsyncSessionLocal() as db:
            await broadcast(db, title, body, data)
    except Exception as exc:  # noqa: BLE001
        logger.warning("push broadcast_bg failed: %s", exc)

