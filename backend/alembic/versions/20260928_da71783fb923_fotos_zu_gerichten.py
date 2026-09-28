"""Fotos zu Gerichten

Revision ID: da71783fb923
Revises: ba2f48167fc9
Create Date: 2026-09-28 16:59:56.741968
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "da71783fb923"
down_revision: str | Sequence[str] | None = "ba2f48167fc9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("dishes", sa.Column("image", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("dishes", "image")
