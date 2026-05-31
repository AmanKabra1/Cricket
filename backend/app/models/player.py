"""Players belonging to teams."""
from __future__ import annotations

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import BattingStyle, BowlingStyle, PlayerRole


class Player(Base, TimestampMixin):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    batting_style: Mapped[BattingStyle] = mapped_column(
        Enum(BattingStyle), default=BattingStyle.RIGHT_HAND, nullable=False
    )
    bowling_style: Mapped[BowlingStyle] = mapped_column(
        Enum(BowlingStyle), default=BowlingStyle.NONE, nullable=False
    )
    role: Mapped[PlayerRole] = mapped_column(
        Enum(PlayerRole), default=PlayerRole.BATSMAN, nullable=False
    )
    jersey_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    team = relationship("Team", back_populates="players", foreign_keys=[team_id])
