"""create chapter progress and game results

A chapter's lesson and its games (ADR 0006, #122). Both phase 2 tables are
created here, so parallel tickets never add competing Alembic heads.

Revision ID: 20261117_0005
Revises: 20261115_0004
Create Date: 2026-11-17 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261117_0005"
down_revision: str | None = "20261115_0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chapter_progress",
        sa.Column("learning_profile_id", sa.Uuid(), nullable=False),
        sa.Column("chapter_id", sa.Uuid(), nullable=False),
        sa.Column("lesson_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["learning_profile_id"],
            ["learning_profiles.id"],
            name="fk_chapter_progress_learning_profile_id_learning_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["chapter_id"],
            ["chapters.id"],
            name="fk_chapter_progress_chapter_id_chapters",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("learning_profile_id", "chapter_id", name="pk_chapter_progress"),
    )
    # The keys lead with the profile, so deleting a chapter needs its own index.
    op.create_index("ix_chapter_progress_chapter_id", "chapter_progress", ["chapter_id"])
    op.create_table(
        "game_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("learning_profile_id", sa.Uuid(), nullable=False),
        sa.Column("chapter_id", sa.Uuid(), nullable=False),
        sa.Column("game", sa.Text(), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("game IN ('memory', 'match')", name="ck_game_results_game"),
        sa.ForeignKeyConstraint(
            ["learning_profile_id"],
            ["learning_profiles.id"],
            name="fk_game_results_learning_profile_id_learning_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["chapter_id"],
            ["chapters.id"],
            name="fk_game_results_chapter_id_chapters",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "learning_profile_id",
            "chapter_id",
            "game",
            name="uq_game_results_learning_profile_id_chapter_id_game",
        ),
    )
    op.create_index("ix_game_results_chapter_id", "game_results", ["chapter_id"])


def downgrade() -> None:
    op.drop_index("ix_game_results_chapter_id", table_name="game_results")
    op.drop_table("game_results")
    op.drop_index("ix_chapter_progress_chapter_id", table_name="chapter_progress")
    op.drop_table("chapter_progress")
