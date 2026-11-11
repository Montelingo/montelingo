"""Content read persistence and database-to-domain mapping."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import domain
from .models import Chapter as ChapterModel
from .models import Location as LocationModel
from .models import Region as RegionModel
from .models import VocabularyItem


class ContentRepository(Protocol):
    async def list_regions(self) -> list[domain.RegionSummaryRead]: ...

    async def get_region(self, slug: str) -> domain.RegionRecord | None: ...

    async def list_region_locations(
        self, region_id: UUID, region_slug: str
    ) -> list[domain.LocationSummaryRead]: ...

    async def get_location(self, slug: str) -> domain.LocationRecord | None: ...

    async def list_location_chapters(self, location_id: UUID) -> list[domain.ChapterRead]: ...


class SqlAlchemyContentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_regions(self) -> list[domain.RegionSummaryRead]:
        statement = (
            select(
                RegionModel.slug,
                RegionModel.name,
                func.count(LocationModel.id).label("location_count"),
            )
            .outerjoin(LocationModel, LocationModel.region_id == RegionModel.id)
            .group_by(
                RegionModel.id,
                RegionModel.slug,
                RegionModel.name,
                RegionModel.position,
            )
            .order_by(RegionModel.position)
        )
        result = await self.session.execute(statement)
        return [
            domain.RegionSummaryRead(
                slug=row.slug, name=row.name, location_count=row.location_count
            )
            for row in result.all()
        ]

    async def get_region(self, slug: str) -> domain.RegionRecord | None:
        statement = select(RegionModel).where(RegionModel.slug == slug)
        region = await self.session.scalar(statement)
        if region is None:
            return None
        return domain.RegionRecord(id=region.id, slug=region.slug, name=region.name)

    async def list_region_locations(
        self, region_id: UUID, region_slug: str
    ) -> list[domain.LocationSummaryRead]:
        chapter_counts = (
            select(
                ChapterModel.location_id.label("location_id"),
                func.count(ChapterModel.id).label("chapter_count"),
            )
            .group_by(ChapterModel.location_id)
            .subquery()
        )
        word_counts = (
            select(
                ChapterModel.location_id.label("location_id"),
                func.count(VocabularyItem.id).label("word_count"),
            )
            .join(VocabularyItem, VocabularyItem.chapter_id == ChapterModel.id)
            .group_by(ChapterModel.location_id)
            .subquery()
        )
        statement = (
            select(
                LocationModel.slug,
                LocationModel.name,
                func.coalesce(chapter_counts.c.chapter_count, 0).label("chapter_count"),
                func.coalesce(word_counts.c.word_count, 0).label("word_count"),
            )
            .outerjoin(chapter_counts, chapter_counts.c.location_id == LocationModel.id)
            .outerjoin(word_counts, word_counts.c.location_id == LocationModel.id)
            .where(LocationModel.region_id == region_id)
            .order_by(LocationModel.position)
        )
        result = await self.session.execute(statement)
        return [
            domain.LocationSummaryRead(
                slug=row.slug,
                name=row.name,
                region_slug=region_slug,
                chapter_count=row.chapter_count,
                word_count=row.word_count,
            )
            for row in result.all()
        ]

    async def get_location(self, slug: str) -> domain.LocationRecord | None:
        statement = (
            select(LocationModel, RegionModel.slug)
            .join(RegionModel, RegionModel.id == LocationModel.region_id)
            .where(LocationModel.slug == slug)
        )
        result = await self.session.execute(statement)
        row = result.one_or_none()
        if row is None:
            return None
        location, region_slug = row
        return domain.LocationRecord(
            id=location.id,
            slug=location.slug,
            name=location.name,
            region_slug=region_slug,
        )

    async def list_location_chapters(self, location_id: UUID) -> list[domain.ChapterRead]:
        statement = (
            select(ChapterModel, VocabularyItem)
            .outerjoin(VocabularyItem, VocabularyItem.chapter_id == ChapterModel.id)
            .where(ChapterModel.location_id == location_id)
            .order_by(ChapterModel.position, VocabularyItem.position)
        )
        result = await self.session.execute(statement)
        chapters: list[domain.ChapterRead] = []
        # Mutable accumulation stays inside the persistence adapter.
        chapter_words: dict[UUID, list[domain.WordRead]] = {}
        chapter_order: list[tuple[UUID, str, str, int]] = []
        for chapter, word in result.all():
            if chapter.id not in chapter_words:
                chapter_words[chapter.id] = []
                chapter_order.append((chapter.id, chapter.slug, chapter.title, chapter.position))
            if word is not None:
                chapter_words[chapter.id].append(
                    domain.WordRead(
                        id=word.id,
                        number=word.number,
                        text=word.text,
                        note=word.note,
                    )
                )
        for chapter_id, slug, title, position in chapter_order:
            chapters.append(
                domain.ChapterRead(
                    slug=slug,
                    title=title,
                    position=position,
                    words=tuple(chapter_words[chapter_id]),
                )
            )
        return chapters
