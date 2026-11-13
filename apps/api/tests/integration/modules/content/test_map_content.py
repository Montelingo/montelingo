"""Integration tests for the public map content reader."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content import read_map_content
from app.modules.content.models import Location, Region

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
