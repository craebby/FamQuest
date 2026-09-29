"""Einkaufsliste

Revision ID: d335833d3b28
Revises: 3c1e7a9d5b20
Create Date: 2026-09-29 12:15:44.267722
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d335833d3b28"
down_revision: str | Sequence[str] | None = "3c1e7a9d5b20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "shopping_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("icon", sa.String(length=100), nullable=False),
        sa.Column("on_list", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("note", sa.String(length=60), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("times_added", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_shopping_items")),
    )
    op.create_index(
        "uq_shopping_items_name_lower",
        "shopping_items",
        [sa.literal_column("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_shopping_items_name_lower", table_name="shopping_items")
    op.drop_table("shopping_items")
