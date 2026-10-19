"""Content persistence. The read path arrives with #63, the seed upserts with #62."""
from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Chapter, Location, Region, VocabularyItem


class ContentRepository(Protocol):
    async def list_regions(self) -> list[tuple[str, str, int]]: ...

    async def get_region(self, slug: str) -> Region | None: ...

    async def list_region_locations(
        self, region_id: UUID
    ) -> list[tuple[str, str, int, int]]: ...

    async def get_location(self, slug: str) -> tuple[Location, str] | None: ...

    async def list_location_chapters(
        self, location_id: UUID
    ) -> list[tuple[Chapter, VocabularyItem | None]]: ...


class SqlAlchemyContentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_regions(self) -> list[tuple[str, str, int]]:
        statement = (
            select(
                Region.slug,
                Region.name,
                func.count(Location.id).label("location_count"),
            )
            .outerjoin(Location, Location.region_id == Region.id)
            .group_by(Region.id, Region.slug, Region.name, Region.position)
            .order_by(Region.position)
        )

        result = await self.session.execute(statement)
        return [
            (slug, name, location_count)
            for slug, name, location_count in result.all()
        ]

    async def get_region(self, slug: str) -> Region | None:
        statement = select(Region).where(Region.slug == slug)
        return await self.session.scalar(statement)

    async def list_region_locations(
        self, region_id: UUID
    ) -> list[tuple[str, str, int, int]]:
        chapter_counts = (
            select(
                Chapter.location_id.label("location_id"),
                func.count(Chapter.id).label("chapter_count"),
            )
            .group_by(Chapter.location_id)
            .subquery()
        )

        word_counts = (
            select(
                Chapter.location_id.label("location_id"),
                func.count(VocabularyItem.id).label("word_count"),
            )
            .join(
                VocabularyItem,
                VocabularyItem.chapter_id == Chapter.id,
            )
            .group_by(Chapter.location_id)
            .subquery()
        )

        statement = (
            select(
                Location.slug,
                Location.name,
                func.coalesce(chapter_counts.c.chapter_count, 0),
                func.coalesce(word_counts.c.word_count, 0),
            )
            .outerjoin(
                chapter_counts,
                chapter_counts.c.location_id == Location.id,
            )
            .outerjoin(
                word_counts,
                word_counts.c.location_id == Location.id,
            )
            .where(Location.region_id == region_id)
            .order_by(Location.position)
        )

        result = await self.session.execute(statement)
        return [
            (slug, name, chapter_count, word_count)
            for slug, name, chapter_count, word_count in result.all()
        ]

    async def get_location(self, slug: str) -> tuple[Location, str] | None:
        statement = (
            select(Location, Region.slug)
            .join(Region, Region.id == Location.region_id)
            .where(Location.slug == slug)
        )

        result = await self.session.execute(statement)
        row = result.one_or_none()

        if row is None:
            return None

        return row[0], row[1]

    async def list_location_chapters(
        self, location_id: UUID
    ) -> list[tuple[Chapter, VocabularyItem | None]]:
        statement = (
            select(Chapter, VocabularyItem)
            .outerjoin(
                VocabularyItem,
                VocabularyItem.chapter_id == Chapter.id,
            )
            .where(Chapter.location_id == location_id)
            .order_by(Chapter.position, VocabularyItem.position)
        )

        result = await self.session.execute(statement)
        return [(chapter, word) for chapter, word in result.all()]
