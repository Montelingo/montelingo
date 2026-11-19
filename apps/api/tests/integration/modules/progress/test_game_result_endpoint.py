"""Integration tests for POST /chapters/{chapter_id}/games/{game_id}/result (#126)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Chapter, Location
from app.modules.progress.models import (
    ChapterProgress,
    GameResult,
    LearningProfile,
    LocationProgress,
)

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
