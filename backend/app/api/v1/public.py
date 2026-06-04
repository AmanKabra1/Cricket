"""Public, no-auth endpoints: dashboard, live score, scorecard, commentary, AI."""
from __future__ import annotations

import json
from datetime import datetime

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
from app.services.match_timing import is_due_live, is_noshow, local_now

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

    Time-aware bucketing (so the lists move on their own as the clock advances):
      • LIVE / INNINGS_BREAK matches are always "live".
      • a SCHEDULED match whose start time has arrived (but whose window hasn't
        elapsed) is shown as "live (starting)" even before the first ball.
      • a SCHEDULED match still in the future is "upcoming".
      • a SCHEDULED match whose whole expected window passed with no ball ever
        scored is a no-show → shown under "recent" (and auto-marked ABANDONED by
        maintenance). COMPLETED + ABANDONED are also "recent".

    Cached (short TTL) — this is the most-hit endpoint and must not query the DB
    on every spectator load.
    """
    cached = await cache.get_json(DASHBOARD_KEY)
    if cached is not None:
        return cached

    async def _by_status(statuses: list[MatchStatus], limit: int) -> list[Match]:
        return list(
            (
                await db.scalars(
                    select(Match)
                    .where(Match.status.in_(statuses), Match.approved.is_(True))
                    .order_by(Match.scheduled_at.is_(None), Match.scheduled_at.desc())
                    .limit(limit)
                )
            ).all()
        )

    live_db = await _by_status([MatchStatus.LIVE, MatchStatus.INNINGS_BREAK], 20)
    scheduled = await _by_status([MatchStatus.SCHEDULED], 60)
    completed = await _by_status([MatchStatus.COMPLETED, MatchStatus.ABANDONED], 20)

    now = local_now()
    due = [m for m in scheduled if is_due_live(m, now)]
    noshow = [m for m in scheduled if is_noshow(m, now)]
    future = [m for m in scheduled if m not in due and m not in noshow]
    # Soonest-first for upcoming; most-recent-first elsewhere.
    future.sort(key=lambda m: (m.scheduled_at is None, m.scheduled_at or datetime.max))

    def serialize(matches: list[Match], starting: bool = False) -> list[dict]:
        out = []
        for m in matches:
            d = MatchOut.model_validate(m).model_dump()
            if starting:
                d["starting_soon"] = True
            out.append(d)
        return out

    result = {
        # Real live first, then scheduled matches whose time has come.
        "live": serialize(live_db) + serialize(due, starting=True),
        "upcoming": serialize(future),
        "recent": serialize(completed) + serialize(noshow),
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
    """Proxy to the AI service; degrades gracefully if it's unavailable.

    Cached by the current score state, so every spectator viewing the same moment
    shares one AI call — this shields the (free-tier) AI service and keeps any LLM
    usage well within free quotas. The key changes as soon as the score does, so
    the prediction still updates ball-by-ball.
    """
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    live = await scoreboard.build_live_score(db, match)

    # Signature of the live state → identical states reuse the cached prediction.
    sig = ";".join(
        f"{i['innings_number']}:{i['runs']}/{i['wickets']}:{i['overs']}" for i in live["innings"]
    )
    key = f"prediction:{match_id}:{live['status']}:{sig}"
    cached = await cache.get_json(key)
    if cached is not None:
        return cached

    try:
        # The AI service is on a free tier and may cold-start (sleep ~30s), so the
        # first call needs a generous timeout; the result is then cached.
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVICE_URL}/predict/win-probability",
                json={"match_id": match_id, "live_score": live},
            )
            resp.raise_for_status()
            result = resp.json()
        await cache.set_json(key, result, ttl=30)  # short TTL; key already score-scoped
        return result
    except (httpx.HTTPError, Exception):  # noqa: BLE001
        return {
            "match_id": match_id,
            "available": False,
            "message": "AI prediction service is warming up. Check back shortly.",
        }
