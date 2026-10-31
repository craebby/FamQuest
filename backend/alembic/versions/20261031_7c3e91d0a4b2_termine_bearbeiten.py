"""Termine bearbeiten: Schreibzugriff je Verbindung, Rolle je Kalender, Serien-Kennzeichen

Revision ID: 7c3e91d0a4b2
Revises: 315ae6da1816
Create Date: 2026-10-31 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7c3e91d0a4b2"
down_revision: str | Sequence[str] | None = "315ae6da1816"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "calendar_connections",
        sa.Column("can_write", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column("calendars", sa.Column("access_role", sa.String(length=20), nullable=True))
    op.add_column(
        "calendar_events",
        sa.Column("recurring", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("calendar_events", "recurring")
    op.drop_column("calendars", "access_role")
    op.drop_column("calendar_connections", "can_write")
