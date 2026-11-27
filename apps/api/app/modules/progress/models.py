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

from .schemas import (
    AGE_BANDS,
    AVATARS,
    GAME_IDS,
    HEART_SOURCES,
    NAME_MAX_LENGTH,
    GameId,
    HeartSource,
)


def _one_of(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class LearningProfile(Base):
    """The owner of progress: a player. An account has up to 4 (ADR 0007)."""

    __tablename__ = "learning_profiles"
    __table_args__ = (
        Index("ix_learning_profiles_user_id", "user_id"),
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
    # When the player was last chosen or added. A new session starts with the
    # latest one (ADR 0007).
    last_selected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


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


class HeartEvent(Base):
    """One heart a player earned by coming back to words they learned (ADR 0009).

    Never updated. The player's hearts are a count of these rows.
    """

    __tablename__ = "heart_events"
    __table_args__ = (
        CheckConstraint(f"source IN ({_one_of(HEART_SOURCES)})", name="ck_heart_events_source"),
        CheckConstraint(f"game IN ({_one_of(GAME_IDS)})", name="ck_heart_events_game"),
        # A lesson has a chapter and no game, a game both, practice only a game.
        CheckConstraint(
            "(source = 'lesson' AND chapter_id IS NOT NULL AND game IS NULL)"
            " OR (source = 'game' AND chapter_id IS NOT NULL AND game IS NOT NULL)"
            " OR (source = 'practice' AND chapter_id IS NULL AND game IS NOT NULL)",
            name="ck_heart_events_source_columns",
        ),
        # The total and the day's count both read by player and time.
        Index("ix_heart_events_learning_profile_id_earned_at", "learning_profile_id", "earned_at"),
        Index("ix_heart_events_chapter_id", "chapter_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    learning_profile_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "learning_profiles.id",
            name="fk_heart_events_learning_profile_id_learning_profiles",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[HeartSource] = mapped_column(Text, nullable=False)
    # Like `game_results`, a heart goes with its chapter if content removes it.
    chapter_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "chapters.id",
            name="fk_heart_events_chapter_id_chapters",
            ondelete="CASCADE",
        ),
    )
    game: Mapped[GameId | None] = mapped_column(Text)
