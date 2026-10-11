from __future__ import annotations

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.security import Argon2PasswordHasher
from app.modules.users.models import User

pytestmark = pytest.mark.integration

SIGN_UP_URL = "/api/v1/auth/sign-up"


async def test_sign_up_success(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    response = await integration_client.post(
        SIGN_UP_URL,
        json={
            "email": "  USER@Example.COM  ",
            "password": "password123",
        },
    )

    assert response.status_code == 201

    body = response.json()
    assert UUID(body["id"])
    assert body["email"] == "user@example.com"
    assert body["created_at"]
    assert "password" not in body
    assert "password_hash" not in body

    user = await db_session.scalar(select(User).where(User.email == "user@example.com"))

    assert user is not None
    assert str(user.id) == body["id"]
    assert user.password_hash != "password123"
    assert user.password_hash.startswith("$argon2id$")
    assert Argon2PasswordHasher().verify("password123", user.password_hash)


async def test_sign_up_duplicate_email_returns_409(
    integration_client: AsyncClient,
) -> None:
    first = await integration_client.post(
        SIGN_UP_URL,
        json={
            "email": "user@example.com",
            "password": "password123",
        },
    )

    assert first.status_code == 201

    duplicate = await integration_client.post(
        SIGN_UP_URL,
        json={
            "email": "USER@EXAMPLE.COM",
            "password": "anotherpassword123",
        },
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "email_taken"


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "invalid-email", "password": "password123"},
        {"email": "user@example.com", "password": "short"},
        {"email": "user@example.com", "password": "x" * 129},
    ],
)
async def test_sign_up_validation_returns_422(
    integration_client: AsyncClient,
    payload: dict[str, str],
) -> None:
    response = await integration_client.post(
        SIGN_UP_URL,
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["details"]


async def test_sign_up_password_cannot_equal_email(
    integration_client: AsyncClient,
) -> None:
    response = await integration_client.post(
        SIGN_UP_URL,
        json={
            "email": "user@example.com",
            "password": "user@example.com",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_users_email_unique_constraint(
    db_session: AsyncSession,
) -> None:
    first = User(
        email="unique@example.com",
        password_hash="hash-one",
    )
    db_session.add(first)
    await db_session.flush()

    count = await db_session.scalar(
        select(func.count()).select_from(User).where(func.lower(User.email) == "unique@example.com")
    )

    assert count == 1


async def test_concurrent_sign_up_returns_201_and_409(
    test_engine: AsyncEngine,
) -> None:
    import asyncio
    from uuid import uuid4

    from httpx import ASGITransport
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.db.session import get_db_session
    from app.main import create_app

    email = f"concurrent-{uuid4().hex}@example.com"
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    app = create_app()

    async def get_test_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = get_test_session

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:

            async def register():
                return await client.post(
                    SIGN_UP_URL,
                    json={"email": email, "password": "password123"},
                )

            first, second = await asyncio.gather(register(), register())

        responses = [first, second]
        assert sorted(r.status_code for r in responses) == [201, 409]
        assert (
            next(r for r in responses if r.status_code == 409).json()["error"]["code"]
            == "email_taken"
        )

    finally:
        app.dependency_overrides.clear()
        async with session_factory() as session:
            user = await session.scalar(select(User).where(User.email == email))
            if user is not None:
                await session.delete(user)
                await session.commit()
