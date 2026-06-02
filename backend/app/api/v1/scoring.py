"""Ball-by-ball scoring endpoints (assigned admins only).

Each accepted delivery is persisted transactionally, then broadcast over
Socket.IO to every spectator in the match room.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentUser, DbSession, authorize_match_admin, require_admin
from app.core.cache import DASHBOARD_KEY, cache, live_key, scorecard_key
from app.models.enums import MatchStatus
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

router = APIRouter(prefix="/matches/{match_id}/scoring", tags=["scoring"])


def _current_innings(match):
    if not match.innings:
        return None
    last = match.innings[-1]
    return None if last.is_closed else last


@router.post("/ball", status_code=status.HTTP_201_CREATED)
async def post_ball(
    match_id: int,
    event: BallEvent,
    db: DbSession,
    user: User = Depends(require_admin),
) -> dict:
    match = await authorize_match_admin(match_id, db, user)
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

    return {
        "ball_id": outcome.ball.id,
        "innings_closed": outcome.innings_closed,
        "over_completed": outcome.over_completed,
        "live_score": live,
    }


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
    if match.status == MatchStatus.COMPLETED:
        match.status = MatchStatus.LIVE
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
