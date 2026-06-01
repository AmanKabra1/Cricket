"""Cricket teams."""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    coach: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Captain references a player on this team; set after roster exists.
    captain_id: Mapped[int | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )
    # Vice-captain and wicket-keeper — plain ids (no DB FK to avoid extra
    # circular constraints; the app sets them to players on this team).
    vice_captain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wicket_keeper_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    players = relationship(
        "Player",
        back_populates="team",
        foreign_keys="Player.team_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    captain = relationship("Player", foreign_keys=[captain_id], post_update=True)
