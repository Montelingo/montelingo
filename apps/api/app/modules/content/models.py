from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Same rule as SLUG_RE in loader.py: English kebab-case, as the SVG map IDs need.
SLUG_PATTERN = "^[a-z][a-z0-9-]*$"


def _slug_check(table: str) -> CheckConstraint:
    return CheckConstraint(f"slug ~ '{SLUG_PATTERN}'", name=f"ck_{table}_slug_format")


def _positive_check(table: str, column: str = "position") -> CheckConstraint:
    return CheckConstraint(f"{column} > 0", name=f"ck_{table}_{column}_positive")


class _Timestamps:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Region(_Timestamps, Base):
    __tablename__ = "regions"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_regions_slug"),
        UniqueConstraint("position", name="uq_regions_position"),
        _slug_check("regions"),
        _positive_check("regions"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class Location(_Timestamps, Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_locations_slug"),
        UniqueConstraint("region_id", "position", name="uq_locations_region_id_position"),
        # At most one starting location.
        Index(
            "uq_locations_single_start",
            "is_start",
            unique=True,
            postgresql_where=text("is_start"),
        ),
        _slug_check("locations"),
        _positive_check("locations"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    region_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("regions.id", name="fk_locations_region_id_regions"),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_start: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class Chapter(_Timestamps, Base):
    """One word group of the recording list. `position` is the recording order (1-30)."""

    __tablename__ = "chapters"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_chapters_slug"),
        UniqueConstraint("position", name="uq_chapters_position"),
        _slug_check("chapters"),
        _positive_check("chapters"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    location_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("locations.id", name="fk_chapters_location_id_locations"),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class VocabularyItem(_Timestamps, Base):
    """One word. `number` is its recording number (1-300) and future audio file name."""

    __tablename__ = "vocabulary_items"
    __table_args__ = (
        UniqueConstraint("number", name="uq_vocabulary_items_number"),
        UniqueConstraint("chapter_id", "position", name="uq_vocabulary_items_chapter_id_position"),
        _positive_check("vocabulary_items"),
        _positive_check("vocabulary_items", "number"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    chapter_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("chapters.id", name="fk_vocabulary_items_chapter_id_chapters"),
        nullable=False,
        index=True,
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
