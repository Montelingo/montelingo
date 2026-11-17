from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    PrimaryKeyConstraint,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

from .schemas import AGE_BANDS, AVATARS, GAME_IDS, NAME_MAX_LENGTH, GameId


def _one_of(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class LearningProfile(Base):
    """The owner of progress. Exactly one per account (ADR 0005)."""

    __tablename__ = "learning_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_learning_profiles_user_id"),
        CheckConstraint(
            f"char_length(name) BETWEEN 1 AND {NAME_MAX_LENGTH}",
            name="ck_learning_profiles_name_length",
        ),
        CheckConstraint(
            f"age_band IN ({_one_of(AGE_BANDS)})", name="ck_learning_profiles_age_band"
        ),
        CheckConstraint(f"avatar IN ({_one_of(AVATARS)})", name="ck_learning_profiles_avatar"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", name="fk_learning_profiles_user_id_users", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # The child profile (#117). Null until the grown-up sets the profile up.
    name: Mapped[str | None] = mapped_column(Text)
    age_band: Mapped[str | None] = mapped_column(Text)
    avatar: Mapped[str | None] = mapped_column(Text)


class LocationProgress(Base):
    """A location a profile has started. No row means the location was never started."""

    __tablename__ = "location_progress"

    learning_profile_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "learning_profiles.id",
            name="fk_location_progress_learning_profile_id_learning_profiles",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )
    location_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "locations.id",
            name="fk_location_progress_location_id_locations",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ChapterProgress(Base):
    """A chapter a profile has started (ADR 0006). No row means it was never started."""

    __tablename__ = "chapter_progress"
    __table_args__ = (
        PrimaryKeyConstraint("learning_profile_id", "chapter_id", name="pk_chapter_progress"),
        # The key leads with the profile, so deleting a chapter needs its own index.
        Index("ix_chapter_progress_chapter_id", "chapter_id"),
    )

    learning_profile_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "learning_profiles.id",
            name="fk_chapter_progress_learning_profile_id_learning_profiles",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )
    chapter_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "chapters.id",
            name="fk_chapter_progress_chapter_id_chapters",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )
    lesson_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GameResult(Base):
    """A game a profile has played to the end in a chapter. Recorded once (ADR 0006)."""

    __tablename__ = "game_results"
    __table_args__ = (
        UniqueConstraint(
            "learning_profile_id",
            "chapter_id",
            "game",
            name="uq_game_results_learning_profile_id_chapter_id_game",
        ),
        CheckConstraint(f"game IN ({_one_of(GAME_IDS)})", name="ck_game_results_game"),
        Index("ix_game_results_chapter_id", "chapter_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    learning_profile_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "learning_profiles.id",
            name="fk_game_results_learning_profile_id_learning_profiles",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    chapter_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "chapters.id",
            name="fk_game_results_chapter_id_chapters",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    game: Mapped[GameId] = mapped_column(Text, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
