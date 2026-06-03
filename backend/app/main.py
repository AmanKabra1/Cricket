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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = None
    if settings.MAINTENANCE_AUTO:
        task = asyncio.create_task(_maintenance_loop())
    yield
    if task:
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
    return {"status": "ok", "service": settings.PROJECT_NAME, "env": settings.ENVIRONMENT}


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {
        "name": settings.PROJECT_NAME,
        "docs": "/docs",
        "api": settings.API_V1_PREFIX,
    }


# Mount Socket.IO at /socket.io and delegate everything else to FastAPI.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="socket.io")
