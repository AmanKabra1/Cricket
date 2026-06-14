"""Turn a live-score state into model features (stdlib-only)."""
from __future__ import annotations

from dataclasses import dataclass

from app.ai.schemas import InningsState, LiveScoreState


def overs_to_balls(overs: str) -> int:
    """'12.3' → 75 legal balls."""
    try:
        whole, _, part = overs.partition(".")
        return int(whole) * 6 + (int(part) if part else 0)
    except ValueError:
        return 0


@dataclass
class MatchFeatures:
    is_chase: bool
    runs: int
    wickets: int
    balls_bowled: int
    balls_left: int
    wickets_in_hand: int
    current_run_rate: float
    required_run_rate: float | None
    runs_needed: int | None
    target: int | None
    batting_team_id: int
    bowling_team_id: int

    def as_dict(self) -> dict[str, float]:
        return {
            "is_chase": float(self.is_chase),
            "runs": float(self.runs),
            "wickets": float(self.wickets),
            "balls_bowled": float(self.balls_bowled),
            "balls_left": float(self.balls_left),
            "wickets_in_hand": float(self.wickets_in_hand),
            "current_run_rate": self.current_run_rate,
            "required_run_rate": float(self.required_run_rate or 0.0),
            "runs_needed": float(self.runs_needed or 0.0),
        }


def extract_features(state: LiveScoreState) -> MatchFeatures | None:
    if not state.innings:
        return None
    inn: InningsState = state.innings[-1]
    balls_bowled = overs_to_balls(inn.overs)
    total_balls = state.overs_limit * 6
    balls_left = max(0, total_balls - balls_bowled)
    # Wickets in hand respects the actual squad size (6/8/11-a-side), not a
    # hard-coded 10. Falls back to 10 for older payloads without max_wickets.
    max_wickets = inn.max_wickets if inn.max_wickets else 10
    wickets_in_hand = max(0, max_wickets - inn.wickets)
    is_chase = inn.target is not None
    runs_needed = (inn.target - inn.runs) if inn.target is not None else None

    return MatchFeatures(
        is_chase=is_chase,
        runs=inn.runs,
        wickets=inn.wickets,
        balls_bowled=balls_bowled,
        balls_left=balls_left,
        wickets_in_hand=wickets_in_hand,
        current_run_rate=inn.run_rate,
        required_run_rate=inn.required_run_rate,
        runs_needed=runs_needed,
        target=inn.target,
        batting_team_id=inn.batting_team_id,
        bowling_team_id=inn.bowling_team_id,
    )
