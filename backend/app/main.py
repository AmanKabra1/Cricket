"""FastAPI application entrypoint, wrapped with the Socket.IO ASGI server.

`socket_app` is the object servers should run (it mounts both the REST API and
the realtime engine). Importing `app` alone gives only the REST surface.
"""
from __future__ import annotations

import logging

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.realtime.socket import sio

logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="Local Sports Live Scoring Platform — REST + realtime API.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["meta"])
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
