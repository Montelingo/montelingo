from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.domain import Chapter as ChapterData
from app.modules.content.domain import Content, Region, Word
from app.modules.content.domain import Location as LocationData
from app.modules.content.models import Chapter, Location, VocabularyItem
from scripts.seed_content import seed_content

pytestmark = pytest.mark.integration


def content(
    *,
    renamed_word: bool = False,
    moved_start: bool = False,
    two_chapters: bool = False,
) -> Content:
    regions = (Region(slug="coast", name="Obala"),)
    locations = (
        LocationData(
            slug="budva",
            name="Budva",
            region_slug="coast",
            is_starting=not moved_start,
        ),
        LocationData(
            slug="kotor",
            name="Kotor",
            region_slug="coast",
            is_starting=moved_start,
        ),
    )
    chapters = [
        ChapterData(
            slug="budva-basics",
            title="Osnove",
            location_slug="budva",
            words=(Word(number=1, text="more" if not renamed_word else "pučina"),),
        )
    ]
    if two_chapters:
        chapters.append(
            ChapterData(
                slug="kotor-basics",
                title="Drugo",
                location_slug="kotor",
                words=(Word(number=2, text="grad"),),
            )
        )
    return Content(
        starting_location="kotor" if moved_start else "budva",
        regions=regions,
        locations=locations,
        chapters=tuple(chapters),
    )


async def test_seed_populates_empty_database_and_is_idempotent(db_session: AsyncSession) -> None:
    first = await seed_content(db_session, content())
    second = await seed_content(db_session, content())

    assert first.inserted == 5
    assert second.inserted == 0
    assert second.updated == 0
    assert second.stale == 0


async def test_seed_updates_word_in_place(db_session: AsyncSession) -> None:
    await seed_content(db_session, content())
    original = await db_session.scalar(select(VocabularyItem).where(VocabularyItem.number == 1))
    assert original is not None

    await seed_content(db_session, content(renamed_word=True))
    updated = await db_session.scalar(select(VocabularyItem).where(VocabularyItem.number == 1))

    assert updated is not None
    assert updated.id == original.id
    assert updated.text == "pučina"


async def test_seed_moves_starting_location(db_session: AsyncSession) -> None:
    await seed_content(db_session, content())
    await seed_content(db_session, content(moved_start=True))

    starts = (await db_session.scalars(select(Location).where(Location.is_start))).all()
    assert [location.slug for location in starts] == ["kotor"]


async def test_seed_reports_removed_chapter_without_deleting_it(
    db_session: AsyncSession,
) -> None:
    await seed_content(db_session, content(two_chapters=True))
    removed = await db_session.scalar(select(Chapter).where(Chapter.slug == "kotor-basics"))
    assert removed is not None

    counts = await seed_content(db_session, content())
    remaining = await db_session.scalar(select(Chapter).where(Chapter.slug == "kotor-basics"))

    assert counts.stale == 2
    assert remaining is not None
    assert remaining.id == removed.id
