"""Player insights: form classification + strengths/weaknesses from recent data.

Heuristic and explainable. With more historical data this becomes the natural
home for a clustering / trend model, but the interface stays the same.
"""
from __future__ import annotations

from app.schemas import PlayerInsightRequest, PlayerInsightResponse


def _avg(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def generate(req: PlayerInsightRequest) -> PlayerInsightResponse:
    avg_runs = _avg([float(x) for x in req.recent_scores])
    avg_sr = _avg(req.strike_rates)
    avg_wkts = _avg([float(x) for x in req.wickets_recent])

    strengths: list[str] = []
    weaknesses: list[str] = []

    if avg_runs >= 35:
        strengths.append("Consistent run-scorer")
    elif req.recent_scores and avg_runs < 15:
        weaknesses.append("Lean run of scores with the bat")

    if avg_sr >= 130:
        strengths.append("Attacking strike rate")
    elif req.strike_rates and avg_sr < 100:
        weaknesses.append("Slow scoring under pressure")

    if avg_wkts >= 1.5:
        strengths.append("Regular wicket-taker")

    # Form index: weighted recent trend (last innings weighted most).
    def trend(values: list[float]) -> float:
        if not values:
            return 0.0
        weights = list(range(1, len(values) + 1))
        return sum(v * w for v, w in zip(values, weights)) / sum(weights)

    runs_trend = trend([float(x) for x in req.recent_scores])
    form_index = round(runs_trend + avg_wkts * 20, 2)

    if form_index >= 40:
        form = "hot"
    elif form_index >= 20:
        form = "steady"
    elif req.recent_scores or req.wickets_recent:
        form = "cold"
    else:
        form = "unknown"

    return PlayerInsightResponse(
        name=req.name,
        form=form,
        strengths=strengths or ["Building a record"],
        weaknesses=weaknesses or ["No notable weaknesses in recent data"],
        recent_form_index=form_index,
    )
