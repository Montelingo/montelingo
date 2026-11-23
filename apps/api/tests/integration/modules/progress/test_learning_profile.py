from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Location, Region
from app.modules.progress.models import LearningProfile, LocationProgress
from app.modules.progress.repository import SqlAlchemyLearningProfileRepository
from app.modules.users.models import User

pytestmark = pytest.mark.integration


async def test_an_account_can_have_more_than_one_learning_profile(
    db_session: AsyncSession,
) -> None:
    user = User(email="profile-owner@example.com", password_hash="hash")
    db_session.add(user)
    await db_session.flush()
    repository = SqlAlchemyLearningProfileRepository(db_session)

    first = await repository.create_for_user(user.id)
    second = await repository.create_for_user(user.id)

    # Oldest first, even when both were added in one transaction.
    assert [profile.id for profile in await repository.list_for_user(user.id)] == [
        first.id,
        second.id,
    ]


async def test_profile_lookup_is_scoped_to_the_current_user(
    db_session: AsyncSession,
) -> None:
    first_user = User(email="first-profile@example.com", password_hash="hash")
    second_user = User(email="second-profile@example.com", password_hash="hash")
    db_session.add_all([first_user, second_user])
    await db_session.flush()
    first_profile = LearningProfile(user_id=first_user.id)
    second_profile = LearningProfile(user_id=second_user.id)
    db_session.add_all([first_profile, second_profile])
    await db_session.flush()

    repository = SqlAlchemyLearningProfileRepository(db_session)

    assert await repository.get_for_user(first_user.id, first_profile.id) is first_profile
    assert await repository.get_for_user(second_user.id, first_profile.id) is None
    assert [p.id for p in await repository.list_for_user(second_user.id)] == [second_profile.id]


async def test_the_last_chosen_profile_is_the_latest_chosen_or_else_the_oldest(
    db_session: AsyncSession,
) -> None:
    user = User(email="last-chosen@example.com", password_hash="hash")
    db_session.add(user)
    await db_session.flush()
    repository = SqlAlchemyLearningProfileRepository(db_session)
    oldest = await repository.create_for_user(user.id)
    newer = await repository.create_for_user(user.id)

    assert await repository.last_chosen(user.id) is oldest

    await repository.mark_chosen(newer)
    assert await repository.last_chosen(user.id) is newer

    await repository.mark_chosen(oldest)
    assert await repository.last_chosen(user.id) is oldest


async def test_deleting_user_cascades_profile_and_location_progress(
    db_session: AsyncSession,
) -> None:
    region = Region(
        slug=f"region-{uuid4().hex}",
        name="Region",
        position=999999,
    )
    db_session.add(region)
    await db_session.flush()
    location = Location(
        region_id=region.id,
        slug=f"location-{uuid4().hex}",
        name="Location",
        position=999999,
    )
    user = User(email="cascade-profile@example.com", password_hash="hash")
    db_session.add_all([location, user])
    await db_session.flush()
    profile = LearningProfile(user_id=user.id)
    db_session.add(profile)
    await db_session.flush()
    db_session.add(LocationProgress(learning_profile_id=profile.id, location_id=location.id))
    await db_session.flush()

    await db_session.delete(user)
    await db_session.flush()

    assert (
        await db_session.scalar(select(LearningProfile).where(LearningProfile.id == profile.id))
        is None
    )
    assert (
        await db_session.scalar(
            select(LocationProgress).where(LocationProgress.learning_profile_id == profile.id)
        )
        is None
    )
