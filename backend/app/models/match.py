"""Matches — the central scheduling/scoring entity."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import MatchStatus, TossDecision
from app.models.user import match_admins


class Match(Base, TimestampMixin):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    sport: Mapped[str] = mapped_column(String(32), default="cricket", nullable=False)
    tournament_id: Mapped[int | None] = mapped_column(
        ForeignKey("tournaments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    team_a_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False
    )
    team_b_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False
    )
    venue_id: Mapped[int | None] = mapped_column(
        ForeignKey("venues.id", ondelete="SET NULL"), nullable=True
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    overs_limit: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus), default=MatchStatus.SCHEDULED, nullable=False, index=True
    )

    toss_winner_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    toss_decision: Mapped[TossDecision | None] = mapped_column(
        Enum(TossDecision), nullable=True
    )
    winner_team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    result_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # True once a pre-match reminder email has been sent (avoids duplicates).
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Public visibility gate: a match-admin's match starts unapproved and is
    # hidden from the public home page until a super admin approves it. Super
    # admin matches (and tournament fixtures) are approved on creation.
    approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Which admin created the match (so super admins can see who's responsible).
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    team_a = relationship("Team", foreign_keys=[team_a_id], lazy="selectin")
    team_b = relationship("Team", foreign_keys=[team_b_id], lazy="selectin")
    venue = relationship("Venue", foreign_keys=[venue_id], lazy="selectin")
    innings = relationship(
        "Innings",
        back_populates="match",
        cascade="all, delete-orphan",
        order_by="Innings.innings_number",
        lazy="selectin",
    )
    admins = relationship(
        "User", secondary=match_admins, back_populates="managed_matches", lazy="selectin"
    )

    @property
    def admin_ids(self) -> list[int]:
        """User ids assigned to score this match (for the API/UI gate)."""
        return [a.id for a in self.admins]
