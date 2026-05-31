"""Tournaments and per-team standings."""
from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Enum, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import TournamentFormat, TournamentStatus


class Tournament(Base, TimestampMixin):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    format: Mapped[TournamentFormat] = mapped_column(
        Enum(TournamentFormat), default=TournamentFormat.LEAGUE, nullable=False
    )
    status: Mapped[TournamentStatus] = mapped_column(
        Enum(TournamentStatus), default=TournamentStatus.PENDING, nullable=False
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    standings = relationship(
        "TournamentTeam",
        back_populates="tournament",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class TournamentTeam(Base, TimestampMixin):
    """A team's standing within a tournament (points table row)."""

    __tablename__ = "tournament_teams"
    __table_args__ = (
        UniqueConstraint("tournament_id", "team_id", name="uq_tournament_team"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    played: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    won: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tied: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    no_result: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    net_run_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    tournament = relationship("Tournament", back_populates="standings")
    team = relationship("Team", lazy="selectin")
