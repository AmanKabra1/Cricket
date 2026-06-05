"""venues.created_by_id (admin ownership) — teams already have created_by

Revision ID: a2b3c4d5e6f7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-05 13:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable owner column — existing venues keep NULL (super-admin only). Plain
    # nullable col works on SQLite + MySQL/TiDB.
    op.add_column("venues", sa.Column("created_by_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("venues", "created_by_id")
