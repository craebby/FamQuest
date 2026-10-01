"""Zu erledigen

Revision ID: 6092a0011beb
Revises: c3a9e51d7b42
Create Date: 2026-10-01 19:44:08.039981
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6092a0011beb"
down_revision: str | Sequence[str] | None = "c3a9e51d7b42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "todos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("icon", sa.String(length=100), nullable=False),
        sa.Column("done_date", sa.Date(), nullable=True),
        sa.Column("done_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["done_by"],
            ["family_members.id"],
            name=op.f("fk_todos_done_by_family_members"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_todos")),
    )
    op.create_index(op.f("ix_todos_done_by"), "todos", ["done_by"], unique=False)
    op.create_index(op.f("ix_todos_done_date"), "todos", ["done_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_todos_done_date"), table_name="todos")
    op.drop_index(op.f("ix_todos_done_by"), table_name="todos")
    op.drop_table("todos")
