"""Ball-by-ball record — the immutable event log of an innings."""
from __future__ import annotations

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ExtraType, WicketType


class Ball(Base, TimestampMixin):
    __tablename__ = "balls"

    id: Mapped[int] = mapped_column(primary_key=True)
    innings_id: Mapped[int] = mapped_column(
        ForeignKey("innings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Monotonic per innings — supports ordering and undo of the last delivery.
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    over_number: Mapped[int] = mapped_column(Integer, nullable=False)
    ball_in_over: Mapped[int] = mapped_column(Integer, nullable=False)

    striker_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="RESTRICT"), nullable=False
    )
    non_striker_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="RESTRICT"), nullable=False
    )
    bowler_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="RESTRICT"), nullable=False
    )

    runs_batsman: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    extra_type: Mapped[ExtraType] = mapped_column(
        Enum(ExtraType), default=ExtraType.NONE, nullable=False
    )
    extra_runs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_wicket: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    wicket_type: Mapped[WicketType] = mapped_column(
        Enum(WicketType), default=WicketType.NONE, nullable=False
    )
    dismissed_player_id: Mapped[int | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )
    fielder_id: Mapped[int | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )

    is_legal_delivery: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    commentary: Mapped[str | None] = mapped_column(String(512), nullable=True)

    innings = relationship("Innings", back_populates="balls")
