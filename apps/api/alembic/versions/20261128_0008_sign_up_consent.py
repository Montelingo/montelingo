"""record parental consent and the privacy policy version on users

When the grown-up accepted the privacy policy at sign-up, and which version
(ADR 0008, #250). Both are nullable and nothing is filled in, so the accounts
that already exist are not given a consent they never gave.

Revision ID: 20261128_0008
Revises: 20261127_0007
Create Date: 2026-11-28 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261128_0008"
down_revision: str | None = "20261127_0007"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("consent_accepted_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("users", sa.Column("privacy_policy_version", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "privacy_policy_version")
    op.drop_column("users", "consent_accepted_at")
