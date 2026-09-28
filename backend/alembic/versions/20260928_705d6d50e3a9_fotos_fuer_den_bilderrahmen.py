"""Fotos für den Bilderrahmen

Revision ID: 705d6d50e3a9
Revises: 075cb1d2b6c3
Create Date: 2026-09-28 14:10:09.214669
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "705d6d50e3a9"
down_revision: str | Sequence[str] | None = "075cb1d2b6c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("file_key", sa.String(length=32), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("taken_at", sa.DateTime(), nullable=True),
        sa.Column("visible", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_photos")),
        sa.UniqueConstraint("file_key", name=op.f("uq_photos_file_key")),
    )


def downgrade() -> None:
    op.drop_table("photos")
