"""create heart events

One row per heart a player earns by replaying a lesson or a game, or by
practising (ADR 0009, #272).

Revision ID: 20261127_0007
Revises: 20261122_0006
Create Date: 2026-11-27 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261127_0007"
down_revision: str | None = "20261122_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "heart_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("learning_profile_id", sa.Uuid(), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("chapter_id", sa.Uuid(), nullable=True),
        sa.Column("game", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "source IN ('lesson', 'game', 'practice')", name="ck_heart_events_source"
        ),
        sa.CheckConstraint("game IN ('memory', 'match')", name="ck_heart_events_game"),
        sa.CheckConstraint(
            "(source = 'lesson' AND chapter_id IS NOT NULL AND game IS NULL)"
            " OR (source = 'game' AND chapter_id IS NOT NULL AND game IS NOT NULL)"
            " OR (source = 'practice' AND chapter_id IS NULL AND game IS NOT NULL)",
            name="ck_heart_events_source_columns",
        ),
        sa.ForeignKeyConstraint(
            ["learning_profile_id"],
            ["learning_profiles.id"],
            name="fk_heart_events_learning_profile_id_learning_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["chapter_id"],
            ["chapters.id"],
            name="fk_heart_events_chapter_id_chapters",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_heart_events_learning_profile_id_earned_at",
        "heart_events",
        ["learning_profile_id", "earned_at"],
    )
    op.create_index("ix_heart_events_chapter_id", "heart_events", ["chapter_id"])


def downgrade() -> None:
    op.drop_index("ix_heart_events_chapter_id", table_name="heart_events")
    op.drop_index("ix_heart_events_learning_profile_id_earned_at", table_name="heart_events")
    op.drop_table("heart_events")
