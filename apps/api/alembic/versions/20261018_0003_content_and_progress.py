"""create content and progress tables

Every phase 1 table is created here, so parallel tickets never add competing
Alembic heads (ADR 0005).

Revision ID: 20261018_0003
Revises: 20261001_0002
Create Date: 2026-10-18 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261018_0003"
down_revision: str | None = "20261001_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

SLUG_CHECK = "slug ~ '^[a-z][a-z0-9-]*$'"


def _timestamps() -> list[sa.Column[sa.DateTime]]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "regions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(SLUG_CHECK, name="ck_regions_slug_format"),
        sa.CheckConstraint("position > 0", name="ck_regions_position_positive"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_regions_slug"),
        sa.UniqueConstraint("position", name="uq_regions_position"),
    )
    op.create_table(
        "locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("region_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_start", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(SLUG_CHECK, name="ck_locations_slug_format"),
        sa.CheckConstraint("position > 0", name="ck_locations_position_positive"),
        sa.ForeignKeyConstraint(
            ["region_id"], ["regions.id"], name="fk_locations_region_id_regions"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_locations_slug"),
        sa.UniqueConstraint("region_id", "position", name="uq_locations_region_id_position"),
    )
    op.create_index("ix_locations_region_id", "locations", ["region_id"])
    op.create_index(
        "uq_locations_single_start",
        "locations",
        ["is_start"],
        unique=True,
        postgresql_where=sa.text("is_start"),
    )
    op.create_table(
        "chapters",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(SLUG_CHECK, name="ck_chapters_slug_format"),
        sa.CheckConstraint("position > 0", name="ck_chapters_position_positive"),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"], name="fk_chapters_location_id_locations"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_chapters_slug"),
        sa.UniqueConstraint("position", name="uq_chapters_position"),
    )
    op.create_index("ix_chapters_location_id", "chapters", ["location_id"])
    op.create_table(
        "vocabulary_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("chapter_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("position > 0", name="ck_vocabulary_items_position_positive"),
        sa.CheckConstraint("number > 0", name="ck_vocabulary_items_number_positive"),
        sa.ForeignKeyConstraint(
            ["chapter_id"], ["chapters.id"], name="fk_vocabulary_items_chapter_id_chapters"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("number", name="uq_vocabulary_items_number"),
        sa.UniqueConstraint(
            "chapter_id", "position", name="uq_vocabulary_items_chapter_id_position"
        ),
    )
    op.create_index("ix_vocabulary_items_chapter_id", "vocabulary_items", ["chapter_id"])
    op.create_table(
        "learning_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_learning_profiles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_learning_profiles_user_id"),
    )
    op.create_table(
        "location_progress",
        sa.Column("learning_profile_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["learning_profile_id"],
            ["learning_profiles.id"],
            name="fk_location_progress_learning_profile_id_learning_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.id"],
            name="fk_location_progress_location_id_locations",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("learning_profile_id", "location_id"),
    )

    # Accounts created before this migration get their one learning profile here.
    # New accounts get theirs at sign-up (#64).
    op.execute(
        "INSERT INTO learning_profiles (id, user_id) SELECT gen_random_uuid(), id FROM users"
    )


def downgrade() -> None:
    op.drop_table("location_progress")
    op.drop_table("learning_profiles")
    op.drop_index("ix_vocabulary_items_chapter_id", table_name="vocabulary_items")
    op.drop_table("vocabulary_items")
    op.drop_index("ix_chapters_location_id", table_name="chapters")
    op.drop_table("chapters")
    op.drop_index("uq_locations_single_start", table_name="locations")
    op.drop_index("ix_locations_region_id", table_name="locations")
    op.drop_table("locations")
    op.drop_table("regions")
