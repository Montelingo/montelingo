"""Integration tests for POST /chapters/{chapter_id}/games/{game_id}/result (#126)."""

from __future__ import annotations

import asyncio
import contextlib
from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.db.transaction import SessionTransactionManager
from app.modules.content.models import Chapter, Location, Region
from app.modules.progress.models import (
    ChapterProgress,
    GameResult,
    LearningProfile,
    LocationProgress,
)
from app.modules.progress.repository import SqlAlchemyProgressRepository
from app.modules.progress.schemas import GameId
from app.modules.progress.service import GameProgressService
from app.modules.users.models import User

from .test_progress_endpoint import (
    LOCKED_GAMES,
    ORIGIN,
    create_user,
    seed_chapters,
    seed_map,
    sign_in,
    states,
)

pytestmark = pytest.mark.integration

BEACH_MEMORY = "/api/v1/chapters/budva-beach/games/memory/result"
BEACH_MATCH = "/api/v1/chapters/budva-beach/games/match/result"
OLD_TOWN_MEMORY = "/api/v1/chapters/budva-old-town/games/memory/result"
OLD_TOWN_MATCH = "/api/v1/chapters/budva-old-town/games/match/result"

# What `seed_map` and `seed_chapters` create, for tests that commit them.
REGION_SLUGS = ("coast", "north")
LOCATION_SLUGS = ("budva", "kotor", "kolasin")
CHAPTER_SLUGS = ("budva-beach", "kotor-walls", "budva-old-town")


async def record(client: AsyncClient, path: str) -> dict:
    response = await client.post(path, headers={"Origin": ORIGIN})
    assert response.status_code == 200, response.text
    return response.json()


async def see_lesson(
    session: AsyncSession,
    profile: LearningProfile,
    chapter: Chapter,
    location: Location | None = None,
) -> None:
    """Store a seen lesson, and start its place when `location` is given."""

    now = datetime.now(UTC)
    if location is not None:
        session.add(
            LocationProgress(
                learning_profile_id=profile.id, location_id=location.id, started_at=now
            )
        )
    session.add(
        ChapterProgress(
            learning_profile_id=profile.id, chapter_id=chapter.id, lesson_completed_at=now
        )
    )
    await session.flush()


async def game_results(session: AsyncSession, profile: LearningProfile) -> list[GameResult]:
    result = await session.scalars(
        select(GameResult).where(GameResult.learning_profile_id == profile.id)
    )
    return list(result.all())


async def test_requires_a_session(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)

    response = await integration_client.post(BEACH_MEMORY, headers={"Origin": ORIGIN})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


