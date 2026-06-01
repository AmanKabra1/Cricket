"""Match lifecycle: create, assign admins, toss, start innings, read."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import (
    CurrentUser,
    DbSession,
    authorize_match_admin,
    require_admin,
)
from app.models.enums import MatchStatus
from app.models.innings import Innings
from app.models.match import Match
from app.models.user import User
from app.schemas.match import (
    MatchCreate,
    MatchOut,
    StartInningsRequest,
    TossUpdate,
)

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[MatchOut])
async def list_matches(
    db: DbSession, status_filter: MatchStatus | None = None
) -> list[Match]:
    # NULLS LAST isn't valid MySQL/TiDB syntax — use IS NULL ordering (portable).
    stmt = select(Match).order_by(Match.scheduled_at.is_(None), Match.scheduled_at.desc())
    if status_filter:
        stmt = stmt.where(Match.status == status_filter)
    return list((await db.scalars(stmt)).all())


@router.get("/{match_id}", response_model=MatchOut)
async def get_match(match_id: int, db: DbSession) -> Match:
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.delete("/{match_id}")
async def delete_match(
    match_id: int, db: DbSession, user: User = Depends(require_admin)
) -> dict:
    """Delete a match and ALL related data (stats, innings, balls, admin links)."""
    await authorize_match_admin(match_id, db, user)
    from app.services.maintenance import _delete_matches

    await _delete_matches(db, [match_id])  # fast set-based bulk delete
    await db.commit()
    return {"ok": True}


@router.post("", response_model=MatchOut, status_code=status.HTTP_201_CREATED)
async def create_match(
    payload: MatchCreate, db: DbSession, user: User = Depends(require_admin)
) -> Match:
    match = Match(
        team_a_id=payload.team_a_id,
        team_b_id=payload.team_b_id,
        venue_id=payload.venue_id,
        tournament_id=payload.tournament_id,
        scheduled_at=payload.scheduled_at,
        overs_limit=payload.overs_limit,
        status=MatchStatus.SCHEDULED,
    )
    # Assign scoring admins (creator always included).
    admin_ids = set(payload.admin_ids) | {user.id}
    admins = (await db.scalars(select(User).where(User.id.in_(admin_ids)))).all()
    match.admins = list(admins)
    db.add(match)
    await db.commit()
    await db.refresh(match)
    return match


@router.post("/{match_id}/toss", response_model=MatchOut)
async def set_toss(
    match_id: int,
    payload: TossUpdate,
    db: DbSession,
    user: User = Depends(require_admin),
) -> Match:
    match = await authorize_match_admin(match_id, db, user)
    if payload.toss_winner_id not in (match.team_a_id, match.team_b_id):
        raise HTTPException(status_code=400, detail="Toss winner must be a participating team")
    match.toss_winner_id = payload.toss_winner_id
    match.toss_decision = payload.decision
    await db.commit()
    await db.refresh(match)
    return match


@router.post("/{match_id}/innings", response_model=MatchOut)
async def start_innings(
    match_id: int,
    payload: StartInningsRequest,
    db: DbSession,
    user: User = Depends(require_admin),
) -> Match:
    match = await authorize_match_admin(match_id, db, user)
    teams = {match.team_a_id, match.team_b_id}
    if {payload.batting_team_id, payload.bowling_team_id} != teams:
        raise HTTPException(status_code=400, detail="Innings teams must match the two participating teams")

    existing = list(match.innings)
    innings_number = len(existing) + 1
    if innings_number > 2:
        raise HTTPException(status_code=400, detail="Both innings already started")

    # Second innings target = first innings runs + 1.
    target = None
    if existing:
        first = existing[0]
        if not first.is_closed:
            raise HTTPException(status_code=400, detail="First innings is still in progress")
        target = first.total_runs + 1

    innings = Innings(
        match_id=match.id,
        innings_number=innings_number,
        batting_team_id=payload.batting_team_id,
        bowling_team_id=payload.bowling_team_id,
        target=target,
    )
    db.add(innings)
    match.status = MatchStatus.LIVE
    await db.commit()
    await db.refresh(match)
    return match
