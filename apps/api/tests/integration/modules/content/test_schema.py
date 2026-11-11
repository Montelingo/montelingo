from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Chapter, Location, Region, VocabularyItem
from app.modules.progress.models import LearningProfile, LocationProgress
from app.modules.users.models import User

pytestmark = pytest.mark.integration


async def add_region(db: AsyncSession, slug: str = "coast", position: int = 1) -> Region:
    region = Region(slug=slug, name=slug.title(), position=position)
    db.add(region)
    await db.flush()
    return region


async def add_location(
    db: AsyncSession, region: Region, slug: str, position: int, *, is_start: bool = False
) -> Location:
    location = Location(
        region_id=region.id, slug=slug, name=slug.title(), position=position, is_start=is_start
    )
    db.add(location)
    await db.flush()
    return location


async def add_user(db: AsyncSession, email: str) -> User:
    user = User(
        email=email,
        password_hash="hash",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(user)
    await db.flush()
    return user


async def expect_violation(db: AsyncSession, constraint: str) -> None:
    with pytest.raises(IntegrityError) as error:
        async with db.begin_nested():
            await db.flush()
    assert constraint in str(error.value)


async def test_the_full_hierarchy_can_be_stored(db_session: AsyncSession) -> None:
    region = await add_region(db_session)
    location = await add_location(db_session, region, "budva", 1, is_start=True)
    chapter = Chapter(location_id=location.id, slug="budva-beach", title="Na plaži", position=1)
    db_session.add(chapter)
    await db_session.flush()
    db_session.add(
        VocabularyItem(
            chapter_id=chapter.id, number=30, text="zvijezda", note="sea star", position=1
        )
    )
    await db_session.flush()

    count = await db_session.scalar(select(func.count()).select_from(VocabularyItem))
    assert count == 1


async def test_only_one_location_can_be_the_start(db_session: AsyncSession) -> None:
    region = await add_region(db_session)
    await add_location(db_session, region, "budva", 1, is_start=True)
    await add_location(db_session, region, "kotor", 2)

    db_session.add(Location(region_id=region.id, slug="bar", name="Bar", position=3, is_start=True))
    await expect_violation(db_session, "uq_locations_single_start")


@pytest.mark.parametrize("slug", ["Coast", "1coast", "coast_west", "-coast", "obala čista"])
async def test_slugs_must_be_english_kebab_case(db_session: AsyncSession, slug: str) -> None:
    db_session.add(Region(slug=slug, name="Obala", position=1))
    await expect_violation(db_session, "ck_regions_slug_format")


async def test_positions_must_be_positive(db_session: AsyncSession) -> None:
    db_session.add(Region(slug="coast", name="Obala", position=0))
    await expect_violation(db_session, "ck_regions_position_positive")


async def test_location_positions_are_unique_within_a_region(db_session: AsyncSession) -> None:
    region = await add_region(db_session)
    await add_location(db_session, region, "budva", 1)

    db_session.add(Location(region_id=region.id, slug="kotor", name="Kotor", position=1))
    await expect_violation(db_session, "uq_locations_region_id_position")


async def test_an_account_has_at_most_one_learning_profile(db_session: AsyncSession) -> None:
    user = await add_user(db_session, "profile@example.com")
    db_session.add(LearningProfile(user_id=user.id))
    await db_session.flush()

    db_session.add(LearningProfile(user_id=user.id))
    await expect_violation(db_session, "uq_learning_profiles_user_id")


async def test_deleting_an_account_removes_its_profile_and_progress(
    db_session: AsyncSession,
) -> None:
    user = await add_user(db_session, "cascade@example.com")
    region = await add_region(db_session)
    location = await add_location(db_session, region, "budva", 1, is_start=True)
    profile = LearningProfile(user_id=user.id)
    db_session.add(profile)
    await db_session.flush()
    db_session.add(LocationProgress(learning_profile_id=profile.id, location_id=location.id))
    await db_session.flush()

    user_id, profile_id = user.id, profile.id

    await db_session.delete(user)
    await db_session.flush()
    db_session.expunge_all()

    profiles = select(func.count()).where(LearningProfile.user_id == user_id)
    progress = select(func.count()).where(LocationProgress.learning_profile_id == profile_id)
    assert await db_session.scalar(profiles) == 0
    assert await db_session.scalar(progress) == 0
