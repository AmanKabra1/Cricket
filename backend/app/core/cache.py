"""Async cache abstraction backing the high-traffic public read endpoints.

At the stated scale (10k concurrent viewers) the live-score and dashboard reads
must not hit the database on every request. They're served from Redis with a
short TTL and invalidated whenever a ball is scored, so the DB only sees the
(small) write path plus a trickle of cache-miss refreshes.

Uses redis.asyncio when REDIS_URL is reachable; otherwise falls back to a
process-local TTL dict so the app still runs in dev/test without Redis.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.core.config import settings

logger = logging.getLogger("localscore.cache")


class _MemoryCache:
    """Tiny in-process TTL cache used when Redis is unavailable."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[float, str]] = {}

    async def get(self, key: str) -> str | None:
        item = self._store.get(key)
        if not item:
            return None
        expires_at, value = item
        if expires_at and expires_at < time.monotonic():
            self._store.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: str, ttl: int) -> None:
        self._store[key] = (time.monotonic() + ttl if ttl else 0, value)

    async def delete_prefix(self, prefix: str) -> None:
        for k in [k for k in self._store if k.startswith(prefix)]:
            self._store.pop(k, None)


class Cache:
    """Facade over Redis (preferred) or the in-memory fallback."""

    def __init__(self) -> None:
        self._redis: Any | None = None
        self._memory = _MemoryCache()
        try:
            import redis.asyncio as aioredis  # noqa: PLC0415

            self._redis = aioredis.from_url(
                settings.REDIS_URL, encoding="utf-8", decode_responses=True
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis unavailable, using in-memory cache: %s", exc)

    async def get_json(self, key: str) -> Any | None:
        try:
            raw = await self._redis.get(key) if self._redis else await self._memory.get(key)
        except Exception as exc:  # noqa: BLE001 — never let cache errors break a request
            logger.warning("cache get failed (%s); bypassing", exc)
            return None
        return json.loads(raw) if raw else None

    async def set_json(self, key: str, value: Any, ttl: int = 5) -> None:
        try:
            payload = json.dumps(value, default=str)
            if self._redis:
                await self._redis.set(key, payload, ex=ttl)
            else:
                await self._memory.set(key, payload, ttl)
        except Exception as exc:  # noqa: BLE001
            logger.warning("cache set failed (%s); ignoring", exc)

    async def invalidate(self, *keys: str) -> None:
        try:
            if self._redis:
                await self._redis.delete(*keys)
            else:
                for k in keys:
                    await self._memory.delete_prefix(k)
        except Exception as exc:  # noqa: BLE001
            logger.warning("cache invalidate failed (%s); ignoring", exc)

    async def invalidate_prefix(self, prefix: str) -> None:
        try:
            if self._redis:
                # SCAN avoids blocking Redis on large keyspaces.
                async for k in self._redis.scan_iter(match=f"{prefix}*"):
                    await self._redis.delete(k)
            else:
                await self._memory.delete_prefix(prefix)
        except Exception as exc:  # noqa: BLE001
            logger.warning("cache invalidate_prefix failed (%s); ignoring", exc)


# Cache-key helpers — one place so producers and invalidators agree.
def live_key(match_id: int) -> str:
    return f"live:{match_id}"


def scorecard_key(match_id: int) -> str:
    return f"scorecard:{match_id}"


DASHBOARD_KEY = "dashboard"

cache = Cache()
