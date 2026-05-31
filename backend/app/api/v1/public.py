"""Public, no-auth endpoints: dashboard, live score, scorecard, commentary, AI."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import settings
from app.models.ball import Ball
from app.models.enums import MatchStatus
from app.models.match import Match
from app.schemas.match import MatchOut
from app.services import scoreboard

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/dashboard")
async def dashboard(db: DbSession) -> dict:
    """Live, upcoming, and recent matches for the home screen."""

    async def _by_status(s: MatchStatus, limit: int) -> list[Match]:
        return list(
            (
                await db.scalars(
                    select(Match)
                    .where(Match.status == s)
                    .order_by(Match.scheduled_at.desc().nullslast())
                    .limit(limit)
                )
            ).all()
        )

    live = await _by_status(MatchStatus.LIVE, 20)
    upcoming = await _by_status(MatchStatus.SCHEDULED, 20)
    recent = await _by_status(MatchStatus.COMPLETED, 20)

    def serialize(matches: list[Match]) -> list[dict]:
        return [MatchOut.model_validate(m).model_dump() for m in matches]

    return {
        "live": serialize(live),
        "upcoming": serialize(upcoming),
        "recent": serialize(recent),
    }


@router.get("/matches/{match_id}/live")
async def live_score(match_id: int, db: DbSession) -> dict:
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return await scoreboard.build_live_score(db, match)


@router.get("/matches/{match_id}/scorecard")
async def scorecard(match_id: int, db: DbSession) -> dict:
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return await scoreboard.build_scorecard(db, match)


@router.get("/matches/{match_id}/commentary")
async def commentary(match_id: int, db: DbSession, limit: int = 50) -> list[dict]:
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    innings_ids = [inn.id for inn in match.innings]
    if not innings_ids:
        return []
    balls = (
        await db.scalars(
            select(Ball)
            .where(Ball.innings_id.in_(innings_ids))
            .order_by(Ball.innings_id.desc(), Ball.sequence.desc())
            .limit(limit)
        )
    ).all()
    return [
        {
            "over": b.over_number,
            "ball": b.ball_in_over,
            "runs": b.runs_batsman + b.extra_runs + (1 if b.extra_type.value in ("WIDE", "NO_BALL") else 0),
            "is_wicket": b.is_wicket,
            "text": b.commentary,
        }
        for b in balls
    ]


@router.get("/matches/{match_id}/prediction")
async def ai_prediction(match_id: int, db: DbSession) -> dict:
    """Proxy to the AI service; degrades gracefully if it's unavailable."""
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    live = await scoreboard.build_live_score(db, match)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVICE_URL}/predict/win-probability",
                json={"match_id": match_id, "live_score": live},
            )
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, Exception):  # noqa: BLE001
        return {
            "match_id": match_id,
            "available": False,
            "message": "AI prediction service is warming up. Check back shortly.",
        }
