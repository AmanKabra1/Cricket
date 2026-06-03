"""Export labelled ball-by-ball rows for training the win-probability model.

For every completed match with a decided winner, we replay each innings ball by
ball, snapshot the same features the AI service uses to predict, and label the
row with whether the batting side eventually WON the match. Feeding these to
train/train_win_probability.py upgrades the live heuristic to a learned model.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ExtraType, MatchStatus, WicketType
from app.models.match import Match

# Same order/names the model is served with (app.models.win_probability).
FEATURE_KEYS = [
    "is_chase", "runs", "wickets", "balls_bowled", "balls_left",
    "wickets_in_hand", "current_run_rate", "required_run_rate", "runs_needed",
]


async def export_training_rows(db: AsyncSession) -> list[dict]:
    matches = (
        await db.scalars(
            select(Match).where(
                Match.status == MatchStatus.COMPLETED,
                Match.winner_team_id.is_not(None),
            )
        )
    ).all()

    rows: list[dict] = []
    for m in matches:
        innings = sorted(m.innings, key=lambda i: i.innings_number)
        if not innings:
            continue
        first_total = innings[0].total_runs
        for idx, inn in enumerate(innings):
            is_chase = idx >= 1
            target = first_total + 1 if is_chase else None
            label = 1 if m.winner_team_id == inn.batting_team_id else 0

            runs = wkts = legal = 0
            for b in sorted(inn.balls, key=lambda x: x.sequence):
                penalty = 1 if b.extra_type in (ExtraType.WIDE, ExtraType.NO_BALL) else 0
                runs += b.runs_batsman + b.extra_runs + penalty
                if b.is_legal_delivery:
                    legal += 1
                if b.is_wicket and b.wicket_type != WicketType.RETIRED_HURT:
                    wkts += 1

                balls_left = max(0, m.overs_limit * 6 - legal)
                wih = max(0, 10 - wkts)
                crr = round(runs / (legal / 6), 3) if legal else 0.0
                if is_chase and target is not None and balls_left > 0:
                    needed = max(0, target - runs)
                    rrr = round(needed / (balls_left / 6), 3)
                else:
                    needed, rrr = 0, 0.0

                rows.append(
                    {
                        "is_chase": 1.0 if is_chase else 0.0,
                        "runs": float(runs),
                        "wickets": float(wkts),
                        "balls_bowled": float(legal),
                        "balls_left": float(balls_left),
                        "wickets_in_hand": float(wih),
                        "current_run_rate": crr,
                        "required_run_rate": rrr,
                        "runs_needed": float(needed),
                        "label": label,
                    }
                )
    return rows
