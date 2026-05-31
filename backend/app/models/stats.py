"""Denormalized per-player, per-match performance aggregate.

Updated transactionally by the scoring engine on every ball so scorecards and
leaderboards read without re-aggregating the immutable `balls` log.
"""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class PlayerMatchStats(Base, TimestampMixin):
    __tablename__ = "player_match_stats"
    __table_args__ = (
        UniqueConstraint("match_id", "player_id", name="uq_match_player_stats"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )

    # Batting
    runs_scored: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    balls_faced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fours: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sixes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_out: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Bowling
    legal_balls_bowled: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    runs_conceded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wickets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Fielding
    catches: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    @property
    def strike_rate(self) -> float:
        return round(self.runs_scored / self.balls_faced * 100, 2) if self.balls_faced else 0.0

    @property
    def economy(self) -> float:
        overs = self.legal_balls_bowled / 6
        return round(self.runs_conceded / overs, 2) if overs else 0.0
