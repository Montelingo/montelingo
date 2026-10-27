from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Location, Region
from app.modules.progress.models import LearningProfile, LocationProgress
from app.modules.progress.repository import SqlAlchemyProgressRepository
from app.modules.users.models import User

pytestmark = pytest.mark.integration

NOW = datetime(2026, 10, 22, tzinfo=UTC)


async def seed_map(session: AsyncSession) -> tuple[Location, Location]:
    coast = Region(slug="coast", name="Coast", position=1)
    north = Region(slug="north", name="North", position=2)
    session.add_all([coast, north])
    await session.flush()

    budva = Location(
        region_id=coast.id,
        slug="budva",
        name="Budva",
        position=1,
        is_start=True,
    )
    kotor = Location(
        region_id=coast.id,
        slug="kotor",
        name="Kotor",
        position=2,
        is_start=False,
    )
    session.add_all([budva, kotor])
    await session.flush()
    return budva, kotor


async def create_profile(session: AsyncSession, email: str) -> LearningProfile:
    user = User(
        email=email,
        password_hash="integration-test-hash",
        created_at=NOW,
        updated_at=NOW,
    )
    session.add(user)
    await session.flush()

    profile = LearningProfile(user_id=user.id)
    session.add(profile)
    await session.flush()
    return profile


async def test_repository_isolates_learning_profiles(
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    first_profile = await create_profile(db_session, "map-first@example.com")
    second_profile = await create_profile(db_session, "map-second@example.com")

    db_session.add_all(
        [
            LocationProgress(
                learning_profile_id=first_profile.id,
                location_id=budva.id,
                started_at=NOW,
            ),
            LocationProgress(
                learning_profile_id=second_profile.id,
                location_id=kotor.id,
                started_at=NOW,
                completed_at=NOW,
            ),
        ]
    )
    await db_session.flush()

    repository = SqlAlchemyProgressRepository(db_session)

    content_first, progress_first = await repository.read_map(first_profile.id)
    content_second, progress_second = await repository.read_map(second_profile.id)

    assert content_first == content_second
    assert [item.location_slug for item in progress_first] == ["budva"]
    assert [item.location_slug for item in progress_second] == ["kotor"]


async def test_repository_returns_ordered_content(
    db_session: AsyncSession,
) -> None:
    await seed_map(db_session)
    profile = await create_profile(db_session, "map-order@example.com")

    repository = SqlAlchemyProgressRepository(db_session)
    content, progress = await repository.read_map(profile.id)

    assert [region.slug for region in content.regions] == ["coast", "north"]
    assert [location.slug for location in content.locations] == ["budva", "kotor"]
    assert content.starting_location == "budva"
    assert progress == []


async def test_repository_uses_fixed_number_of_queries(
    db_session: AsyncSession,
) -> None:
    await seed_map(db_session)
    profile = await create_profile(db_session, "map-count@example.com")
    repository = SqlAlchemyProgressRepository(db_session)

    engine = db_session.sync_session.get_bind()
    assert engine is not None

    statements: list[str] = []

    def count_queries(
        conn: object,
        cursor: object,
        statement: str,
        parameters: object,
        context: object,
        executemany: bool,
    ) -> None:
        if statement.lstrip().lower().startswith("select"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", count_queries)

    try:
        await repository.read_map(profile.id)
        assert len(statements) == 3

        statements.clear()

        another_region = Region(
            slug="south",
            name="South",
            position=3,
        )
        db_session.add(another_region)
        await db_session.flush()

        statements.clear()
        await repository.read_map(profile.id)
        assert len(statements) == 3
    finally:
        event.remove(engine, "before_cursor_execute", count_queries)
