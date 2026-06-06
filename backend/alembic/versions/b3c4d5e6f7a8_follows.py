"""follows table (device follows a team/tournament for notifications)

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-06-06 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "follows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token", sa.String(length=256), nullable=False),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_follows_token", "follows", ["token"])
    op.create_index("ix_follows_team_id", "follows", ["team_id"])
    op.create_index("ix_follows_tournament_id", "follows", ["tournament_id"])


def downgrade() -> None:
    op.drop_index("ix_follows_tournament_id", table_name="follows")
    op.drop_index("ix_follows_team_id", table_name="follows")
    op.drop_index("ix_follows_token", table_name="follows")
    op.drop_table("follows")
