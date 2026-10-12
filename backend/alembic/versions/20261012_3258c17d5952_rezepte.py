"""Rezepte: Zutaten, Schritte und Bewertung je Gericht

Revision ID: 3258c17d5952
Revises: 6092a0011beb
Create Date: 2026-10-12 10:27:38.471835
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "3258c17d5952"
down_revision: str | Sequence[str] | None = "6092a0011beb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "dishes",
        sa.Column(
            "ingredients",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
    )
    op.add_column(
        "dishes",
        sa.Column(
            "steps", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False
        ),
    )
    op.add_column("dishes", sa.Column("rating", sa.SmallInteger(), nullable=True))
    op.create_check_constraint("rating_range", "dishes", "rating BETWEEN 1 AND 5")


def downgrade() -> None:
    op.drop_constraint("rating_range", "dishes", type_="check")
    op.drop_column("dishes", "rating")
    op.drop_column("dishes", "steps")
    op.drop_column("dishes", "ingredients")
