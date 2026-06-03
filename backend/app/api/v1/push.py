"""Register/unregister Expo push tokens for match notifications."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import delete, select

from app.api.deps import DbSession, OptionalUser
from app.models.push import PushToken

router = APIRouter(prefix="/push", tags=["push"])


class TokenIn(BaseModel):
    token: str


@router.post("/register")
async def register(payload: TokenIn, db: DbSession, user: OptionalUser = None) -> dict:
    """Save a device's Expo push token (idempotent). Anonymous spectators allowed."""
    existing = await db.scalar(select(PushToken).where(PushToken.token == payload.token))
    if existing:
        existing.user_id = user.id if user else existing.user_id
    else:
        db.add(PushToken(token=payload.token, user_id=user.id if user else None))
    await db.commit()
    return {"ok": True}


@router.post("/unregister")
async def unregister(payload: TokenIn, db: DbSession) -> dict:
    await db.execute(delete(PushToken).where(PushToken.token == payload.token))
    await db.commit()
    return {"ok": True}