async def test_records_the_game_and_returns_the_chapter_state(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await see_lesson(db_session, profile, beach, budva)
    await sign_in(integration_client, user)

    body = await record(integration_client, BEACH_MEMORY)

    assert body == {
        "id": "budva-beach",
        "lesson": "done",
        "games": [
            {"id": "memory", "state": "completed"},
            {"id": "match", "state": "available"},
        ],
    }
    results = await game_results(db_session, profile)
    assert [(row.chapter_id, row.game) for row in results] == [(beach.id, "memory")]

    progress = (await integration_client.get("/api/v1/progress")).json()
    assert progress["chapters"][0] == body


async def test_each_game_is_recorded_separately(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await see_lesson(db_session, profile, beach, budva)
    await sign_in(integration_client, user)

    await record(integration_client, BEACH_MATCH)
    body = await record(integration_client, BEACH_MEMORY)

    assert body["games"] == [
        {"id": "memory", "state": "completed"},
        {"id": "match", "state": "completed"},
    ]
    assert sorted(row.game for row in await game_results(db_session, profile)) == [
        "match",
        "memory",
    ]


async def test_recording_again_answers_200_and_changes_nothing(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await see_lesson(db_session, profile, beach, budva)
    await sign_in(integration_client, user)

    first = await record(integration_client, BEACH_MEMORY)
    [first_result] = await game_results(db_session, profile)
    first_completed_at = first_result.completed_at

    second = await record(integration_client, BEACH_MEMORY)

    assert second == first
    [second_result] = await game_results(db_session, profile)
    await db_session.refresh(second_result)
    assert second_result.id == first_result.id
    assert second_result.completed_at == first_completed_at


async def test_starts_the_place_if_it_was_not_started(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    # A seen lesson without a started place: Budva is only `available`.
    await see_lesson(db_session, profile, beach)
    await sign_in(integration_client, user)
    before = (await integration_client.get("/api/v1/progress")).json()
    assert states(before, "locations")["budva"] == "available"

    await record(integration_client, BEACH_MEMORY)

    after = (await integration_client.get("/api/v1/progress")).json()
    assert states(after, "locations")["budva"] == "in-progress"


async def test_unknown_chapter_is_404(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(
        "/api/v1/chapters/no-such-chapter/games/memory/result", headers={"Origin": ORIGIN}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "content_not_found"


async def test_unknown_game_is_404(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await see_lesson(db_session, profile, beach, budva)
    await sign_in(integration_client, user)

    response = await integration_client.post(
        "/api/v1/chapters/budva-beach/games/puzzle/result", headers={"Origin": ORIGIN}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "content_not_found"
    assert await game_results(db_session, profile) == []


async def test_chapter_in_a_locked_place_is_409(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(
        "/api/v1/chapters/kotor-walls/games/memory/result", headers={"Origin": ORIGIN}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "chapter_locked"
    assert await game_results(db_session, profile) == []


async def test_game_before_the_lesson_is_409(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(BEACH_MEMORY, headers={"Origin": ORIGIN})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "game_locked"
    assert await game_results(db_session, profile) == []


async def test_two_accounts_record_only_their_own_games(
    integration_app: FastAPI, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    first_user, first_profile = await create_user(db_session)
    second_user, second_profile = await create_user(db_session)
    await see_lesson(db_session, first_profile, beach, budva)
    await see_lesson(db_session, second_profile, beach, budva)

    async with (
        AsyncClient(transport=ASGITransport(app=integration_app), base_url="http://test") as first,
        AsyncClient(transport=ASGITransport(app=integration_app), base_url="http://test") as second,
    ):
        await sign_in(first, first_user)
        await sign_in(second, second_user)

        first_body = await record(first, BEACH_MEMORY)
        second_progress = (await second.get("/api/v1/progress")).json()
        second_body = await record(second, BEACH_MATCH)

    assert first_body["games"] == [
        {"id": "memory", "state": "completed"},
        {"id": "match", "state": "available"},
    ]
    # The first account's result is not the second's.
    assert second_progress["chapters"][0]["games"] == [
        {"id": "memory", "state": "available"},
        {"id": "match", "state": "available"},
    ]
    assert second_body["games"] == [
        {"id": "memory", "state": "available"},
        {"id": "match", "state": "completed"},
    ]
    assert [row.game for row in await game_results(db_session, first_profile)] == ["memory"]
    assert [row.game for row in await game_results(db_session, second_profile)] == ["match"]


async def test_one_account_lesson_does_not_unlock_another_accounts_games(
    integration_app: FastAPI, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    first_user, first_profile = await create_user(db_session)
    second_user, second_profile = await create_user(db_session)
    await see_lesson(db_session, first_profile, beach, budva)

    async with (
        AsyncClient(transport=ASGITransport(app=integration_app), base_url="http://test") as first,
        AsyncClient(transport=ASGITransport(app=integration_app), base_url="http://test") as second,
    ):
        await sign_in(first, first_user)
        await sign_in(second, second_user)

        await record(first, BEACH_MEMORY)
        response = await second.post(BEACH_MEMORY, headers={"Origin": ORIGIN})
        second_progress = (await second.get("/api/v1/progress")).json()

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "game_locked"
    assert second_progress["chapters"][0] == {
        "id": "budva-beach",
        "lesson": "todo",
        "games": LOCKED_GAMES,
    }
    assert await game_results(db_session, second_profile) == []


async def location_progress(
    session: AsyncSession, profile: LearningProfile, location: Location
) -> LocationProgress:
    row = await session.scalar(
        select(LocationProgress).where(
            LocationProgress.learning_profile_id == profile.id,
            LocationProgress.location_id == location.id,
        )
    )
    assert row is not None
    await session.refresh(row)
    return row


async def seed_budva_lessons(
    session: AsyncSession,
) -> tuple[User, LearningProfile, Location]:
    """Seed the map with both of Budva's lessons seen. Returns Budva."""

    budva, kotor = await seed_map(session)
    beach, old_town = await seed_chapters(session, budva, kotor)
    user, profile = await create_user(session)
    await see_lesson(session, profile, beach, budva)
    await see_lesson(session, profile, old_town)
    return user, profile, budva


async def test_the_last_game_of_a_place_completes_it_and_opens_the_next(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, budva = await seed_budva_lessons(db_session)
    await sign_in(integration_client, user)

    await record(integration_client, BEACH_MEMORY)
    await record(integration_client, BEACH_MATCH)
    await record(integration_client, OLD_TOWN_MEMORY)

    # Part of a place: Budva is still in progress and Kotor stays locked.
    partway = (await integration_client.get("/api/v1/progress")).json()
    assert states(partway, "locations")["budva"] == "in-progress"
    assert states(partway, "locations")["kotor"] == "locked"
    assert (await location_progress(db_session, profile, budva)).completed_at is None

    await record(integration_client, OLD_TOWN_MATCH)

    assert (await location_progress(db_session, profile, budva)).completed_at is not None
    after = (await integration_client.get("/api/v1/progress")).json()
    assert states(after, "locations") == {
        "budva": "completed",
        "kotor": "available",
        "kolasin": "locked",
    }
    assert [chapter["id"] for chapter in after["chapters"]] == [
        "budva-beach",
        "budva-old-town",
        "kotor-walls",
    ]
    # Kotor is open: its game waits for its lesson, not for the place.
    response = await integration_client.post(
        "/api/v1/chapters/kotor-walls/games/memory/result", headers={"Origin": ORIGIN}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "game_locked"


async def test_replaying_a_completed_place_keeps_its_completion(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, budva = await seed_budva_lessons(db_session)
    await sign_in(integration_client, user)
    for path in (BEACH_MEMORY, BEACH_MATCH, OLD_TOWN_MEMORY, OLD_TOWN_MATCH):
        await record(integration_client, path)
    completed_at = (await location_progress(db_session, profile, budva)).completed_at

    await record(integration_client, BEACH_MEMORY)

    assert (await location_progress(db_session, profile, budva)).completed_at == completed_at


async def test_replaying_a_game_completes_a_place_finished_before_it_was_marked(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, budva = await seed_budva_lessons(db_session)
    await sign_in(integration_client, user)
    for path in (BEACH_MEMORY, BEACH_MATCH, OLD_TOWN_MEMORY, OLD_TOWN_MATCH):
        await record(integration_client, path)
    # Every game is done but the place isn't marked, like a place finished
    # before #139 was deployed.
    await db_session.execute(
        update(LocationProgress)
        .where(
            LocationProgress.learning_profile_id == profile.id,
            LocationProgress.location_id == budva.id,
        )
        .values(completed_at=None)
    )
    stuck = (await integration_client.get("/api/v1/progress")).json()
    assert states(stuck, "locations")["kotor"] == "locked"

    await record(integration_client, BEACH_MEMORY)

    assert (await location_progress(db_session, profile, budva)).completed_at is not None
    after = (await integration_client.get("/api/v1/progress")).json()
    assert states(after, "locations")["budva"] == "completed"
    assert states(after, "locations")["kotor"] == "available"


class RecordsAtOnce(SqlAlchemyProgressRepository):
    """After recording its game, waits up to a second for the other call to record one.

    That makes both calls record their game before either reads the chapters
    back, unless the place's row lock makes the second call wait for the
    first to commit. Then the first gives up waiting and goes on.
    """

    def __init__(self, session: AsyncSession, recorded: asyncio.Event, other: asyncio.Event):
        super().__init__(session)
        self.recorded = recorded
        self.other = other

    async def record_game(self, learning_profile_id: UUID, chapter_slug: str, game: GameId) -> None:
        await super().record_game(learning_profile_id, chapter_slug, game)
        self.recorded.set()
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(self.other.wait(), timeout=1)


async def test_the_last_two_games_finished_at_once_complete_the_place(
    test_engine: AsyncEngine,
) -> None:
    # Two requests need two connections, so this test commits its rows and
    # deletes them at the end instead of using the rolled-back `db_session`.
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    user: User | None = None
    try:
        async with session_factory() as session:
            user, profile, budva = await seed_budva_lessons(session)
            await record_games_directly(session, profile, ("budva-beach", "budva-old-town"))
            await session.commit()

        beach_recorded, old_town_recorded = asyncio.Event(), asyncio.Event()
        async with session_factory() as first, session_factory() as second:
            first_service = GameProgressService(
                RecordsAtOnce(first, beach_recorded, old_town_recorded),
                SessionTransactionManager(first),
            )
            second_service = GameProgressService(
                RecordsAtOnce(second, old_town_recorded, beach_recorded),
                SessionTransactionManager(second),
            )
            await asyncio.gather(
                first_service.complete_game(profile.id, "budva-beach", "match"),
                second_service.complete_game(profile.id, "budva-old-town", "match"),
            )

        async with session_factory() as session:
            assert (await location_progress(session, profile, budva)).completed_at is not None
    finally:
        async with session_factory() as session:
            if user is not None:
                # Deleting the user deletes its learning profile and progress.
                await session.execute(delete(User).where(User.id == user.id))
            await session.execute(delete(Chapter).where(Chapter.slug.in_(CHAPTER_SLUGS)))
            await session.execute(delete(Location).where(Location.slug.in_(LOCATION_SLUGS)))
            await session.execute(delete(Region).where(Region.slug.in_(REGION_SLUGS)))
            await session.commit()


async def record_games_directly(
    session: AsyncSession, profile: LearningProfile, chapter_slugs: tuple[str, ...]
) -> None:
    """Store a finished memory game for each chapter, without the endpoint."""

    chapters = await session.scalars(select(Chapter).where(Chapter.slug.in_(chapter_slugs)))
    session.add_all(
        GameResult(learning_profile_id=profile.id, chapter_id=chapter.id, game="memory")
        for chapter in chapters.all()
    )
    await session.flush()
