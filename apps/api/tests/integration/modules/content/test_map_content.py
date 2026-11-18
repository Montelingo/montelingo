"""Integration tests for the public map content reader."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content import MapChapter, read_map_chapters, read_map_content
from app.modules.content.models import Chapter, Location, Region

pytestmark = pytest.mark.integration


async def test_map_content_requires_starting_location(
    db_session: AsyncSession,
) -> None:
    region = Region(
        slug="coast",
        name="Coast",
        position=1,
    )
    db_session.add(region)
    await db_session.flush()

    location = Location(
        region_id=region.id,
        slug="budva",
        name="Budva",
        position=1,
        is_start=False,
    )
    db_session.add(location)
    await db_session.flush()

    with pytest.raises(
        ValueError,
        match="exactly one starting location",
    ):
        await read_map_content(db_session)


async def test_map_chapters_follow_the_map_order(
    db_session: AsyncSession,
) -> None:
    north = Region(slug="north", name="North", position=2)
    coast = Region(slug="coast", name="Coast", position=1)
    db_session.add_all([north, coast])
    await db_session.flush()

    kolasin = Location(region_id=north.id, slug="kolasin", name="Kolasin", position=1)
    kotor = Location(region_id=coast.id, slug="kotor", name="Kotor", position=2)
    budva = Location(region_id=coast.id, slug="budva", name="Budva", position=1, is_start=True)
    db_session.add_all([kolasin, kotor, budva])
    await db_session.flush()

    # Recording order differs from the map order on purpose.
    forest = Chapter(location_id=kolasin.id, slug="kolasin-forest", title="Šuma", position=1)
    walls = Chapter(location_id=kotor.id, slug="kotor-walls", title="Zidine", position=2)
    old_town = Chapter(location_id=budva.id, slug="budva-old-town", title="Stari grad", position=4)
    beach = Chapter(location_id=budva.id, slug="budva-beach", title="Na plaži", position=3)
    db_session.add_all([forest, walls, old_town, beach])
    await db_session.flush()

    chapters = await read_map_chapters(db_session)

    assert chapters == (
        MapChapter(id=beach.id, slug="budva-beach", location_slug="budva"),
        MapChapter(id=old_town.id, slug="budva-old-town", location_slug="budva"),
        MapChapter(id=walls.id, slug="kotor-walls", location_slug="kotor"),
        MapChapter(id=forest.id, slug="kolasin-forest", location_slug="kolasin"),
    )
