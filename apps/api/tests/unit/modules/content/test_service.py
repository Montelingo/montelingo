from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.core.errors import ApiError, ErrorCode
from app.modules.content import domain
from app.modules.content.service import ContentService


class FakeContentRepository:
    def __init__(self) -> None:
        self.region = domain.RegionRecord(id=uuid4(), slug="north", name="North")
        self.location = domain.LocationRecord(
            id=uuid4(), slug="city", name="City", region_slug="north"
        )
        self.word = domain.WordRead(id=uuid4(), number=1, text="hello", note=None)

    async def list_regions(self) -> list[domain.RegionSummaryRead]:
        return [domain.RegionSummaryRead(slug="north", name="North", location_count=1)]

    async def get_region(self, slug: str) -> domain.RegionRecord | None:
        return self.region if slug == self.region.slug else None

    async def list_region_locations(
        self, region_id: UUID, region_slug: str
    ) -> list[domain.LocationSummaryRead]:
        if region_id != self.region.id:
            return []
        return [
            domain.LocationSummaryRead(
                slug="city",
                name="City",
                region_slug=region_slug,
                chapter_count=1,
                word_count=1,
            )
        ]

    async def get_location(self, slug: str) -> domain.LocationRecord | None:
        return self.location if slug == self.location.slug else None

    async def list_location_chapters(self, location_id: UUID) -> list[domain.ChapterRead]:
        if location_id != self.location.id:
            return []
        return [domain.ChapterRead(slug="basics", title="Basics", position=1, words=(self.word,))]


async def test_list_regions() -> None:
    service = ContentService(repository=FakeContentRepository())
    result = await service.list_regions()
    assert len(result) == 1
    assert result[0].slug == "north"
    assert result[0].location_count == 1


async def test_get_region() -> None:
    service = ContentService(repository=FakeContentRepository())
    result = await service.get_region("north")
    assert result.slug == "north"
    assert len(result.locations) == 1
    assert result.locations[0].region_slug == "north"
    assert result.locations[0].chapter_count == 1
    assert result.locations[0].word_count == 1


async def test_get_location() -> None:
    service = ContentService(repository=FakeContentRepository())
    result = await service.get_location("city")
    assert result.slug == "city"
    assert result.region_slug == "north"
    assert len(result.chapters) == 1
    assert result.chapters[0].slug == "basics"
    assert result.chapters[0].words[0].text == "hello"


@pytest.mark.parametrize(
    ("method", "slug"),
    [("get_region", "unknown-region"), ("get_location", "unknown-location")],
)
async def test_unknown_content_returns_404(method: str, slug: str) -> None:
    service = ContentService(repository=FakeContentRepository())
    with pytest.raises(ApiError) as exc_info:
        await getattr(service, method)(slug)
    assert exc_info.value.status_code == 404
    assert exc_info.value.stable_code == ErrorCode.CONTENT_NOT_FOUND.value
