"""create account deletions

One row per deleted account: its random id and when it was deleted, so a
restore from an older backup can delete those accounts again (ADR 0008, #251).
The id identifies no one once the account is gone. Rows are purged 28 days
after deleted_at (#253), hence the index.

Revision ID: 20261128_0009
Revises: 20261128_0008
Create Date: 2026-11-28 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261128_0009"
down_revision: str | None = "20261128_0008"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "account_deletions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", name="pk_account_deletions"),
    )
    op.create_index(
        "ix_account_deletions_deleted_at", "account_deletions", ["deleted_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_account_deletions_deleted_at", table_name="account_deletions")
    op.drop_table("account_deletions")
