"""Public read interface for map content stored in the database."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .domain import Content
from .domain import Location as ContentLocation
from .domain import Region as ContentRegion
from .models import Chapter, Location, Region


async def read_map_content(
    session: AsyncSession,
) -> tuple[Content, dict[UUID, str]]:
    """Return ordered map content and the location ID-to-slug mapping.

    Database access to content tables remains inside the content module.
    The mapping allows the progress module to resolve progress records
    without importing or querying content models.
    """

    region_result = await session.execute(
        select(Region.slug, Region.name).order_by(Region.position)
    )

    regions = tuple(ContentRegion(slug=slug, name=name) for slug, name in region_result.all())

    location_result = await session.execute(
        select(
            Location.id,
            Location.slug,
            Location.name,
            Region.slug.label("region_slug"),
            Location.is_start,
        )
        .join(Region, Region.id == Location.region_id)
        .order_by(Region.position, Location.position)
    )

    locations: list[ContentLocation] = []
    location_slugs: dict[UUID, str] = {}

    for location_id, slug, name, region_slug, is_start in location_result.all():
        locations.append(
            ContentLocation(
                slug=slug,
                name=name,
                region_slug=region_slug,
                is_starting=is_start,
            )
        )
        location_slugs[location_id] = slug

    starting_locations = [location.slug for location in locations if location.is_starting]

    if len(starting_locations) != 1:
        raise ValueError(
            "Map content must contain exactly one starting location; "
            f"found {len(starting_locations)}."
        )

    content = Content(
        starting_location=starting_locations[0],
        regions=regions,
        locations=tuple(locations),
        chapters=(),
    )

    return content, location_slugs


async def read_location_id(session: AsyncSession, location_slug: str) -> UUID | None:
    """Return one location's ID by slug, or None when content no longer has it.

    Like `read_map_content`'s mapping, this lets the progress module write
    progress rows without querying content models.
    """

    return await session.scalar(select(Location.id).where(Location.slug == location_slug))


@dataclass(frozen=True, slots=True)
class MapChapter:
    """A chapter's identity and the place it belongs to, without its words."""

    id: UUID
    slug: str
    location_slug: str


async def read_map_chapters(session: AsyncSession) -> tuple[MapChapter, ...]:
    """Return every chapter in map order: by region, place, then recording order.

    The ID lets the progress module resolve its chapter rows without importing
    or querying content models.
    """

    result = await session.execute(
        select(Chapter.id, Chapter.slug, Location.slug)
        .join(Location, Location.id == Chapter.location_id)
        .join(Region, Region.id == Location.region_id)
        .order_by(Region.position, Location.position, Chapter.position)
    )

    return tuple(
        MapChapter(id=chapter_id, slug=slug, location_slug=location_slug)
        for chapter_id, slug, location_slug in result.all()
    )
