"""Portionen je Rezept

Revision ID: 757e2fbfd6e2
Revises: 3258c17d5952
Create Date: 2026-10-12 11:21:30.008877
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "757e2fbfd6e2"
down_revision: str | Sequence[str] | None = "3258c17d5952"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("dishes", sa.Column("servings", sa.SmallInteger(), nullable=True))
    op.create_check_constraint("servings_range", "dishes", "servings BETWEEN 1 AND 50")


def downgrade() -> None:
    op.drop_constraint("servings_range", "dishes", type_="check")
    op.drop_column("dishes", "servings")
