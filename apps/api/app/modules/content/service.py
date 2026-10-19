"""Content use cases. The read path arrives with #63."""
from __future__ import annotations

from app.core.errors import ApiError, ErrorCode
from app.schemas.common import PageInfo, PaginatedResponse

from .repository import ContentRepository
from .schemas import (
    Chapter as ChapterSchema,
)
from .schemas import (
    LocationDetail,
    LocationSummary,
    RegionDetail,
    RegionSummary,
    Word,
)


class ContentService:
    def __init__(self, repository: ContentRepository) -> None:
        self.repository = repository

    async def list_regions(self) -> PaginatedResponse[RegionSummary]:
        rows = await self.repository.list_regions()
        return PaginatedResponse[RegionSummary](
            items=[
                RegionSummary(id=slug, name=name, location_count=count)
                for slug, name, count in rows
            ],
            page=PageInfo(next_cursor=None, has_more=False),
        )

    async def get_region(self, slug: str) -> RegionDetail:
        region = await self.repository.get_region(slug)
        if region is None:
            raise ApiError(
                ErrorCode.CONTENT_NOT_FOUND,
                "Region not found.",
                status_code=404,
            )

        rows = await self.repository.list_region_locations(region.id)
        return RegionDetail(
            id=region.slug,
            name=region.name,
            locations=[
                LocationSummary(
                    id=location_slug,
                    name=name,
                    region_id=region.slug,
                    chapter_count=chapter_count,
                    word_count=word_count,
                )
                for location_slug, name, chapter_count, word_count in rows
            ],
        )

    async def get_location(self, slug: str) -> LocationDetail:
        result = await self.repository.get_location(slug)
        if result is None:
            raise ApiError(
                ErrorCode.CONTENT_NOT_FOUND,
                "Location not found.",
                status_code=404,
            )

        location, region_slug = result
        rows = await self.repository.list_location_chapters(location.id)

        chapters: list[ChapterSchema] = []
        chapter_by_id: dict[str, ChapterSchema] = {}

        for chapter, vocabulary_item in rows:
            chapter_id = str(chapter.id)
            if chapter_id not in chapter_by_id:
                chapter_schema = ChapterSchema(
                id=chapter.slug,
                title=chapter.title,
                 position=chapter.position,
                words=[],
                )
                chapter_by_id[chapter_id] = chapter_schema
                chapters.append(chapter_schema)

            if vocabulary_item is not None:
                chapter_by_id[chapter_id].words.append(
                    Word(
                        id=str(vocabulary_item.id),
                        number=vocabulary_item.number,
                        text=vocabulary_item.text,
                        note=vocabulary_item.note,
                        image_url=None,
                        audio_url=None,
                    )
                )

        return LocationDetail(
            id=location.slug,
            name=location.name,
            region_id=region_slug,
            chapters=chapters,
        )
