"""Tournament management, standings, and super-admin approval."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import (
    CurrentUser,
    DbSession,
    require_admin,
    require_super_admin,
)
from app.models.enums import TournamentStatus
from app.models.match import Match
from app.models.tournament import Tournament, TournamentTeam
from app.schemas.catalog import StandingRow, TournamentCreate, TournamentOut
from app.schemas.match import MatchOut
from app.services.tournament_engine import generate_fixtures

from app.models.user import User

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


@router.get("", response_model=list[TournamentOut])
async def list_tournaments(db: DbSession) -> list[Tournament]:
    return list(
        (await db.scalars(select(Tournament).order_by(Tournament.start_date.desc()))).all()
    )


@router.post("", response_model=TournamentOut, status_code=status.HTTP_201_CREATED)
async def create_tournament(
    payload: TournamentCreate,
    db: DbSession,
    user: User = Depends(require_admin),
) -> Tournament:
    tournament = Tournament(
        name=payload.name,
        format=payload.format,
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_by=user.id,
        status=TournamentStatus.PENDING,
    )
    db.add(tournament)
    await db.flush()
    for team_id in dict.fromkeys(payload.team_ids):  # de-dupe, preserve order
        db.add(TournamentTeam(tournament_id=tournament.id, team_id=team_id))
    await db.commit()
    await db.refresh(tournament)
    return tournament


@router.post("/{tournament_id}/approve", response_model=TournamentOut)
async def approve_tournament(
    tournament_id: int,
    db: DbSession,
    user: User = Depends(require_super_admin),
) -> Tournament:
    tournament = await db.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    tournament.status = TournamentStatus.APPROVED
    tournament.approved_by = user.id
    await db.commit()
    await db.refresh(tournament)
    return tournament


@router.post("/{tournament_id}/fixtures", response_model=list[MatchOut], status_code=201)
async def create_fixtures(
    tournament_id: int,
    db: DbSession,
    user: User = Depends(require_admin),
) -> list[Match]:
    tournament = await db.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    try:
        matches = await generate_fixtures(db, tournament)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await db.commit()
    for m in matches:
        await db.refresh(m)
    return matches


@router.get("/{tournament_id}/matches", response_model=list[MatchOut])
async def tournament_matches(tournament_id: int, db: DbSession) -> list[Match]:
    return list(
        (
            await db.scalars(
                select(Match)
                .where(Match.tournament_id == tournament_id)
                .order_by(Match.scheduled_at.asc().nullslast(), Match.id.asc())
            )
        ).all()
    )


@router.get("/{tournament_id}/standings", response_model=list[StandingRow])
async def standings(tournament_id: int, db: DbSession) -> list[StandingRow]:
    rows = (
        await db.scalars(
            select(TournamentTeam)
            .where(TournamentTeam.tournament_id == tournament_id)
            .order_by(TournamentTeam.points.desc(), TournamentTeam.net_run_rate.desc())
        )
    ).all()
    return [
        StandingRow(
            team_id=r.team_id,
            team_name=r.team.name if r.team else "—",
            played=r.played,
            won=r.won,
            lost=r.lost,
            tied=r.tied,
            no_result=r.no_result,
            points=r.points,
            net_run_rate=r.net_run_rate,
        )
        for r in rows
    ]
