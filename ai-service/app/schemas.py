"""Request/response models for the AI service.

The backend forwards the live-score payload it already builds, so these mirror
the relevant parts of the platform's scoreboard schema.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class InningsState(BaseModel):
    innings_number: int
    batting_team_id: int
    bowling_team_id: int
    runs: int
    wickets: int
    overs: str  # "12.3"
    run_rate: float = 0.0
    target: int | None = None
    required_run_rate: float | None = None
    is_closed: bool = False


class LiveScoreState(BaseModel):
    match_id: int
    overs_limit: int = 20
    innings: list[InningsState] = Field(default_factory=list)


class PredictionRequest(BaseModel):
    match_id: int
    live_score: LiveScoreState


class WinProbability(BaseModel):
    match_id: int
    available: bool = True
    model: str  # "heuristic" | "xgboost" | ...
    batting_team_id: int | None = None
    bowling_team_id: int | None = None
    batting_win_probability: float
    bowling_win_probability: float
    projected_score: int | None = None
    key_moments: list[str] = Field(default_factory=list)
    insight: str | None = None  # one-line natural-language read (LLM or template)


# ---- Best player ----
class PlayerStatLine(BaseModel):
    player_id: int
    name: str
    runs: int = 0
    balls_faced: int = 0
    strike_rate: float = 0.0
    wickets: int = 0
    economy: float = 0.0
    catches: int = 0


class BestPlayerRequest(BaseModel):
    players: list[PlayerStatLine]


class PlayerScore(BaseModel):
    player_id: int
    name: str
    performance_index: float


class BestPlayerResponse(BaseModel):
    ranked: list[PlayerScore]
    best: PlayerScore | None = None


# ---- Commentary ----
class CommentaryRequest(BaseModel):
    over: int
    ball: int
    runs: int = 0
    is_wicket: bool = False
    extra_type: str = "NONE"
    striker: str = "the batter"
    bowler: str = "the bowler"


class CommentaryResponse(BaseModel):
    text: str
    source: str  # "llm" | "template"


# ---- Match summary ----
class SummaryRequest(BaseModel):
    match_id: int
    team_a: str
    team_b: str
    result_text: str | None = None
    innings: list[InningsState] = Field(default_factory=list)
    top_performers: list[PlayerStatLine] = Field(default_factory=list)


class SummaryResponse(BaseModel):
    summary: str
    key_moments: list[str] = Field(default_factory=list)
    source: str


# ---- Player insights ----
class PlayerInsightRequest(BaseModel):
    name: str
    recent_scores: list[int] = Field(default_factory=list)  # last innings runs
    strike_rates: list[float] = Field(default_factory=list)
    wickets_recent: list[int] = Field(default_factory=list)


class PlayerInsightResponse(BaseModel):
    name: str
    form: str  # "hot" | "steady" | "cold" | "unknown"
    strengths: list[str]
    weaknesses: list[str]
    recent_form_index: float
