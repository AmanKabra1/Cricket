"""Tournament management, standings, and super-admin approval."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import (
    CurrentUser,
    DbSession,
    OptionalUser,
    require_admin,
    require_super_admin,
)
from app.models.enums import TournamentStatus, UserRole
from app.models.match import Match
from app.models.tournament import Tournament, TournamentTeam
from app.schemas.catalog import StandingRow, TournamentCreate, TournamentOut
from app.schemas.match import MatchOut
from app.services.tournament_engine import generate_fixtures

from app.models.user import User

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


@router.get("", response_model=list[TournamentOut])
async def list_tournaments(
    db: DbSession, user: OptionalUser = None, mine: bool = False
) -> list[Tournament]:
    """Two views of the same list:

    • Public (mine=false): only approved/ongoing/completed tournaments.
    • Management (mine=true): a super admin sees every tournament; a match admin
      sees only the ones they created.
    """
    stmt = select(Tournament).order_by(Tournament.start_date.desc())
    is_super = user is not None and user.role == UserRole.SUPER_ADMIN
    if mine:
        if user is None:
            return []
        if not is_super:
            stmt = stmt.where(Tournament.created_by == user.id)
    elif not is_super:
        stmt = stmt.where(
            Tournament.status.in_(
                [
                    TournamentStatus.APPROVED,
                    TournamentStatus.ONGOING,
                    TournamentStatus.COMPLETED,
                ]
            )
        )
    rows = list((await db.scalars(stmt)).all())
    # Attach fixture counts in one query so the UI can hide "re-generate".
    if rows:
        from sqlalchemy import func

        counts = dict(
            (
                await db.execute(
                    select(Match.tournament_id, func.count(Match.id))
                    .where(Match.tournament_id.in_([t.id for t in rows]))
                    .group_by(Match.tournament_id)
                )
            ).all()
        )
        for t in rows:
            t.match_count = counts.get(t.id, 0)
    return rows


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


class TournamentRename(BaseModel):
    name: str = Field(min_length=1, max_length=160)


@router.patch("/{tournament_id}", response_model=TournamentOut)
async def update_tournament(
    tournament_id: int, payload: TournamentRename, db: DbSession, user: User = Depends(require_admin)
) -> Tournament:
    """Rename a tournament (its creator or a super admin)."""
    tournament = await db.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if user.role != UserRole.SUPER_ADMIN and tournament.created_by not in (None, user.id):
        raise HTTPException(status_code=403, detail="Only the creator or a super admin can rename this tournament.")
    tournament.name = payload.name
    await db.commit()
    await db.refresh(tournament)
    return tournament


class FixtureOptions(BaseModel):
    """Defaults applied to every generated fixture; matches are laid out across
    match-days so a long tournament doesn't run overnight."""
    overs_limit: int = Field(default=20, ge=1, le=100)
    venue_id: int | None = None
    start_at: datetime | None = None  # date + daily start time of the 1st match
    interval_minutes: int = Field(default=180, ge=0, le=100_000)  # gap on the same day
    matches_per_day: int = Field(default=2, ge=1, le=50)  # how many to fit per day


@router.post("/{tournament_id}/fixtures", response_model=list[MatchOut], status_code=201)
async def create_fixtures(
    tournament_id: int,
    db: DbSession,
    payload: FixtureOptions | None = None,
    user: User = Depends(require_admin),
) -> list[Match]:
    tournament = await db.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    # Fixtures can only be generated once a super admin has approved the tournament.
    if tournament.status not in (TournamentStatus.APPROVED, TournamentStatus.ONGOING):
        raise HTTPException(
            status_code=400,
            detail="A super admin must approve this tournament before fixtures can be generated.",
        )
    opts = payload or FixtureOptions()
    try:
        matches = await generate_fixtures(
            db,
            tournament,
            overs_limit=opts.overs_limit,
            venue_id=opts.venue_id,
            start_at=opts.start_at,
            interval_minutes=opts.interval_minutes,
            matches_per_day=opts.matches_per_day,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await db.commit()
    for m in matches:
        await db.refresh(m)
    return matches


@router.delete("/{tournament_id}")
async def delete_tournament(
    tournament_id: int, db: DbSession, _: User = Depends(require_super_admin)
) -> dict:
    """Delete a tournament, its team links, and all of its matches + data."""
    tournament = await db.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    from sqlalchemy import delete as sa_delete

    from app.services.maintenance import _delete_matches

    match_ids = list(
        (await db.scalars(select(Match.id).where(Match.tournament_id == tournament_id))).all()
    )
    await _delete_matches(db, match_ids)
    await db.execute(sa_delete(TournamentTeam).where(TournamentTeam.tournament_id == tournament_id))
    await db.delete(tournament)
    await db.commit()
    return {"ok": True, "deleted_matches": len(match_ids)}


async def _ensure_visible(tournament_id: int, db: DbSession, user: User | None) -> None:
    """404 a non-admin trying to open a tournament that isn't approved yet."""
    is_admin = user is not None and user.role != UserRole.PUBLIC
    if is_admin:
        return
    t = await db.get(Tournament, tournament_id)
    public = t and t.status in (
        TournamentStatus.APPROVED,
        TournamentStatus.ONGOING,
        TournamentStatus.COMPLETED,
    )
    if not public:
        raise HTTPException(status_code=404, detail="Tournament not found")


@router.get("/{tournament_id}/matches", response_model=list[MatchOut])
async def tournament_matches(
    tournament_id: int, db: DbSession, user: OptionalUser = None
) -> list[Match]:
    await _ensure_visible(tournament_id, db, user)
    return list(
        (
            await db.scalars(
                select(Match)
                .where(Match.tournament_id == tournament_id)
                .order_by(Match.scheduled_at.is_(None), Match.scheduled_at.asc(), Match.id.asc())
            )
        ).all()
    )


@router.get("/{tournament_id}/standings", response_model=list[StandingRow])
async def standings(
    tournament_id: int, db: DbSession, user: OptionalUser = None
) -> list[StandingRow]:
    await _ensure_visible(tournament_id, db, user)
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
