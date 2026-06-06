"""Register/unregister Expo push tokens for match notifications."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, model_validator
from sqlalchemy import and_, delete, select

from app.api.deps import DbSession, OptionalUser
from app.models.follow import Follow
from app.models.push import PushToken

router = APIRouter(prefix="/push", tags=["push"])


class TokenIn(BaseModel):
    token: str


class FollowIn(BaseModel):
    token: str
    team_id: int | None = None
    tournament_id: int | None = None

    @model_validator(mode="after")
    def _one_target(self) -> "FollowIn":
        if (self.team_id is None) == (self.tournament_id is None):
            raise ValueError("Provide exactly one of team_id or tournament_id")
        return self


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


def _match_cond(token: str, team_id: int | None, tournament_id: int | None):
    return and_(
        Follow.token == token,
        Follow.team_id == team_id,
        Follow.tournament_id == tournament_id,
    )


@router.get("/follows")
async def list_follows(token: str, db: DbSession) -> dict:
    """A device's follows, so the app can show the followed state of each team/tournament."""
    if not token:
        raise HTTPException(status_code=400, detail="token required")
    rows = (await db.scalars(select(Follow).where(Follow.token == token))).all()
    return {
        "team_ids": [r.team_id for r in rows if r.team_id is not None],
        "tournament_ids": [r.tournament_id for r in rows if r.tournament_id is not None],
    }


@router.post("/follow")
async def follow(payload: FollowIn, db: DbSession) -> dict:
    """Follow a team or tournament (idempotent)."""
    existing = await db.scalar(
        select(Follow).where(_match_cond(payload.token, payload.team_id, payload.tournament_id))
    )
    if not existing:
        db.add(Follow(token=payload.token, team_id=payload.team_id, tournament_id=payload.tournament_id))
        await db.commit()
    return {"ok": True, "following": True}


@router.post("/unfollow")
async def unfollow(payload: FollowIn, db: DbSession) -> dict:
    await db.execute(delete(Follow).where(_match_cond(payload.token, payload.team_id, payload.tournament_id)))
    await db.commit()
    return {"ok": True, "following": False}
