"""more than one player per account

ADR 0007 (#182): an account may have up to 4 learning profiles ("players"),
and each auth session plays as one of them. Existing sessions play as their
account's one profile, so existing accounts keep their child.

Revision ID: 20261122_0006
Revises: 20261117_0005
Create Date: 2026-11-22 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261122_0006"
down_revision: str | None = "20261117_0005"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_learning_profiles_user_id", "learning_profiles", type_="unique")
    # The unique constraint was the only index on the column, and every
    # request looks an account's players up by it.
    op.create_index("ix_learning_profiles_user_id", "learning_profiles", ["user_id"])
    op.add_column(
        "learning_profiles",
        sa.Column("last_selected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "auth_sessions",
        sa.Column("active_learning_profile_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_auth_sessions_active_learning_profile_id_learning_profiles",
        "auth_sessions",
        "learning_profiles",
        ["active_learning_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        """
        UPDATE auth_sessions
        SET active_learning_profile_id = learning_profiles.id
        FROM learning_profiles
        WHERE learning_profiles.user_id = auth_sessions.user_id
        """
    )


def downgrade() -> None:
    # Only one player per account fits the old model: keep each account's oldest.
    op.execute(
        """
        DELETE FROM learning_profiles
        WHERE id IN (
            SELECT id FROM (
                SELECT id, row_number() OVER (
                    PARTITION BY user_id ORDER BY created_at, id
                ) AS position
                FROM learning_profiles
            ) AS ranked
            WHERE position > 1
        )
        """
    )
    op.drop_constraint(
        "fk_auth_sessions_active_learning_profile_id_learning_profiles",
        "auth_sessions",
        type_="foreignkey",
    )
    op.drop_column("auth_sessions", "active_learning_profile_id")
    op.drop_column("learning_profiles", "last_selected_at")
    op.drop_index("ix_learning_profiles_user_id", table_name="learning_profiles")
    op.create_unique_constraint("uq_learning_profiles_user_id", "learning_profiles", ["user_id"])
