"""Performance index ranking players in a match (transparent weighted index)."""
from __future__ import annotations

from app.ai.schemas import BestPlayerRequest, BestPlayerResponse, PlayerScore


def _index(p) -> float:
    batting = p.runs * 1.0
    if p.balls_faced >= 6:
        batting += max(0.0, (p.strike_rate - 120.0)) * 0.10

    bowling = p.wickets * 20.0
    if p.economy > 0:
        bowling += (7.0 - p.economy) * 4.0

    fielding = p.catches * 8.0
    return round(batting + bowling + fielding, 2)


def rank(req: BestPlayerRequest) -> BestPlayerResponse:
    scored = [
        PlayerScore(player_id=p.player_id, name=p.name, performance_index=_index(p))
        for p in req.players
    ]
    scored.sort(key=lambda s: s.performance_index, reverse=True)
    return BestPlayerResponse(ranked=scored, best=scored[0] if scored else None)
