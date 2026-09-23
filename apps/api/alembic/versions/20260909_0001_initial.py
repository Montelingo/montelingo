"""initial empty migration

Revision ID: 20260909_0001
Revises:
Create Date: 2026-09-09 00:00:00
"""

from collections.abc import Sequence

revision: str = "20260909_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
