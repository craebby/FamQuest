"""Startseite: Woche rollend oder Montag bis Sonntag

Revision ID: a1c4e7f2b9d3
Revises: d335833d3b28
Create Date: 2026-09-30 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1c4e7f2b9d3"
down_revision: str | Sequence[str] | None = "d335833d3b28"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "families",
        sa.Column("home_week", sa.String(length=10), server_default="rolling", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("families", "home_week")
