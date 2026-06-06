"""Recompute "won by N wickets" text using each team's real squad size

One-time data fix: older completed matches stored "won by N wickets" using a
hardcoded 10 wickets. Recompute those messages for the chasing team's actual
squad size (a 6-a-side win is "by up to 5 wickets"). Only rows whose result
text mentions "wicket" are touched — runs / tie / manually-entered results are
left exactly as they are.

Revision ID: a7b8c9d0e1f2
Revises: f5a6b7c8d9e0
Create Date: 2026-06-02 02:00:00
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This is a one-time backfill for EXISTING matches. On a fresh database
    # (CI / a brand-new deploy) there are none, so skip — this also avoids
    # loading the live ORM Match model here, whose columns (e.g. created_by_id,
    # added by a later revision) don't exist at this point in history yet.
    bind = op.get_bind()
    if not bind.execute(text("SELECT COUNT(*) FROM matches")).scalar():
        return

    # Imported here (not at module top) so the migration only pulls in app code
    # when actually run.
    from app.models.enums import MatchStatus
    from app.models.match import Match
    from app.models.player import Player
    from app.services.scoring_engine import finalize_match_result

    session = Session(bind=bind)
    try:
        matches = session.scalars(
            select(Match).where(Match.status == MatchStatus.COMPLETED)
        ).all()
        for m in matches:
            # Only fix the team-size-dependent "by wickets" messages.
            if not m.result_text or "wicket" not in m.result_text.lower():
                continue
            if len(m.innings) < 2:
                continue
            chasing_team = m.innings[1].batting_team_id
            size = session.scalar(
                select(func.count(Player.id)).where(Player.team_id == chasing_team)
            ) or 11
            try:
                finalize_match_result(m, chasing_squad_size=size)
            except Exception:  # noqa: BLE001 — never let one odd match fail the deploy
                continue
        session.commit()
    finally:
        session.close()


def downgrade() -> None:
    # Data-only fix; the previous (incorrect) text can't be reconstructed.
    pass
