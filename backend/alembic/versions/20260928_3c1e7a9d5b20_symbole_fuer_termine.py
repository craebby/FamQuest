"""Symbole für Termine

Revision ID: 3c1e7a9d5b20
Revises: da71783fb923
Create Date: 2026-09-28 20:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "3c1e7a9d5b20"
down_revision: str | Sequence[str] | None = "da71783fb923"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "families",
        sa.Column("event_symbols", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "family_members",
        sa.Column("event_symbols", sa.Boolean(), server_default="false", nullable=False),
    )
    # Vorhandene Kinder bekommen Symbole, Erwachsene nicht (wie bei neu angelegten Personen).
    op.execute("UPDATE family_members SET event_symbols = true WHERE role = 'child'")


def downgrade() -> None:
    op.drop_column("family_members", "event_symbols")
    op.drop_column("families", "event_symbols")
