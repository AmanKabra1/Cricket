"""Socket.IO realtime server.

Spectators connect (no auth) and subscribe to a room per match. Score updates,
new commentary, and stat refreshes are emitted to `match:{id}`. With multiple
backend pods, the Redis manager fans events across pods so a viewer on pod B
receives an event emitted on pod A.
"""
from __future__ import annotations

import logging

import socketio

from app.core.config import settings

logger = logging.getLogger("localscore.socket")

# Redis-backed client manager → horizontal scaling across backend pods.
# Falls back gracefully if Redis is unavailable (single-process dev/test).
_client_manager: socketio.AsyncManager | None = None
if settings.REDIS_URL:  # empty → single-instance, in-memory fan-out (no Redis)
    try:  # pragma: no cover - depends on runtime env
        _client_manager = socketio.AsyncRedisManager(settings.REDIS_URL)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis manager unavailable, using in-memory manager: %s", exc)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.BACKEND_CORS_ORIGINS or "*",
    client_manager=_client_manager,
    logger=settings.DEBUG,
    engineio_logger=False,
)


def _room(match_id: int) -> str:
    return f"match:{match_id}"


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None) -> None:
    logger.debug("client connected: %s", sid)


@sio.event
async def disconnect(sid: str) -> None:
    logger.debug("client disconnected: %s", sid)


@sio.on("subscribe_match")
async def subscribe_match(sid: str, data: dict) -> dict:
    """Client joins a match room: {'match_id': 123}."""
    match_id = int(data.get("match_id", 0))
    if not match_id:
        return {"ok": False, "error": "match_id required"}
    await sio.enter_room(sid, _room(match_id))
    return {"ok": True, "room": _room(match_id)}


@sio.on("unsubscribe_match")
async def unsubscribe_match(sid: str, data: dict) -> dict:
    match_id = int(data.get("match_id", 0))
    await sio.leave_room(sid, _room(match_id))
    return {"ok": True}


# ---- server-side emit helpers (called from REST handlers) ----
async def emit_score_update(match_id: int, payload: dict) -> None:
    await sio.emit("score_update", payload, room=_room(match_id))


async def emit_commentary(match_id: int, payload: dict) -> None:
    await sio.emit("commentary", payload, room=_room(match_id))


async def emit_match_status(match_id: int, payload: dict) -> None:
    await sio.emit("match_status", payload, room=_room(match_id))
