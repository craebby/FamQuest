"""Essensplan

Revision ID: ba2f48167fc9
Revises: 09668ff50b57
Create Date: 2026-09-28 16:25:47.656485
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "ba2f48167fc9"
down_revision: str | Sequence[str] | None = "09668ff50b57"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dishes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("icon", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_dishes")),
    )
    op.create_index(
        "uq_dishes_name_lower", "dishes", [sa.literal_column("lower(name)")], unique=True
    )
    op.create_table(
        "meal_plan_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("meal", sa.String(length=20), nullable=False),
        sa.Column("dish_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["dish_id"], ["dishes.id"], name=op.f("fk_meal_plan_entries_dish_id_dishes")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_meal_plan_entries")),
        sa.UniqueConstraint("date", "meal", name=op.f("uq_meal_plan_entries_date")),
    )
    op.create_index(
        op.f("ix_meal_plan_entries_dish_id"), "meal_plan_entries", ["dish_id"], unique=False
    )
    op.add_column(
        "families",
        sa.Column("meal_settings", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("families", "meal_settings")
    op.drop_index(op.f("ix_meal_plan_entries_dish_id"), table_name="meal_plan_entries")
    op.drop_table("meal_plan_entries")
    op.drop_index("uq_dishes_name_lower", table_name="dishes")
    op.drop_table("dishes")
