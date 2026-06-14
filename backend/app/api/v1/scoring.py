"""Ball-by-ball scoring endpoints (assigned admins only).

Each accepted delivery is persisted transactionally, then broadcast over
Socket.IO to every spectator in the match room.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import DbSession, authorize_match_admin, require_admin
from app.core.cache import DASHBOARD_KEY, cache, live_key, scorecard_key
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.ball import Ball
from app.models.enums import MatchStatus
from app.models.player import Player
from app.realtime.socket import emit_commentary, emit_match_status, emit_score_update
from app.schemas.match import BallEvent, MatchResultUpdate
from app.services import scoreboard
from app.services.scoring_engine import (
    ScoringError,
    finalize_match_result,
    record_ball,
    undo_last_ball,
)

from app.models.user import User

logger = logging.getLogger("localscore.scoring")
router = APIRouter(prefix="/matches/{match_id}/scoring", tags=["scoring"])


def _current_innings(match):
    if not match.innings:
        return None
    last = match.innings[-1]
    return None if last.is_closed else last


async def _enrich_commentary(match_id: int, ball_id: int) -> None:
    """Background: replace a ball's template commentary with an AI line from the
    AI service, then push it to spectators. Best-effort — failures are ignored
    and the existing template stays."""
    try:
        async with AsyncSessionLocal() as db:
            ball = await db.get(Ball, ball_id)
            if ball is None:
                return
            striker = await db.get(Player, ball.striker_id)
            bowler = await db.get(Player, ball.bowler_id)
            payload = {
                "over": ball.over_number,
                "ball": ball.ball_in_over,
                "runs": ball.runs_batsman,
                "is_wicket": ball.is_wicket,
                "extra_type": ball.extra_type.value if ball.extra_type else "NONE",
                "striker": striker.name if striker else "the batter",
                "bowler": bowler.name if bowler else "the bowler",
            }
            # In-process AI (app/ai); run off the event loop since the LLM call
            # is blocking. Falls back to template (source != "llm") with no key.
            from starlette.concurrency import run_in_threadpool

            from app.ai import commentary as ai_commentary
            from app.ai.schemas import CommentaryRequest

            result = await run_in_threadpool(ai_commentary.generate, CommentaryRequest(**payload))
            # Only overwrite when the LLM actually produced a line.
            if result.source == "llm" and result.text:
                ball.commentary = result.text
                await db.commit()
                await emit_commentary(
                    match_id,
                    {
                        "match_id": match_id,
                        "over": ball.over_number,
                        "ball": ball.ball_in_over,
                        "text": ball.commentary,
                        "is_wicket": ball.is_wicket,
                    },
                )
    except Exception as exc:  # noqa: BLE001 — never let enrichment affect scoring
        logger.info("AI commentary enrich skipped: %s", exc)


@router.post("/ball", status_code=status.HTTP_201_CREATED)
async def post_ball(
    match_id: int,
    event: BallEvent,
    db: DbSession,
    background: BackgroundTasks,
    user: User = Depends(require_admin),
) -> dict:
    match = await authorize_match_admin(match_id, db, user)
    if not match.approved:
        raise HTTPException(status_code=403, detail="This match isn't approved yet.")
    innings = _current_innings(match)
    if innings is None:
        raise HTTPException(status_code=400, detail="No open innings; start an innings first")

    try:
        outcome = await record_ball(
            db,
            match_id=match_id,
            innings=innings,
            striker_id=event.striker_id,
            non_striker_id=event.non_striker_id,
            bowler_id=event.bowler_id,
            runs_batsman=event.runs_batsman,
            extra_type=event.extra_type,
            extra_runs=event.extra_runs,
            is_wicket=event.is_wicket,
            wicket_type=event.wicket_type,
            dismissed_player_id=event.dismissed_player_id,
            fielder_id=event.fielder_id,
            commentary=event.commentary,
            overs_limit=match.overs_limit,
        )
    except ScoringError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if outcome.innings_closed and len(match.innings) >= 2:
        match.status = MatchStatus.COMPLETED
        # Wickets-in-hand depends on the chasing team's squad size (6-a-side → 5).
        from app.models.player import Player
        from sqlalchemy import func, select

        chasing_size = await db.scalar(
            select(func.count(Player.id)).where(Player.team_id == match.innings[1].batting_team_id)
        )
        finalize_match_result(match, chasing_squad_size=chasing_size or 11)
        from app.services.tournament_engine import apply_match_result

        await apply_match_result(db, match)  # update points table / NRR if in a tournament
    elif outcome.innings_closed:
        match.status = MatchStatus.INNINGS_BREAK

    await db.commit()
    await db.refresh(match)

    live = await scoreboard.build_live_score(db, match)
    # Refresh the live cache with the new state; drop derived/aggregate caches.
    await cache.set_json(live_key(match_id), live, ttl=5)
    await cache.invalidate(scorecard_key(match_id), DASHBOARD_KEY)
    # Fan out to spectators.
    await emit_score_update(match_id, live)
    await emit_commentary(
        match_id,
        {
            "match_id": match_id,
            "over": outcome.ball.over_number,
            "ball": outcome.ball.ball_in_over,
            "text": outcome.ball.commentary,
            "is_wicket": outcome.ball.is_wicket,
        },
    )
    if outcome.innings_closed:
        await emit_match_status(match_id, {"match_id": match_id, "status": match.status.value})

    # After responding, upgrade the commentary to an AI line (if enabled).
    if settings.AI_COMMENTARY_ENABLED:
        background.add_task(_enrich_commentary, match_id, outcome.ball.id)

    # Notify followers (of either team / the tournament) of the result.
    if match.status == MatchStatus.COMPLETED:
        from app.services.push import broadcast_followers_bg

        background.add_task(
            broadcast_followers_bg,
            "🏆 Match result",
            match.result_text or "Match completed",
            {"matchId": match_id},
            [match.team_a_id, match.team_b_id],
            match.tournament_id,
        )

    return {
        "ball_id": outcome.ball.id,
        "innings_closed": outcome.innings_closed,
        "over_completed": outcome.over_completed,
        "live_score": live,
    }


class AtCrease(BaseModel):
    striker_id: int
    non_striker_id: int
    bowler_id: int | None = None


@router.post("/at-crease")
async def set_at_crease(
    match_id: int, payload: AtCrease, db: DbSession, user: User = Depends(require_admin)
) -> dict:
    """Tell the scorecard who's currently batting/bowling, so a newly sent-in
    batter (and the current bowler) show at 0 before a ball is completed."""
    match = await authorize_match_admin(match_id, db, user)
    innings = _current_innings(match)
    if innings is None:
        return {"ok": False}
    innings.current_striker_id = payload.striker_id
    innings.current_non_striker_id = payload.non_striker_id
    if payload.bowler_id:
        innings.current_bowler_id = payload.bowler_id
    await db.commit()
    # Refresh derived views so the new batter appears immediately.
    await db.refresh(match)
    live = await scoreboard.build_live_score(db, match)
    await cache.set_json(live_key(match_id), live, ttl=5)
    await cache.invalidate(scorecard_key(match_id))
    return {"ok": True}


@router.post("/undo")
async def undo_ball(
    match_id: int, db: DbSession, user: User = Depends(require_admin)
) -> dict:
    match = await authorize_match_admin(match_id, db, user)
    if not match.innings:
        raise HTTPException(status_code=400, detail="Nothing to undo")
    innings = match.innings[-1]
    ok = await undo_last_ball(db, match_id, innings)
    if not ok:
        raise HTTPException(status_code=400, detail="No deliveries to undo")
    # Reverting the final ball un-completes the match: clear its result and, if
    # it's in a tournament, recompute the points table so the win is removed.
    was_completed = match.status == MatchStatus.COMPLETED
    if was_completed:
        match.status = MatchStatus.LIVE
        match.winner_team_id = None
        match.result_text = None
    await db.commit()
    if was_completed and match.tournament_id:
        from app.services.tournament_engine import apply_match_result

        await apply_match_result(db, match)
        await db.commit()
    await db.refresh(match)
    live = await scoreboard.build_live_score(db, match)
    await cache.set_json(live_key(match_id), live, ttl=5)
    await cache.invalidate(scorecard_key(match_id), DASHBOARD_KEY)
    await emit_score_update(match_id, live)
    return {"undone": True, "live_score": live}


@router.post("/result")
async def set_result(
    match_id: int,
    payload: MatchResultUpdate,
    db: DbSession,
    user: User = Depends(require_admin),
) -> dict:
    match = await authorize_match_admin(match_id, db, user)
    match.winner_team_id = payload.winner_team_id
    match.result_text = payload.result_text
    match.status = MatchStatus.COMPLETED

    # Roll the result into tournament standings (points table + NRR) if applicable.
    from app.services.tournament_engine import apply_match_result

    await apply_match_result(db, match)

    await db.commit()
    await cache.invalidate(live_key(match_id), scorecard_key(match_id), DASHBOARD_KEY)
    await emit_match_status(
        match_id,
        {"match_id": match_id, "status": match.status.value, "result": payload.result_text},
    )
    return {"ok": True, "result": payload.result_text}
