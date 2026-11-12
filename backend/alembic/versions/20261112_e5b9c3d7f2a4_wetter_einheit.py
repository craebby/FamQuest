"""Einheit der Temperatur (Celsius oder Fahrenheit)

Revision ID: e5b9c3d7f2a4
Revises: d4a8b2c6e1f3
Create Date: 2026-11-12 19:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e5b9c3d7f2a4"
down_revision: str | Sequence[str] | None = "d4a8b2c6e1f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "families",
        sa.Column("weather_unit", sa.String(length=10), server_default="celsius", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("families", "weather_unit")
