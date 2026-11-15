from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

from .schemas import AGE_BANDS, AVATARS, NAME_MAX_LENGTH


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
