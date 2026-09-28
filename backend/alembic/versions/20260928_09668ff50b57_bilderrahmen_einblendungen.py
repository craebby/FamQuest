"""Bilderrahmen: Einblendungen

Revision ID: 09668ff50b57
Revises: 705d6d50e3a9
Create Date: 2026-09-28 14:51:59.959881
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "09668ff50b57"
down_revision: str | Sequence[str] | None = "705d6d50e3a9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "families",
        sa.Column("frame_settings", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("families", "frame_settings")
