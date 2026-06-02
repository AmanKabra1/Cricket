"""innings.current_striker_id / current_non_striker_id (batters at the crease)

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-06-02 03:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("innings", sa.Column("current_striker_id", sa.Integer(), nullable=True))
    op.add_column("innings", sa.Column("current_non_striker_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("innings", "current_non_striker_id")
    op.drop_column("innings", "current_striker_id")
