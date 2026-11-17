"""Begleiter-Tier je Kind: Tier, Zubehör, Modus

Revision ID: f6a1c4e8b2d9
Revises: e5b9c3d7f2a4
Create Date: 2026-11-17 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f6a1c4e8b2d9"
down_revision: str | Sequence[str] | None = "e5b9c3d7f2a4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "family_members",
        sa.Column("companion_mode", sa.String(length=20), server_default="both", nullable=False),
    )
    op.create_table(
        "companions",
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("species", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=24), nullable=True),
        sa.Column("started_on", sa.Date(), nullable=False),
        sa.Column(
            "equipped",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["member_id"], ["family_members.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("member_id"),
    )
    op.create_table(
        "companion_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("item", sa.String(length=30), nullable=False),
        sa.Column("cost", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["member_id"], ["family_members.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("member_id", "item"),
    )
    op.create_index("ix_companion_items_member_id", "companion_items", ["member_id"])


def downgrade() -> None:
    op.drop_index("ix_companion_items_member_id", table_name="companion_items")
    op.drop_table("companion_items")
    op.drop_table("companions")
    op.drop_column("family_members", "companion_mode")
