"""Helpers shared by the integration tests that check database constraints."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Chapter, Location, Region


async def expect_violation(db: AsyncSession, constraint: str) -> None:
    """Flush pending rows and expect the database to reject them by `constraint`."""
    with pytest.raises(IntegrityError) as error:
        async with db.begin_nested():
            await db.flush()
    assert constraint in str(error.value)


async def add_chapter(db: AsyncSession) -> Chapter:
    """A chapter in its own region and location, with slugs and positions that never collide."""
    region = Region(slug=f"region-{uuid4().hex}", name="Region", position=999999)
    db.add(region)
    await db.flush()
    location = Location(
        region_id=region.id, slug=f"location-{uuid4().hex}", name="Location", position=999999
    )
    db.add(location)
    await db.flush()
    chapter = Chapter(
        location_id=location.id, slug=f"chapter-{uuid4().hex}", title="Chapter", position=999999
    )
    db.add(chapter)
    await db.flush()
    return chapter
