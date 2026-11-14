from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import scripts.seed_content as seed_script
from app.modules.content.domain import Chapter as ChapterData
from app.modules.content.domain import Content, Region, Word
from app.modules.content.domain import Location as LocationData
from app.modules.content.models import Chapter, Location, VocabularyItem
from app.modules.progress.models import LearningProfile, LocationProgress
from app.modules.users.models import User
from scripts.seed_content import seed_content

pytestmark = pytest.mark.integration


def content(
    *,
    renamed_word: bool = False,
    moved_start: bool = False,
    two_chapters: bool = False,
    removed_locations: frozenset[str] = frozenset(),
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
        locations=tuple(
            location for location in locations if location.slug not in removed_locations
        ),
        chapters=tuple(
            chapter for chapter in chapters if chapter.location_slug not in removed_locations
        ),
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


def _borrowed(session: AsyncSession) -> seed_script.SessionFactory:
    """Run the seed command in the test session, so its writes are rolled back."""

    @asynccontextmanager
    async def borrowed_session() -> AsyncIterator[AsyncSession]:
        yield session

    return borrowed_session


async def _location(session: AsyncSession, slug: str) -> Location | None:
    return await session.scalar(select(Location).where(Location.slug == slug))


async def _progress_on(session: AsyncSession, location: Location) -> LearningProfile:
    user = User(email="seed-progress@example.com", password_hash="hash")
    session.add(user)
    await session.flush()
    profile = LearningProfile(user_id=user.id)
    session.add(profile)
    await session.flush()
    session.add(LocationProgress(learning_profile_id=profile.id, location_id=location.id))
    await session.flush()
    return profile


async def test_seed_command_keeps_removed_location_with_progress(
    db_session: AsyncSession,
    capsys: pytest.CaptureFixture[str],
) -> None:
    await seed_content(db_session, content(two_chapters=True))
    kotor = await _location(db_session, "kotor")
    assert kotor is not None
    profile = await _progress_on(db_session, kotor)

    exit_code = await seed_script.run(
        content(two_chapters=True, removed_locations=frozenset({"kotor"})),
        _borrowed(db_session),
    )

    remaining = await _location(db_session, "kotor")
    chapter = await db_session.scalar(select(Chapter).where(Chapter.slug == "kotor-basics"))
    progress = (
        await db_session.scalars(
            select(LocationProgress).where(LocationProgress.location_id == kotor.id)
        )
    ).all()
    assert remaining is not None
    assert remaining.id == kotor.id
    assert chapter is not None
    assert [row.learning_profile_id for row in progress] == [profile.id]
    # Kotor, its chapter and its word are reported, nothing is inserted or updated.
    assert capsys.readouterr().out.splitlines() == ["seed: inserted=0 updated=0 stale=3"]
    assert exit_code == 1
