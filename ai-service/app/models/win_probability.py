"""Win-probability + projected-score predictor.

Two-tier design:
  1. If a trained model artifact (models/win_probability.joblib) exists, use it.
  2. Otherwise fall back to a transparent cricket heuristic.

This lets the platform ship predictions on day one and swap in a trained
XGBoost/LightGBM model later (see train/train_win_probability.py) with zero API
changes. The heuristic encodes the obvious cricketing intuition: in a chase,
your odds rise with a healthy run-rate cushion and wickets in hand, and collapse
as balls and wickets run out.
"""
from __future__ import annotations

import math
import os

from app.config import settings
from app.features import MatchFeatures, extract_features
from app.schemas import LiveScoreState, WinProbability

_FEATURE_ORDER = [
    "is_chase", "runs", "wickets", "balls_bowled", "balls_left",
    "wickets_in_hand", "current_run_rate", "required_run_rate", "runs_needed",
]

_model = None
_model_loaded = False


def _sigmoid(x: float) -> float:
    if x < -60:
        return 0.0
    if x > 60:
        return 1.0
    return 1.0 / (1.0 + math.exp(-x))


def _load_model():
    global _model, _model_loaded
    if _model_loaded:
        return _model
    _model_loaded = True
    if not settings.USE_TRAINED_MODEL:  # heuristic by default — see config
        return None
    path = os.path.join(settings.MODEL_DIR, "win_probability.joblib")
    if os.path.exists(path):
        try:
            import joblib  # noqa: PLC0415

            _model = joblib.load(path)
        except Exception:  # noqa: BLE001
            _model = None
    return _model


def _heuristic_chase_prob(f: MatchFeatures) -> float:
    # Terminal states.
    if f.runs_needed is not None and f.runs_needed <= 0:
        return 1.0
    if f.balls_left <= 0 or f.wickets_in_hand <= 0:
        return 0.0

    crr = f.current_run_rate
    rrr = f.required_run_rate or 0.0
    rate_cushion = crr - rrr  # positive → batting side comfortable

    # Wickets-in-hand term centred at 5; resource term shrinks late.
    wkt_term = (f.wickets_in_hand - 5) / 5.0
    # Difficulty of the ask: runs needed per remaining wicket-ball resource.
    pressure = (f.runs_needed or 0) / max(1.0, f.balls_left) * 6.0  # needed RR
    pressure_term = (8.0 - pressure) / 8.0  # >0 when ask is below ~8 rpo

    z = 1.15 * rate_cushion + 0.9 * wkt_term + 0.8 * pressure_term
    return max(0.02, min(0.98, _sigmoid(z)))


def _first_innings_prob_and_projection(f: MatchFeatures) -> tuple[float, int]:
    # Project final score: runs so far + expected runs from remaining balls,
    # dampened by wickets lost (a fragile side won't sustain the rate).
    crr = f.current_run_rate or 6.0
    resource = f.wickets_in_hand / 10.0
    projected = f.runs + (f.balls_left / 6.0) * crr * (0.6 + 0.4 * resource)
    projected = int(round(projected))

    # Win prob vs a par benchmark of ~7.5 runs/over for the format.
    par = 7.5 * (f.balls_bowled + f.balls_left) / 6.0
    edge = (projected - par) / max(20.0, par)
    prob = max(0.1, min(0.9, _sigmoid(3.0 * edge)))
    return prob, projected


def _key_moments(f: MatchFeatures) -> list[str]:
    out: list[str] = []
    if f.is_chase and f.runs_needed is not None:
        out.append(f"Need {f.runs_needed} from {f.balls_left} balls with {f.wickets_in_hand} wickets in hand.")
        if (f.required_run_rate or 0) > 12:
            out.append("Asking rate has climbed above 12 — boundaries are now essential.")
    if f.wickets_in_hand <= 3:
        out.append("Lower order exposed — a single wicket could swing it.")
    if f.current_run_rate >= 10:
        out.append("Batting side scoring at a run a ball or better.")
    return out or ["Match evenly poised."]


def _insight(f: MatchFeatures, batting_prob: float, projected: int | None) -> str:
    """One-line natural-language read — Gemini/OpenAI if a key is set, else a
    deterministic template. No team names (the AI service only has ids)."""
    bp = int(round(batting_prob * 100))
    if f.is_chase and f.runs_needed is not None:
        facts = (
            f"Run chase: the batting side need {f.runs_needed} from {f.balls_left} balls, "
            f"{f.wickets_in_hand} wickets in hand, required run rate "
            f"{(f.required_run_rate or 0):.1f}; their win probability is {bp}%."
        )
    else:
        facts = (
            f"First innings: the batting side are {f.runs}/{f.wickets}, projected ~{projected}, "
            f"run rate {f.current_run_rate:.1f}; their win probability is {bp}%."
        )

    try:
        from app.services.llm import complete as _complete  # noqa: PLC0415

        text = _complete(
            "You are a punchy cricket analyst. In ONE sentence (max 25 words) give an "
            "insight on this situation. Say 'the batting side' / 'the bowling side' (no "
            "team names). Situation: " + facts
        )
        if text:
            return text.split("\n")[0].strip()
    except Exception:  # noqa: BLE001 — never let the insight break a prediction
        pass

    # Template fallback.
    if bp >= 65:
        mood = "the batting side are well on top"
    elif bp >= 53:
        mood = "the batting side hold a slight edge"
    elif bp >= 47:
        mood = "it's evenly poised"
    elif bp >= 35:
        mood = "the bowling side have the upper hand"
    else:
        mood = "the bowling side are firmly in control"
    if f.is_chase and f.runs_needed is not None:
        return f"Need {f.runs_needed} off {f.balls_left} with {f.wickets_in_hand} in hand — {mood}."
    return f"Projected around {projected}; {mood}."


def predict(state: LiveScoreState) -> WinProbability:
    f = extract_features(state)
    if f is None:
        return WinProbability(
            match_id=state.match_id,
            available=False,
            model="none",
            batting_win_probability=0.5,
            bowling_win_probability=0.5,
            key_moments=["Match not started."],
        )

    model = _load_model()

    # Always compute a projected score — the trained model only outputs a
    # probability, so without this the projection (and its insight line) is None.
    if f.is_chase:
        heuristic_prob, projected = _heuristic_chase_prob(f), f.target
    else:
        heuristic_prob, projected = _first_innings_prob_and_projection(f)

    if model is not None:
        try:
            row = [[f.as_dict()[k] for k in _FEATURE_ORDER]]
            batting_prob = float(model.predict_proba(row)[0][1])
            model_name = type(model).__name__
        except Exception:  # noqa: BLE001
            batting_prob, model_name = heuristic_prob, "heuristic"
    else:
        batting_prob, model_name = heuristic_prob, "heuristic"

    batting_prob = round(batting_prob, 3)
    return WinProbability(
        match_id=state.match_id,
        model=model_name,
        batting_team_id=f.batting_team_id,
        bowling_team_id=f.bowling_team_id,
        batting_win_probability=batting_prob,
        bowling_win_probability=round(1.0 - batting_prob, 3),
        projected_score=projected,
        key_moments=_key_moments(f),
        insight=_insight(f, batting_prob, projected),
    )
