"""Innings — one batting effort within a match."""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Innings(Base, TimestampMixin):
    __tablename__ = "innings"
    __table_args__ = (
        UniqueConstraint("match_id", "innings_number", name="uq_match_innings"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    innings_number: Mapped[int] = mapped_column(Integer, nullable=False)
    batting_team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False
    )
    bowling_team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False
    )

    total_runs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_wickets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Count of *legal* deliveries; overs string is derived (balls // 6 . balls % 6).
    legal_balls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    extras_wide: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    extras_no_ball: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    extras_bye: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    extras_leg_bye: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # The two batters currently at the crease (so a freshly-sent-in batter shows
    # in the scorecard at 0* even before facing a ball). Plain ints, not FKs, to
    # keep deletes simple.
    current_striker_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_non_striker_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    match = relationship("Match", back_populates="innings")
    balls = relationship(
        "Ball",
        back_populates="innings",
        cascade="all, delete-orphan",
        order_by="Ball.sequence",
        lazy="selectin",
    )

    @property
    def total_extras(self) -> int:
        return (
            self.extras_wide
            + self.extras_no_ball
            + self.extras_bye
            + self.extras_leg_bye
        )

    @property
    def overs_str(self) -> str:
        return f"{self.legal_balls // 6}.{self.legal_balls % 6}"
