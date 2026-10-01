"""Putzplan

Revision ID: 8fc58f53970c
Revises: a1c4e7f2b9d3
Create Date: 2026-10-01 15:41:00.883708
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8fc58f53970c"
down_revision: str | Sequence[str] | None = "a1c4e7f2b9d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chore_rooms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("icon", sa.String(length=100), nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chore_rooms")),
    )
    op.create_index(
        "uq_chore_rooms_name_lower", "chore_rooms", [sa.literal_column("lower(name)")], unique=True
    )
    op.create_table(
        "chores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("icon", sa.String(length=100), nullable=False),
        sa.Column("interval_days", sa.SmallInteger(), nullable=False),
        sa.Column("anchor_date", sa.Date(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("interval_days > 0", name=op.f("ck_chores_interval_positive")),
        sa.ForeignKeyConstraint(
            ["room_id"],
            ["chore_rooms.id"],
            name=op.f("fk_chores_room_id_chore_rooms"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chores")),
    )
    op.create_index(op.f("ix_chores_room_id"), "chores", ["room_id"], unique=False)
    op.create_table(
        "chore_completions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("chore_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["chore_id"],
            ["chores.id"],
            name=op.f("fk_chore_completions_chore_id_chores"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["family_members.id"],
            name=op.f("fk_chore_completions_member_id_family_members"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chore_completions")),
        sa.UniqueConstraint("chore_id", "date", name=op.f("uq_chore_completions_chore_id")),
    )
    op.create_index(
        op.f("ix_chore_completions_member_id"), "chore_completions", ["member_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_chore_completions_member_id"), table_name="chore_completions")
    op.drop_table("chore_completions")
    op.drop_index(op.f("ix_chores_room_id"), table_name="chores")
    op.drop_table("chores")
    op.drop_index("uq_chore_rooms_name_lower", table_name="chore_rooms")
    op.drop_table("chore_rooms")
