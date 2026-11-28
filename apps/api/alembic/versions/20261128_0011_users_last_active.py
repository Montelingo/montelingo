"""track when an account was last used, and its inactivity warning

users.last_active_at drives the deletion of inactive accounts (ADR 0008,
#254). Existing accounts get the start of their newest session, or their
created_at if they have none: auth_sessions.last_seen_at is never updated, so
it says nothing more. users.inactivity_warning_sent_at is set when the warning
email goes out.

Revision ID: 20261128_0011
Revises: 20261128_0010
Create Date: 2026-11-28 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261128_0011"
down_revision: str | None = "20261128_0010"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "UPDATE users SET last_active_at = COALESCE("
        "(SELECT max(auth_sessions.created_at) FROM auth_sessions"
        " WHERE auth_sessions.user_id = users.id), users.created_at)"
    )
    op.alter_column("users", "last_active_at", nullable=False, server_default=sa.text("now()"))
    op.add_column(
        "users",
        sa.Column("inactivity_warning_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_last_active_at", "users", ["last_active_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_last_active_at", table_name="users")
    op.drop_column("users", "inactivity_warning_sent_at")
    op.drop_column("users", "last_active_at")
