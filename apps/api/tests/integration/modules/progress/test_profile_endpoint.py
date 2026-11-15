"""Integration tests for GET and PUT /profile against PostgreSQL."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Argon2PasswordHasher
from app.modules.progress.models import LearningProfile
from app.modules.users.models import User

pytestmark = pytest.mark.integration

PASSWORD = "correct horse battery staple"
ORIGIN = "http://localhost:3000"
EMPTY_PROFILE = {"name": None, "age_band": None, "avatar": None, "is_complete": False}


async def create_user(session: AsyncSession) -> tuple[User, LearningProfile]:
    now = datetime.now(UTC)
    user = User(
        email=f"profile-{uuid4().hex}@example.com",
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


async def put_profile(client: AsyncClient, body: dict[str, str]) -> dict[str, object]:
    response = await client.put("/api/v1/profile", json=body, headers={"Origin": ORIGIN})
    assert response.status_code == 200, response.text
    data: dict[str, object] = response.json()
    return data


async def test_profile_endpoints_require_a_session(integration_client: AsyncClient) -> None:
    get_response = await integration_client.get("/api/v1/profile")
    put_response = await integration_client.put(
        "/api/v1/profile",
        json={"name": "Mia", "age_band": "5-6", "avatar": "fox"},
        headers={"Origin": ORIGIN},
    )

    assert get_response.status_code == 401
    assert put_response.status_code == 401
    assert put_response.json()["error"]["code"] == "authentication_error"


async def test_a_new_profile_is_empty_and_not_complete(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.get("/api/v1/profile")

    assert response.status_code == 200
    assert response.json() == EMPTY_PROFILE


async def test_a_profile_created_at_sign_up_starts_empty(
    integration_client: AsyncClient,
) -> None:
    email = f"sign-up-{uuid4().hex}@example.com"
    sign_up = await integration_client.post(
        "/api/v1/auth/sign-up",
        json={"email": email, "password": PASSWORD},
        headers={"Origin": ORIGIN},
    )
    assert sign_up.status_code == 201, sign_up.text
    sign_in = await integration_client.post(
        "/api/v1/auth/sign-in",
        json={"email": email, "password": PASSWORD},
        headers={"Origin": ORIGIN},
    )
    assert sign_in.status_code == 200, sign_in.text

    response = await integration_client.get("/api/v1/profile")

    assert response.status_code == 200
    assert response.json() == EMPTY_PROFILE


async def test_put_stores_the_trimmed_profile(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)

    saved = await put_profile(
        integration_client, {"name": "  Mia  ", "age_band": "5-6", "avatar": "fox"}
    )
    read = (await integration_client.get("/api/v1/profile")).json()

    expected = {"name": "Mia", "age_band": "5-6", "avatar": "fox", "is_complete": True}
    assert saved == expected
    assert read == expected

    await db_session.refresh(profile)
    assert (profile.name, profile.age_band, profile.avatar) == ("Mia", "5-6", "fox")


async def test_put_replaces_an_earlier_profile(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)

    await put_profile(integration_client, {"name": "Mia", "age_band": "5-6", "avatar": "fox"})
    saved = await put_profile(
        integration_client, {"name": "Luka", "age_band": "7", "avatar": "owl"}
    )

    assert saved == {"name": "Luka", "age_band": "7", "avatar": "owl", "is_complete": True}


async def test_an_invalid_put_changes_nothing(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.put(
        "/api/v1/profile",
        json={"name": "   ", "age_band": "5-6", "avatar": "fox"},
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert (await integration_client.get("/api/v1/profile")).json() == EMPTY_PROFILE


async def test_two_accounts_only_read_and_write_their_own_profile(
    integration_app: FastAPI, db_session: AsyncSession
) -> None:
    first_user, first_profile = await create_user(db_session)
    second_user, second_profile = await create_user(db_session)

    async with (
        AsyncClient(
            transport=ASGITransport(app=integration_app), base_url="http://test"
        ) as first_client,
        AsyncClient(
            transport=ASGITransport(app=integration_app), base_url="http://test"
        ) as second_client,
    ):
        await sign_in(first_client, first_user)
        await sign_in(second_client, second_user)

        await put_profile(first_client, {"name": "Mia", "age_band": "3-4", "avatar": "bunny"})

        assert (await second_client.get("/api/v1/profile")).json() == EMPTY_PROFILE

        await put_profile(second_client, {"name": "Luka", "age_band": "7", "avatar": "bear"})

        first = (await first_client.get("/api/v1/profile")).json()
        second = (await second_client.get("/api/v1/profile")).json()

    assert first == {"name": "Mia", "age_band": "3-4", "avatar": "bunny", "is_complete": True}
    assert second == {"name": "Luka", "age_band": "7", "avatar": "bear", "is_complete": True}

    await db_session.refresh(first_profile)
    await db_session.refresh(second_profile)
    assert (first_profile.user_id, first_profile.name) == (first_user.id, "Mia")
    assert (second_profile.user_id, second_profile.name) == (second_user.id, "Luka")


@pytest.mark.parametrize(
    ("column", "value", "constraint"),
    [
        ("name", "", "ck_learning_profiles_name_length"),
        ("name", "M" * 31, "ck_learning_profiles_name_length"),
        ("age_band", "8", "ck_learning_profiles_age_band"),
        ("avatar", "dragon", "ck_learning_profiles_avatar"),
    ],
)
async def test_the_table_rejects_values_outside_the_profile_rules(
    db_session: AsyncSession, column: str, value: str, constraint: str
) -> None:
    _, profile = await create_user(db_session)
    setattr(profile, column, value)

    with pytest.raises(IntegrityError) as error:
        async with db_session.begin_nested():
            await db_session.flush()

    assert constraint in str(error.value)
