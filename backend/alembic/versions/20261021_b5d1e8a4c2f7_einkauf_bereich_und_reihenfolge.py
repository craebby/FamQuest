"""Einkauf: Bereich und Reihenfolge je Artikel

Revision ID: b5d1e8a4c2f7
Revises: a762673f6889
Create Date: 2026-10-21 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b5d1e8a4c2f7"
down_revision: str | Sequence[str] | None = "a762673f6889"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("shopping_items", sa.Column("area", sa.String(length=20), nullable=True))
    op.add_column("shopping_items", sa.Column("position", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("shopping_items", "position")
    op.drop_column("shopping_items", "area")
