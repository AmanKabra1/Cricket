"""Public, no-auth endpoints: dashboard, live score, scorecard, commentary, AI."""
from __future__ import annotations

import json

import httpx
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.cache import DASHBOARD_KEY, cache, live_key, scorecard_key
from app.core.config import settings
from app.models.ball import Ball
from app.models.enums import MatchStatus
from app.models.match import Match
from app.models.setting import AppSetting
from app.schemas.match import MatchOut
from app.services import scoreboard

router = APIRouter(prefix="/public", tags=["public"])

BACKGROUNDS_KEY = "backgrounds"


@router.get("/settings/backgrounds")
async def get_backgrounds(db: DbSession) -> dict:
    """Per-page background image config: {page: {light, dark}}. Empty if unset."""
    row = await db.get(AppSetting, BACKGROUNDS_KEY)
    if not row:
        return {}
    try:
        return json.loads(row.value)
    except (ValueError, TypeError):
        return {}


@router.get("/dashboard")
async def dashboard(db: DbSession) -> dict:
    """Live, upcoming, and recent matches for the home screen.

    Cached (short TTL) — this is the most-hit endpoint and must not query the DB
    on every spectator load.
    """
    cached = await cache.get_json(DASHBOARD_KEY)
    if cached is not None:
        return cached

    async def _by_status(s: MatchStatus, limit: int) -> list[Match]:
        return list(
            (
                await db.scalars(
                    select(Match)
                    .where(Match.status == s)
                    .order_by(Match.scheduled_at.is_(None), Match.scheduled_at.desc())
                    .limit(limit)
                )
            ).all()
        )

    live = await _by_status(MatchStatus.LIVE, 20)
    upcoming = await _by_status(MatchStatus.SCHEDULED, 20)
    recent = await _by_status(MatchStatus.COMPLETED, 20)

    def serialize(matches: list[Match]) -> list[dict]:
        return [MatchOut.model_validate(m).model_dump() for m in matches]

    result = {
        "live": serialize(live),
        "upcoming": serialize(upcoming),
        "recent": serialize(recent),
    }
    await cache.set_json(DASHBOARD_KEY, result, ttl=10)
    return result


@router.get("/matches/{match_id}/live")
async def live_score(match_id: int, db: DbSession) -> dict:
    cached = await cache.get_json(live_key(match_id))
    if cached is not None:
        return cached
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    result = await scoreboard.build_live_score(db, match)
    await cache.set_json(live_key(match_id), result, ttl=5)
    return result


@router.get("/matches/{match_id}/scorecard")
async def scorecard(match_id: int, db: DbSession) -> dict:
    cached = await cache.get_json(scorecard_key(match_id))
    if cached is not None:
        return cached
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    result = await scoreboard.build_scorecard(db, match)
    await cache.set_json(scorecard_key(match_id), result, ttl=5)
    return result


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


@router.get("/matches/{match_id}/analytics")
async def analytics(match_id: int, db: DbSession) -> dict:
    """Per-over run breakdown for Manhattan (bars) and worm (cumulative) charts."""
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    innings_payload = []
    for inn in match.innings:
        balls = (
            await db.scalars(
                select(Ball).where(Ball.innings_id == inn.id).order_by(Ball.sequence)
            )
        ).all()
        overs: dict[int, dict] = {}
        for b in balls:
            penalty = 1 if b.extra_type.value in ("WIDE", "NO_BALL") else 0
            runs = b.runs_batsman + b.extra_runs + penalty
            o = overs.setdefault(b.over_number, {"over": b.over_number, "runs": 0, "wickets": 0})
            o["runs"] += runs
            if b.is_wicket:
                o["wickets"] += 1
        ordered = [overs[k] for k in sorted(overs)]
        cumulative = 0
        for o in ordered:
            cumulative += o["runs"]
            o["cumulative"] = cumulative
        innings_payload.append(
            {
                "innings_number": inn.innings_number,
                "batting_team_id": inn.batting_team_id,
                "overs": ordered,
            }
        )
    return {"match_id": match_id, "innings": innings_payload}


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
