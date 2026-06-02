"""Schemas for matches, scoring input, and live scoreboards."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ExtraType, MatchStatus, TossDecision, WicketType


# ---------- Match lifecycle ----------
class MatchCreate(BaseModel):
    team_a_id: int
    team_b_id: int
    venue_id: int | None = None
    tournament_id: int | None = None
    scheduled_at: datetime  # required — every match needs a date & time
    overs_limit: int = Field(default=20, ge=1, le=100)
    admin_ids: list[int] = []

    @model_validator(mode="after")
    def _distinct_teams(self) -> "MatchCreate":
        if self.team_a_id == self.team_b_id:
            raise ValueError("team_a and team_b must be different teams")
        return self


class TossUpdate(BaseModel):
    toss_winner_id: int
    decision: TossDecision


class MatchResultUpdate(BaseModel):
    winner_team_id: int | None = None
    result_text: str = Field(max_length=255)


class MatchOut(BaseModel):
    id: int
    sport: str
    tournament_id: int | None
    team_a_id: int
    team_b_id: int
    venue_id: int | None
    scheduled_at: datetime | None
    overs_limit: int
    status: MatchStatus
    toss_winner_id: int | None
    toss_decision: TossDecision | None
    winner_team_id: int | None
    result_text: str | None
    admin_ids: list[int] = []  # user ids allowed to score this match
    # True for a scheduled match whose start time has arrived (shown in "Live").
    starting_soon: bool = False
    model_config = {"from_attributes": True}


# ---------- Scoring input ----------
class StartInningsRequest(BaseModel):
    batting_team_id: int
    bowling_team_id: int


class BallEvent(BaseModel):
    """A single delivery as entered by the scorer."""

    striker_id: int
    non_striker_id: int
    bowler_id: int
    runs_batsman: int = Field(default=0, ge=0, le=7)
    extra_type: ExtraType = ExtraType.NONE
    extra_runs: int = Field(default=0, ge=0, le=7)
    is_wicket: bool = False
    wicket_type: WicketType = WicketType.NONE
    dismissed_player_id: int | None = None
    fielder_id: int | None = None
    commentary: str | None = Field(default=None, max_length=512)

    @model_validator(mode="after")
    def _validate(self) -> "BallEvent":
        if self.is_wicket and self.wicket_type == WicketType.NONE:
            raise ValueError("wicket_type is required when is_wicket is true")
        if not self.is_wicket and self.wicket_type != WicketType.NONE:
            raise ValueError("wicket_type set but is_wicket is false")
        return self


# ---------- Scoreboard output ----------
class BatterCard(BaseModel):
    player_id: int
    name: str
    runs: int
    balls: int
    fours: int
    sixes: int
    strike_rate: float
    is_out: bool


class BowlerCard(BaseModel):
    player_id: int
    name: str
    overs: str
    runs_conceded: int
    wickets: int
    economy: float


class InningsScore(BaseModel):
    innings_id: int
    innings_number: int
    batting_team_id: int
    bowling_team_id: int
    runs: int
    wickets: int
    overs: str
    extras: int
    run_rate: float
    target: int | None = None
    required_run_rate: float | None = None
    is_closed: bool


class LiveScore(BaseModel):
    match_id: int
    status: MatchStatus
    overs_limit: int
    free_hit: bool = False  # next delivery is a free hit (after a no-ball)
    innings: list[InningsScore]


class Scorecard(BaseModel):
    match_id: int
    status: MatchStatus
    innings: list[dict]  # full per-innings batting/bowling cards
