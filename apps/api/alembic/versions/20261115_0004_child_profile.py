"""add the child profile to learning profiles

The child's first name, age band and animal buddy (#117). Every column is
nullable and nothing is filled in: existing profiles are set up by the
grown-up the next time they open the app.

Revision ID: 20261115_0004
Revises: 20261018_0003
Create Date: 2026-11-15 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261115_0004"
down_revision: str | None = "20261018_0003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("learning_profiles", sa.Column("name", sa.Text(), nullable=True))
    op.add_column("learning_profiles", sa.Column("age_band", sa.Text(), nullable=True))
    op.add_column("learning_profiles", sa.Column("avatar", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_learning_profiles_name_length",
        "learning_profiles",
        "char_length(name) BETWEEN 1 AND 30",
    )
    op.create_check_constraint(
        "ck_learning_profiles_age_band",
        "learning_profiles",
        "age_band IN ('3-4', '5-6', '7')",
    )
    op.create_check_constraint(
        "ck_learning_profiles_avatar",
        "learning_profiles",
        "avatar IN ('fox', 'bear', 'bunny', 'frog', 'owl', 'cat')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_learning_profiles_avatar", "learning_profiles", type_="check")
    op.drop_constraint("ck_learning_profiles_age_band", "learning_profiles", type_="check")
    op.drop_constraint("ck_learning_profiles_name_length", "learning_profiles", type_="check")
    op.drop_column("learning_profiles", "avatar")
    op.drop_column("learning_profiles", "age_band")
    op.drop_column("learning_profiles", "name")
