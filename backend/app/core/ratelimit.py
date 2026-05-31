"""Fixed-window per-IP rate limiting middleware.

Applied to writes and auth (the abuse-prone, uncached paths). Public GET reads
are intentionally exempt — they're cache-served and meant to take heavy traffic.
Backed by Redis INCR when available (correct across pods); otherwise a
process-local counter, which is adequate for single-process dev.
"""
from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.cache import cache
from app.core.config import settings

logger = logging.getLogger("localscore.ratelimit")

_memory_counters: dict[str, tuple[int, float]] = {}


async def _hit(key: str, window: int) -> int:
    """Increment and return the count for `key` within the current window."""
    redis = getattr(cache, "_redis", None)
    if redis is not None:
        try:
            count = await redis.incr(key)
            if count == 1:
                await redis.expire(key, window)
            return int(count)
        except Exception as exc:  # noqa: BLE001 — fail open, never block traffic
            logger.warning("rate-limit redis error (%s); allowing", exc)
            return 0
    # In-memory fallback
    now = time.monotonic()
    count, expires = _memory_counters.get(key, (0, 0.0))
    if expires < now:
        count, expires = 0, now + window
    count += 1
    _memory_counters[key] = (count, expires)
    return count


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int | None = None, window: int = 60) -> None:
        super().__init__(app)
        self.limit = limit or settings.RATE_LIMIT_PER_MINUTE
        self.window = window

    def _is_limited_path(self, request: Request) -> bool:
        path = request.url.path
        if path.startswith(f"{settings.API_V1_PREFIX}/auth"):
            return True
        # Limit all state-changing methods anywhere in the API.
        return request.method in ("POST", "PATCH", "PUT", "DELETE")

    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED or not self._is_limited_path(request):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        window_id = int(time.time() // self.window)
        key = f"rl:{client_ip}:{request.url.path}:{window_id}"
        count = await _hit(key, self.window)

        if count > self.limit:
            retry = self.window - int(time.time()) % self.window
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": str(retry)},
            )
        return await call_next(request)
