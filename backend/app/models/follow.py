"""A device (push token) following a team or tournament for notifications."""
from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class Follow(Base, TimestampMixin):
    __tablename__ = "follows"

    id: Mapped[int] = mapped_column(primary_key=True)
    # The Expo push token of the device that followed (anonymous spectators OK).
    token: Mapped[str] = mapped_column(String(256), index=True, nullable=False)
    team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=True, index=True
    )
    tournament_id: Mapped[int | None] = mapped_column(
        ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=True, index=True
    )
