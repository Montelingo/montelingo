"""Integration tests for the database-backed GET /progress endpoint."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Argon2PasswordHasher
from app.modules.content.models import Chapter, Location, Region
from app.modules.progress.models import (
    ChapterProgress,
    GameResult,
    LearningProfile,
    LocationProgress,
)
from app.modules.users.models import User

pytestmark = pytest.mark.integration

PASSWORD = "correct horse battery staple"
ORIGIN = "http://localhost:3000"


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
    kolasin = Location(
        region_id=north.id,
        slug="kolasin",
        name="Kolasin",
        position=1,
        is_start=False,
    )

    session.add_all([budva, kotor, kolasin])
    await session.flush()
    return budva, kotor


async def create_user(
    session: AsyncSession,
) -> tuple[User, LearningProfile]:
    now = datetime.now(UTC)
    user = User(
        email=f"progress-{uuid4().hex}@example.com",
        password_hash=Argon2PasswordHasher().hash(PASSWORD),
        created_at=now,
        updated_at=now,
    )
    session.add(user)
    await session.flush()

    profile = LearningProfile(user_id=user.id)
    session.add(profile)
    await session.flush()
    return user, profile


async def sign_in(client: AsyncClient, user: User) -> None:
    response = await client.post(
        "/api/v1/auth/sign-in",
        json={"email": user.email, "password": PASSWORD},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200, response.text


def states(data: dict, key: str) -> dict[str, str]:
    return {item["id"]: item["state"] for item in data[key]}


async def test_progress_requires_authentication(
    integration_client: AsyncClient,
) -> None:
    response = await integration_client.get("/api/v1/progress")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


async def test_new_account_has_only_starting_location_available(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await seed_map(db_session)
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.get("/api/v1/progress")

    assert response.status_code == 200
    data = response.json()

    assert states(data, "regions") == {
        "coast": "available",
        "north": "locked",
    }
    assert states(data, "locations") == {
        "budva": "available",
        "kotor": "locked",
        "kolasin": "locked",
    }


async def test_progress_rows_change_endpoint_states(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    user, profile = await create_user(db_session)

    now = datetime.now(UTC)
    db_session.add_all(
        [
            LocationProgress(
                learning_profile_id=profile.id,
                location_id=budva.id,
                started_at=now,
            ),
            LocationProgress(
                learning_profile_id=profile.id,
                location_id=kotor.id,
                started_at=now,
                completed_at=now,
            ),
        ]
    )
    await db_session.flush()
    await sign_in(integration_client, user)

    response = await integration_client.get("/api/v1/progress")

    assert response.status_code == 200
    data = response.json()

    assert states(data, "locations") == {
        "budva": "in-progress",
        "kotor": "completed",
        "kolasin": "locked",
    }
    assert states(data, "regions") == {
        "coast": "available",
        "north": "locked",
    }


async def test_two_accounts_only_see_their_own_progress(
    integration_app: FastAPI,
    db_session: AsyncSession,
) -> None:
    budva, _ = await seed_map(db_session)

    first_user, first_profile = await create_user(db_session)
    second_user, second_profile = await create_user(db_session)

    assert first_profile.id != second_profile.id

    db_session.add(
        LocationProgress(
            learning_profile_id=first_profile.id,
            location_id=budva.id,
            started_at=datetime.now(UTC),
        )
    )
    await db_session.flush()

    transport_first = ASGITransport(app=integration_app)
    transport_second = ASGITransport(app=integration_app)

    async with (
        AsyncClient(
            transport=transport_first,
            base_url="http://test",
        ) as first_client,
        AsyncClient(
            transport=transport_second,
            base_url="http://test",
        ) as second_client,
    ):
        await sign_in(first_client, first_user)
        await sign_in(second_client, second_user)

        first_response = await first_client.get("/api/v1/progress")
        second_response = await second_client.get("/api/v1/progress")

        assert first_response.status_code == 200
        assert second_response.status_code == 200

        first_locations = states(first_response.json(), "locations")
        second_locations = states(second_response.json(), "locations")

        assert first_locations["budva"] == "in-progress"
        assert second_locations["budva"] == "available"

        assert first_locations["kotor"] == "locked"
        assert second_locations["kotor"] == "locked"


async def test_endpoint_query_count_stays_constant(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    budva, _ = await seed_map(db_session)
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)

    bind = db_session.sync_session.get_bind()
    assert bind is not None

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

    async def measure() -> int:
        statements.clear()

        response = await integration_client.get("/api/v1/progress")
        assert response.status_code == 200, response.text

        return len(statements)

    event.listen(bind, "before_cursor_execute", count_queries)

    try:
        before = await measure()
        assert before > 0

        another_region = Region(
            slug="central",
            name="Central",
            position=3,
        )
        db_session.add(another_region)
        await db_session.flush()

        another_location = Location(
            region_id=another_region.id,
            slug="podgorica",
            name="Podgorica",
            position=1,
            is_start=False,
        )
        db_session.add(another_location)
        await db_session.flush()

        chapter = Chapter(
            location_id=budva.id,
            slug="budva-beach",
            title="Na plaži",
            position=1,
        )
        db_session.add(chapter)
        await db_session.flush()

        now = datetime.now(UTC)
        db_session.add_all(
            [
                LocationProgress(
                    learning_profile_id=profile.id,
                    location_id=budva.id,
                    started_at=now,
                ),
                ChapterProgress(
                    learning_profile_id=profile.id,
                    chapter_id=chapter.id,
                    lesson_completed_at=now,
                ),
                GameResult(
                    learning_profile_id=profile.id,
                    chapter_id=chapter.id,
                    game="memory",
                    completed_at=now,
                ),
            ]
        )
        await db_session.flush()

        after = await measure()

        assert after == before, f"Endpoint query count changed: {before} -> {after}"
    finally:
        event.remove(bind, "before_cursor_execute", count_queries)


LOCKED_GAMES = [{"id": "memory", "state": "locked"}, {"id": "match", "state": "locked"}]


async def seed_chapters(
    session: AsyncSession, budva: Location, kotor: Location
) -> tuple[Chapter, Chapter]:
    # Positions are the recording order. Kotor's chapter is recorded between
    # Budva's, so the response has to follow the map, not the recording order.
    beach = Chapter(location_id=budva.id, slug="budva-beach", title="Na plaži", position=1)
    walls = Chapter(location_id=kotor.id, slug="kotor-walls", title="Zidine", position=2)
    old_town = Chapter(location_id=budva.id, slug="budva-old-town", title="Stari grad", position=3)
    session.add_all([beach, walls, old_town])
    await session.flush()
    return beach, old_town


async def test_new_account_sees_the_starting_place_chapters(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.get("/api/v1/progress")

    assert response.status_code == 200
    assert response.json()["chapters"] == [
        {"id": "budva-beach", "lesson": "todo", "games": LOCKED_GAMES},
        {"id": "budva-old-town", "lesson": "todo", "games": LOCKED_GAMES},
    ]


async def test_chapters_of_a_started_place_are_listed(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    db_session.add(
        LocationProgress(
            learning_profile_id=profile.id,
            location_id=kotor.id,
            started_at=datetime.now(UTC),
        )
    )
    await db_session.flush()
    await sign_in(integration_client, user)

    response = await integration_client.get("/api/v1/progress")

    assert response.status_code == 200
    assert [chapter["id"] for chapter in response.json()["chapters"]] == [
        "budva-beach",
        "budva-old-town",
        "kotor-walls",
    ]


async def test_two_accounts_only_see_their_own_chapters(
    integration_app: FastAPI,
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    first_user, first_profile = await create_user(db_session)
    second_user, _ = await create_user(db_session)

    now = datetime.now(UTC)
    db_session.add_all(
        [
            LocationProgress(
                learning_profile_id=first_profile.id,
                location_id=budva.id,
                started_at=now,
            ),
            ChapterProgress(
                learning_profile_id=first_profile.id,
                chapter_id=beach.id,
                lesson_completed_at=now,
            ),
            GameResult(
                learning_profile_id=first_profile.id,
                chapter_id=beach.id,
                game="memory",
                completed_at=now,
            ),
        ]
    )
    await db_session.flush()

    async with (
        AsyncClient(transport=ASGITransport(app=integration_app), base_url="http://test") as first,
        AsyncClient(transport=ASGITransport(app=integration_app), base_url="http://test") as second,
    ):
        await sign_in(first, first_user)
        await sign_in(second, second_user)

        first_response = await first.get("/api/v1/progress")
        second_response = await second.get("/api/v1/progress")

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["chapters"] == [
        {
            "id": "budva-beach",
            "lesson": "done",
            "games": [
                {"id": "memory", "state": "completed"},
                {"id": "match", "state": "available"},
            ],
        },
        {"id": "budva-old-town", "lesson": "todo", "games": LOCKED_GAMES},
    ]
    assert second_response.json()["chapters"] == [
        {"id": "budva-beach", "lesson": "todo", "games": LOCKED_GAMES},
        {"id": "budva-old-town", "lesson": "todo", "games": LOCKED_GAMES},
    ]


# Issue #125: POST lesson seen


async def test_complete_lesson_records_completion_and_starts_location(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(
        "/api/v1/chapters/budva-beach/lesson", headers={"Origin": ORIGIN}
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": "budva-beach",
        "lesson": "done",
        "games": [
            {"id": "memory", "state": "available"},
            {"id": "match", "state": "available"},
        ],
    }
    row = await db_session.get(ChapterProgress, (profile.id, beach.id))
    assert row is not None and row.lesson_completed_at is not None
    place = await db_session.get(LocationProgress, (profile.id, budva.id))
    assert place is not None and place.started_at is not None

    progress = await integration_client.get("/api/v1/progress")
    assert progress.status_code == 200
    assert states(progress.json(), "locations")["budva"] == "in-progress"


async def test_complete_lesson_is_idempotent_and_keeps_first_timestamp(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)
    path = "/api/v1/chapters/budva-beach/lesson"

    first = await integration_client.post(path, headers={"Origin": ORIGIN})
    assert first.status_code == 200, first.text
    first_chapter = await db_session.get(ChapterProgress, (profile.id, beach.id))
    first_location = await db_session.get(LocationProgress, (profile.id, budva.id))
    assert first_chapter is not None and first_location is not None
    completed_at = first_chapter.lesson_completed_at
    started_at = first_location.started_at

    second = await integration_client.post(path, headers={"Origin": ORIGIN})
    assert second.status_code == 200, second.text
    assert second.json() == first.json()
    db_session.expire_all()
    await db_session.refresh(profile)
    await db_session.refresh(beach)
    await db_session.refresh(budva)
    chapter = await db_session.get(ChapterProgress, (profile.id, beach.id))
    location = await db_session.get(LocationProgress, (profile.id, budva.id))
    assert chapter is not None and chapter.lesson_completed_at == completed_at
    assert location is not None and location.started_at == started_at


async def test_complete_lesson_does_not_reset_existing_location_start(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    initial_start = datetime(2026, 1, 1, tzinfo=UTC)
    db_session.add(
        LocationProgress(
            learning_profile_id=profile.id, location_id=budva.id, started_at=initial_start
        )
    )
    await db_session.flush()
    await sign_in(integration_client, user)

    response = await integration_client.post(
        "/api/v1/chapters/budva-beach/lesson", headers={"Origin": ORIGIN}
    )
    assert response.status_code == 200, response.text
    db_session.expire_all()
    await db_session.refresh(profile)
    await db_session.refresh(budva)
    place = await db_session.get(LocationProgress, (profile.id, budva.id))
    assert place is not None and place.started_at == initial_start


async def test_complete_lesson_unknown_chapter_returns_404(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)
    response = await integration_client.post(
        "/api/v1/chapters/not-a-chapter/lesson", headers={"Origin": ORIGIN}
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "content_not_found"


async def test_complete_lesson_locked_place_returns_409_without_writes(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)
    response = await integration_client.post(
        "/api/v1/chapters/kotor-walls/lesson", headers={"Origin": ORIGIN}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"
    assert await db_session.get(LocationProgress, (profile.id, kotor.id)) is None


async def test_complete_lesson_without_session_returns_401(integration_client: AsyncClient) -> None:
    response = await integration_client.post(
        "/api/v1/chapters/budva-beach/lesson", headers={"Origin": ORIGIN}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


async def test_complete_lesson_isolated_between_two_accounts(
    integration_app: FastAPI, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    first_user, _ = await create_user(db_session)
    second_user, _ = await create_user(db_session)

    async with (
        AsyncClient(transport=ASGITransport(app=integration_app), base_url="http://test") as first,
        AsyncClient(transport=ASGITransport(app=integration_app), base_url="http://test") as second,
    ):
        await sign_in(first, first_user)
        await sign_in(second, second_user)
        completed = await first.post(
            "/api/v1/chapters/budva-beach/lesson", headers={"Origin": ORIGIN}
        )
        first_state = await first.get("/api/v1/progress")
        second_state = await second.get("/api/v1/progress")

    assert completed.status_code == 200, completed.text
    assert first_state.status_code == 200
    assert second_state.status_code == 200
    assert first_state.json()["chapters"][0]["lesson"] == "done"
    assert second_state.json()["chapters"][0]["lesson"] == "todo"
    assert states(first_state.json(), "locations")["budva"] == "in-progress"
    assert states(second_state.json(), "locations")["budva"] == "available"
