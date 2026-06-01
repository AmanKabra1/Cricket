"""Cron-callable maintenance endpoint (token-protected).

A scheduled job (GitHub Actions) POSTs here with the X-Maintenance-Token header.
Runs data purge, stale-admin expiry, and due match reminders.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app.api.deps import DbSession
from app.core.config import settings
from app.services.maintenance import run_maintenance

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.post("/run")
async def run(db: DbSession, x_maintenance_token: str | None = Header(default=None)) -> dict:
    if not settings.MAINTENANCE_TOKEN:
        raise HTTPException(status_code=503, detail="Maintenance token not configured")
    if x_maintenance_token != settings.MAINTENANCE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid maintenance token")
    return await run_maintenance(db)
