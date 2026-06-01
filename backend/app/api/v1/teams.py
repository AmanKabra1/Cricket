"""Team and player management (admin write, public read)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_admin
from app.models.ball import Ball
from app.models.match import Match
from app.models.player import Player
from app.models.team import Team
from app.schemas.catalog import (
    PlayerCreate,
    PlayerOut,
    PlayerUpdate,
    TeamCreate,
    TeamDetailOut,
    TeamOut,
    TeamUpdate,
)

from app.models.user import User

router = APIRouter(prefix="/teams", tags=["teams"])


# ---------- public reads ----------
@router.get("", response_model=list[TeamOut])
async def list_teams(db: DbSession, city: str | None = None) -> list[Team]:
    stmt = select(Team).order_by(Team.name)
    if city:
        stmt = stmt.where(Team.city == city)
    return list((await db.scalars(stmt)).all())


@router.get("/{team_id}", response_model=TeamDetailOut)
async def get_team(team_id: int, db: DbSession) -> Team:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


# ---------- admin writes ----------
@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate, db: DbSession, user: User = Depends(require_admin)
) -> Team:
    team = Team(**payload.model_dump(), created_by=user.id)
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return team


@router.patch("/{team_id}", response_model=TeamOut)
async def update_team(
    team_id: int,
    payload: TeamUpdate,
    db: DbSession,
    user: User = Depends(require_admin),
) -> Team:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    await db.commit()
    await db.refresh(team)
    return team


# ---------- players ----------
@router.get("/{team_id}/players", response_model=list[PlayerOut])
async def list_players(team_id: int, db: DbSession) -> list[Player]:
    return list(
        (await db.scalars(select(Player).where(Player.team_id == team_id))).all()
    )


@router.post(
    "/{team_id}/players",
    response_model=PlayerOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_player(
    team_id: int,
    payload: PlayerCreate,
    db: DbSession,
    user: User = Depends(require_admin),
) -> Player:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    player = Player(team_id=team_id, **payload.model_dump())
    db.add(player)
    await db.commit()
    await db.refresh(player)
    return player


@router.patch("/players/{player_id}", response_model=PlayerOut)
async def update_player(
    player_id: int,
    payload: PlayerUpdate,
    db: DbSession,
    user: User = Depends(require_admin),
) -> Player:
    player = await db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(player, field, value)
    await db.commit()
    await db.refresh(player)
    return player


@router.delete("/players/{player_id}")
async def delete_player(
    player_id: int, db: DbSession, user: User = Depends(require_admin)
) -> dict:
    player = await db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    # Block deletion if the player already appears in scored deliveries.
    used = await db.scalar(
        select(Ball.id).where(
            (Ball.striker_id == player_id)
            | (Ball.non_striker_id == player_id)
            | (Ball.bowler_id == player_id)
        ).limit(1)
    )
    if used:
        raise HTTPException(status_code=400, detail="Player has match data and can't be deleted")
    await db.delete(player)
    await db.commit()
    return {"ok": True}


@router.delete("/{team_id}")
async def delete_team(
    team_id: int, db: DbSession, user: User = Depends(require_admin)
) -> dict:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    # Block deletion if the team is part of any match (FK is RESTRICT).
    in_match = await db.scalar(
        select(Match.id).where(
            (Match.team_a_id == team_id) | (Match.team_b_id == team_id)
        ).limit(1)
    )
    if in_match:
        raise HTTPException(status_code=400, detail="Team is used in a match and can't be deleted")
    await db.delete(team)  # players cascade
    await db.commit()
    return {"ok": True}
