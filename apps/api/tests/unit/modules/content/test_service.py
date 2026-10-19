
from __future__ import annotations

from uuid import uuid4

import pytest

from app.core.errors import ApiError, ErrorCode
from app.modules.content.models import Chapter, Location, Region, VocabularyItem
from app.modules.content.service import ContentService


class FakeContentRepository:
    def __init__(self) -> None:
        self.region = Region(
            id=uuid4(),
            slug="north",
            name="North",
            position=1,
        )
        self.location = Location(
            id=uuid4(),
            region_id=self.region.id,
            slug="city",
            name="City",
            position=1,
        )
        self.chapter = Chapter(
            id=uuid4(),
            location_id=self.location.id,
            slug="basics",
            title="Basics",
            position=1,
        )
        self.word = VocabularyItem(
            id=uuid4(),
            chapter_id=self.chapter.id,
            number=1,
            text="hello",
            note=None,
            position=1,
        )

    async def list_regions(self) -> list[tuple[str, str, int]]:
        return [("north", "North", 1)]

    async def get_region(self, slug: str) -> Region | None:
        return self.region if slug == self.region.slug else None

    async def list_region_locations(
        self, region_id: object
    ) -> list[tuple[str, str, int, int]]:
        if region_id != self.region.id:
            return []
        return [("city", "City", 1, 1)]

    async def get_location(self, slug: str) -> tuple[Location, str] | None:
        if slug != self.location.slug:
            return None
        return self.location, self.region.slug

    async def list_location_chapters(
        self, location_id: object
    ) -> list[tuple[Chapter, VocabularyItem | None]]:
        if location_id != self.location.id:
            return []
        return [(self.chapter, self.word)]


@pytest.mark.asyncio
async def test_list_regions() -> None:
    service = ContentService(repository=FakeContentRepository())
    result = await service.list_regions()

    assert len(result.items) == 1
    assert result.items[0].id == "north"
    assert result.items[0].location_count == 1
    assert result.page.has_more is False
    assert result.page.next_cursor is None


@pytest.mark.asyncio
async def test_get_region() -> None:
    service = ContentService(repository=FakeContentRepository())
    result = await service.get_region("north")

    assert result.id == "north"
    assert len(result.locations) == 1
    assert result.locations[0].region_id == "north"
    assert result.locations[0].chapter_count == 1
    assert result.locations[0].word_count == 1


@pytest.mark.asyncio
async def test_get_location() -> None:
    service = ContentService(repository=FakeContentRepository())
    result = await service.get_location("city")

    assert result.id == "city"
    assert result.region_id == "north"
    assert len(result.chapters) == 1
    assert result.chapters[0].id == "basics"
    assert result.chapters[0].words[0].text == "hello"
    assert result.chapters[0].words[0].image_url is None
    assert result.chapters[0].words[0].audio_url is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "slug"),
    [
        ("get_region", "unknown-region"),
        ("get_location", "unknown-location"),
    ],
)
async def test_unknown_content_returns_404(method: str, slug: str) -> None:
    service = ContentService(repository=FakeContentRepository())

    with pytest.raises(ApiError) as exc_info:
        await getattr(service, method)(slug)

    assert exc_info.value.status_code == 404
    assert exc_info.value.stable_code == ErrorCode.CONTENT_NOT_FOUND.value
