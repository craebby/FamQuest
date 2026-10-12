"""Variante je Essensplan-Eintrag

Revision ID: a762673f6889
Revises: 757e2fbfd6e2
Create Date: 2026-10-12 13:56:54.646079
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a762673f6889"
down_revision: str | Sequence[str] | None = "757e2fbfd6e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("meal_plan_entries", sa.Column("note", sa.String(length=100), nullable=True))
    op.add_column(
        "meal_plan_entries",
        sa.Column("variant_ingredients", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "meal_plan_entries",
        sa.Column("variant_steps", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "meal_plan_entries", sa.Column("variant_servings", sa.SmallInteger(), nullable=True)
    )
    op.create_check_constraint(
        "variant_servings_range", "meal_plan_entries", "variant_servings BETWEEN 1 AND 50"
    )


def downgrade() -> None:
    op.drop_constraint("variant_servings_range", "meal_plan_entries", type_="check")
    op.drop_column("meal_plan_entries", "variant_servings")
    op.drop_column("meal_plan_entries", "variant_steps")
    op.drop_column("meal_plan_entries", "variant_ingredients")
    op.drop_column("meal_plan_entries", "note")
