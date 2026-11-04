"""Einkauf: aus welchen Rezepten ein Artikel auf die Liste kam

Revision ID: b5e8f2a1c3d7
Revises: a9d2c47e6f13
Create Date: 2026-11-04 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b5e8f2a1c3d7"
down_revision: str | Sequence[str] | None = "a9d2c47e6f13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("shopping_items", sa.Column("recipes", sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column("shopping_items", "recipes")
