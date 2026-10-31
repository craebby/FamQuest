"""Termine nach Farbe: Farbe am Termin, Zuordnung von Farben je Kalender

Revision ID: a9d2c47e6f13
Revises: 7c3e91d0a4b2
Create Date: 2026-10-31 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a9d2c47e6f13"
down_revision: str | Sequence[str] | None = "7c3e91d0a4b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("calendar_events", sa.Column("color_id", sa.String(length=8), nullable=True))
    op.create_table(
        "calendar_color_rules",
        sa.Column("calendar_id", sa.Integer(), nullable=False),
        sa.Column("color_id", sa.String(length=8), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["calendar_id"], ["calendars.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["family_members.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("calendar_id", "color_id"),
    )
    # Die geladenen Termine haben noch keine Farbe: beim nächsten Durchlauf neu laden.
    op.execute("UPDATE calendars SET window_loaded_at = NULL")


def downgrade() -> None:
    op.drop_table("calendar_color_rules")
    op.drop_column("calendar_events", "color_id")
