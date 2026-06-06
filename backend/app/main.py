"""FastAPI application entrypoint, wrapped with the Socket.IO ASGI server.

`socket_app` is the object servers should run (it mounts both the REST API and
the realtime engine). Importing `app` alone gives only the REST surface.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

import os

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.ratelimit import RateLimitMiddleware
from app.realtime.socket import sio

logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG)
logger = logging.getLogger("localscore")

# Error tracking — only initialises when SENTRY_DSN is set, so it's a no-op
# locally and until you add a (free) DSN in the environment.
if settings.SENTRY_DSN:
    try:
        import sentry_sdk  # noqa: PLC0415

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            send_default_pii=False,
        )
        logger.info("Sentry error tracking enabled")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sentry init failed: %s", exc)


async def _maintenance_loop() -> None:
    """Automatic housekeeping: runs cleanup + reminders on an interval, with no
    external cron. While the instance is kept awake (uptime ping), this fires
    every MAINTENANCE_INTERVAL_MINUTES — so old data is purged automatically."""
    from app.core.database import AsyncSessionLocal
    from app.services.maintenance import run_maintenance

    await asyncio.sleep(60)  # let the app settle / DB be ready
    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await run_maintenance(db)
            logger.info("auto-maintenance: %s", result)
        except Exception as exc:  # noqa: BLE001 — never kill the loop
            logger.warning("auto-maintenance failed: %s", exc)
        await asyncio.sleep(max(60, settings.MAINTENANCE_INTERVAL_MINUTES * 60))


async def _ai_warmup_loop() -> None:
    """Keep the AI service awake by pinging it every few minutes — the same way
    the backend itself is kept warm. While this backend is up (which the external
    keep-alive ping ensures), the AI never sleeps, so predictions don't
    cold-start with the 'warming up' fallback. Skipped for the localhost default."""
    import httpx

    if "localhost" in settings.AI_SERVICE_URL or "127.0.0.1" in settings.AI_SERVICE_URL:
        return
    await asyncio.sleep(30)
    while True:
        try:
            async with httpx.AsyncClient(timeout=40.0) as client:
                await client.get(f"{settings.AI_SERVICE_URL}/health")
        except Exception as exc:  # noqa: BLE001 — never kill the loop
            logger.info("ai warmup ping failed: %s", exc)
        await asyncio.sleep(10 * 60)  # every 10 minutes


@asynccontextmanager
async def lifespan(_app: FastAPI):
    tasks: list[asyncio.Task] = []
    if settings.MAINTENANCE_AUTO:
        tasks.append(asyncio.create_task(_maintenance_loop()))
    tasks.append(asyncio.create_task(_ai_warmup_loop()))
    yield
    for task in tasks:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="Local Sports Live Scoring Platform — REST + realtime API.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Serve locally-stored uploads (when STORAGE_BACKEND="local") from /media.
if settings.STORAGE_BACKEND.lower() != "s3":
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.UPLOAD_DIR), name="media")


# GET + HEAD so uptime monitors (which often use HEAD) get 200, not 405.
@app.api_route("/health", methods=["GET", "HEAD"], tags=["meta"])
async def health() -> dict:
    """Liveness: the process is up and serving (no dependency checks)."""
    return {"status": "ok", "service": settings.PROJECT_NAME, "env": settings.ENVIRONMENT}


@app.get("/ready", tags=["meta"])
async def ready():
    """Readiness: can we actually serve? Checks the database (and cache).

    Returns 200 only when the DB is reachable, else 503 — so load balancers /
    uptime monitors can distinguish "up" from "ready to handle traffic".
    """
    from fastapi.responses import JSONResponse
    from sqlalchemy import text

    from app.core.cache import cache
    from app.core.database import engine

    checks = {"db": False, "cache": False}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["db"] = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("readiness DB check failed: %s", exc)
    try:
        await cache.get_json("__ready__")  # reachability; missing key is fine
        checks["cache"] = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("readiness cache check failed: %s", exc)

    ready_ok = checks["db"]  # cache falls back to in-memory, so DB is the gate
    return JSONResponse({**checks, "ready": ready_ok}, status_code=200 if ready_ok else 503)


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {
        "name": settings.PROJECT_NAME,
        "docs": "/docs",
        "api": settings.API_V1_PREFIX,
    }


# Mount Socket.IO at /socket.io and delegate everything else to FastAPI.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="socket.io")
