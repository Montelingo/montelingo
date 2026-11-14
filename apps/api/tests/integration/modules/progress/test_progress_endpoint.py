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
from app.modules.content.models import Location, Region
from app.modules.progress.models import LearningProfile, LocationProgress
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

        db_session.add(
            LocationProgress(
                learning_profile_id=profile.id,
                location_id=budva.id,
                started_at=datetime.now(UTC),
            )
        )
        await db_session.flush()

        after = await measure()

        assert after == before, f"Endpoint query count changed: {before} -> {after}"
    finally:
        event.remove(bind, "before_cursor_execute", count_queries)
