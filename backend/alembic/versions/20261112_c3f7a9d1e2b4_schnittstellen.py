"""Schnittstellen: API-Schlüssel und Adresse des Bon-Druckers

Revision ID: c3f7a9d1e2b4
Revises: b5e8f2a1c3d7
Create Date: 2026-11-12 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3f7a9d1e2b4"
down_revision: str | Sequence[str] | None = "b5e8f2a1c3d7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "api_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("prefix", sa.String(length=12), nullable=False),
        sa.Column("scope", sa.String(length=10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_api_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_api_tokens_token_hash")),
    )
    op.add_column("families", sa.Column("print_url", sa.String(length=300), nullable=True))
    op.add_column(
        "families",
        sa.Column("print_width", sa.SmallInteger(), server_default="32", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("families", "print_width")
    op.drop_column("families", "print_url")
    op.drop_table("api_tokens")
