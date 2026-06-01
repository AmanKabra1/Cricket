"""team vice-captain & wicket-keeper; flexible bowling style

Revision ID: b1a2c3d4e5f6
Revises: a848ec0d81f5
Create Date: 2026-06-01 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b1a2c3d4e5f6"
down_revision: Union[str, None] = "a848ec0d81f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_BOWLING = sa.Enum(
    "NONE", "FAST", "MEDIUM", "OFF_SPIN", "LEG_SPIN", "LEFT_ARM_SPIN", "LEFT_ARM_FAST",
    name="bowlingstyle",
)


def upgrade() -> None:
    op.add_column("teams", sa.Column("vice_captain_id", sa.Integer(), nullable=True))
    op.add_column("teams", sa.Column("wicket_keeper_id", sa.Integer(), nullable=True))
    # bowling_style: ENUM -> VARCHAR(40) so the UI can offer real bowling types.
    with op.batch_alter_table("players") as batch:
        batch.alter_column(
            "bowling_style",
            existing_type=_OLD_BOWLING,
            type_=sa.String(length=40),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("players") as batch:
        batch.alter_column(
            "bowling_style",
            existing_type=sa.String(length=40),
            type_=_OLD_BOWLING,
            existing_nullable=False,
        )
    op.drop_column("teams", "wicket_keeper_id")
    op.drop_column("teams", "vice_captain_id")
