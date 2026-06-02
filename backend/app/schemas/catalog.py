"""Schemas for venues, teams, players, tournaments."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field

from app.models.enums import (
    BattingStyle,
    PlayerRole,
    TournamentFormat,
    TournamentStatus,
)


# ---------- Venue ----------
class VenueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    city: str = Field(min_length=1, max_length=120)
    address: str | None = None
    capacity: int | None = Field(default=None, ge=0)


class VenueOut(VenueCreate):
    id: int
    model_config = {"from_attributes": True}


# ---------- Player ----------
class PlayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    age: int | None = Field(default=None, ge=5, le=80)
    batting_style: BattingStyle = BattingStyle.RIGHT_HAND
    bowling_style: str = Field(default="None", max_length=40)
    role: PlayerRole = PlayerRole.BATSMAN
    jersey_number: int | None = Field(default=None, ge=0, le=999)
    photo_url: str | None = None


class PlayerUpdate(BaseModel):
    name: str | None = None
    age: int | None = Field(default=None, ge=5, le=80)
    batting_style: BattingStyle | None = None
    bowling_style: str | None = Field(default=None, max_length=40)
    role: PlayerRole | None = None
    jersey_number: int | None = Field(default=None, ge=0, le=999)
    photo_url: str | None = None


class PlayerOut(BaseModel):
    id: int
    team_id: int
    name: str
    age: int | None
    batting_style: BattingStyle
    bowling_style: str
    role: PlayerRole
    jersey_number: int | None
    photo_url: str | None
    model_config = {"from_attributes": True}


# ---------- Team ----------
class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    city: str | None = None
    coach: str | None = None
    logo_url: str | None = None


class TeamUpdate(BaseModel):
    name: str | None = None
    city: str | None = None
    coach: str | None = None
    logo_url: str | None = None
    captain_id: int | None = None
    vice_captain_id: int | None = None
    wicket_keeper_id: int | None = None


class TeamOut(BaseModel):
    id: int
    name: str
    city: str | None
    coach: str | None
    logo_url: str | None
    captain_id: int | None
    vice_captain_id: int | None = None
    wicket_keeper_id: int | None = None
    model_config = {"from_attributes": True}


class TeamDetailOut(TeamOut):
    players: list[PlayerOut] = []


# ---------- Tournament ----------
class TournamentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    format: TournamentFormat = TournamentFormat.LEAGUE
    start_date: date | None = None
    end_date: date | None = None
    team_ids: list[int] = []


class TournamentOut(BaseModel):
    id: int
    name: str
    format: TournamentFormat
    status: TournamentStatus
    start_date: date | None
    end_date: date | None
    match_count: int = 0  # fixtures generated/added so far (UI hides re-generate)
    model_config = {"from_attributes": True}


class StandingRow(BaseModel):
    team_id: int
    team_name: str
    played: int
    won: int
    lost: int
    tied: int
    no_result: int
    points: int
    net_run_rate: float
