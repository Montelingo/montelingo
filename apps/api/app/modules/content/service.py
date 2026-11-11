"""Content read use cases, independent of HTTP response schemas."""

from __future__ import annotations

from app.core.errors import ApiError, ErrorCode

from . import domain
from .repository import ContentRepository


class ContentService:
    def __init__(self, repository: ContentRepository) -> None:
        self.repository = repository

    async def list_regions(self) -> tuple[domain.RegionSummaryRead, ...]:
        return tuple(await self.repository.list_regions())

    async def get_region(self, slug: str) -> domain.RegionDetailRead:
        region = await self.repository.get_region(slug)
        if region is None:
            raise _content_not_found("Region")
        locations = await self.repository.list_region_locations(region.id, region.slug)
        return domain.RegionDetailRead(
            slug=region.slug,
            name=region.name,
            locations=tuple(locations),
        )

    async def get_location(self, slug: str) -> domain.LocationDetailRead:
        location = await self.repository.get_location(slug)
        if location is None:
            raise _content_not_found("Location")
        chapters = await self.repository.list_location_chapters(location.id)
        return domain.LocationDetailRead(
            slug=location.slug,
            name=location.name,
            region_slug=location.region_slug,
            chapters=tuple(chapters),
        )


def _content_not_found(kind: str) -> ApiError:
    return ApiError(
        ErrorCode.CONTENT_NOT_FOUND,
        f"{kind} not found.",
        status_code=404,
    )
