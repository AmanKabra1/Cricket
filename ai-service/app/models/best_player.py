"""Performance index ranking players in a match.

A transparent weighted index over batting, bowling, and fielding contributions.
The weights are tuned for short-format local cricket and documented inline so
organisers understand why a player tops the list — replaceable by a learned
model once enough labelled "player of the match" data exists.
"""
from __future__ import annotations

from app.schemas import BestPlayerRequest, BestPlayerResponse, PlayerScore


def _index(p) -> float:
    # Batting: runs are the base; reward scoring quickly above a 120 SR par.
    batting = p.runs * 1.0
    if p.balls_faced >= 6:
        batting += max(0.0, (p.strike_rate - 120.0)) * 0.10

    # Bowling: wickets are premium; reward economy under 7 rpo.
    bowling = p.wickets * 20.0
    if p.economy > 0:
        bowling += (7.0 - p.economy) * 4.0

    # Fielding.
    fielding = p.catches * 8.0

    return round(batting + bowling + fielding, 2)


def rank(req: BestPlayerRequest) -> BestPlayerResponse:
    scored = [
        PlayerScore(player_id=p.player_id, name=p.name, performance_index=_index(p))
        for p in req.players
    ]
    scored.sort(key=lambda s: s.performance_index, reverse=True)
    return BestPlayerResponse(ranked=scored, best=scored[0] if scored else None)
