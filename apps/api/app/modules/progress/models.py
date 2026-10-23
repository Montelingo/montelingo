from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LearningProfile(Base):
    """The owner of progress. Exactly one per account (ADR 0005)."""

    __tablename__ = "learning_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_learning_profiles_user_id"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", name="fk_learning_profiles_user_id_users", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


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
