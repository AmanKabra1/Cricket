"""matches.created_by_id (which admin created the match)

Revision ID: a1b2c3d4e5f6
Revises: d0e1f2a3b4c5
Create Date: 2026-06-05 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable FK to users — existing matches keep NULL (creator unknown). No FK
    # constraint name fuss: a plain nullable column works on SQLite + MySQL/TiDB.
    op.add_column("matches", sa.Column("created_by_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "created_by_id")
