"""Adresse der Druck-App für die Küchenansicht

Revision ID: d4a8b2c6e1f3
Revises: c3f7a9d1e2b4
Create Date: 2026-11-12 14:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d4a8b2c6e1f3"
down_revision: str | Sequence[str] | None = "c3f7a9d1e2b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("families", sa.Column("print_app_url", sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column("families", "print_app_url")
