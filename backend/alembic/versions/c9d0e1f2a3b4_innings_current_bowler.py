"""innings.current_bowler_id (bowler currently bowling)

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-06-02 04:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("innings", sa.Column("current_bowler_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("innings", "current_bowler_id")
