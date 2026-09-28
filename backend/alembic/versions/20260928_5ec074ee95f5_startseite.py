"""Startseite: Kacheln und Reihenfolge

Revision ID: 5ec074ee95f5
Revises: c7d8ccb2944c
Create Date: 2026-09-28 08:43:18.769337
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "5ec074ee95f5"
down_revision: str | Sequence[str] | None = "c7d8ccb2944c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "families", sa.Column("home_layout", postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("families", "home_layout")
