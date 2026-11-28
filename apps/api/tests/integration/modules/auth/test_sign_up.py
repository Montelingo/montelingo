from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.security import Argon2PasswordHasher
from app.modules.progress.models import LearningProfile
from app.modules.users.models import User
from app.modules.users.privacy import PRIVACY_POLICY_VERSION

pytestmark = pytest.mark.integration

SIGN_UP_URL = "/api/v1/auth/sign-up"
SIGN_UP_HEADERS = {"Origin": "http://localhost:3000"}
# What the sign-up page sends with the credentials (ADR 0008).
CONSENT = {"parental_consent": True, "privacy_policy_version": PRIVACY_POLICY_VERSION}


async def test_sign_up_success(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    response = await integration_client.post(
        SIGN_UP_URL,
        json={
            "email": "  USER@Example.COM  ",
            "password": "password123",
            **CONSENT,
        },
        headers=SIGN_UP_HEADERS,
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
    profile = await db_session.scalar(
        select(LearningProfile).where(LearningProfile.user_id == user.id)
    )
    assert profile is not None


async def test_sign_up_stores_the_consent_and_policy_version(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    before = datetime.now(UTC)
    response = await integration_client.post(
        SIGN_UP_URL,
        json={"email": "consent@example.com", "password": "password123", **CONSENT},
        headers=SIGN_UP_HEADERS,
    )
    after = datetime.now(UTC)

    assert response.status_code == 201, response.text
    user = await db_session.scalar(select(User).where(User.email == "consent@example.com"))
    assert user is not None
    assert user.privacy_policy_version == PRIVACY_POLICY_VERSION
    # The server's clock, stored as timestamptz. The slack covers clock skew
    # between the test process and PostgreSQL, which share one host here.
    assert user.consent_accepted_at is not None
    assert user.consent_accepted_at.tzinfo is not None
    assert before - timedelta(seconds=5) <= user.consent_accepted_at <= after + timedelta(seconds=5)


@pytest.mark.parametrize(
    ("consent", "status", "code"),
    [
        ({**CONSENT, "parental_consent": False}, 422, "validation_error"),
        ({"privacy_policy_version": PRIVACY_POLICY_VERSION}, 422, "validation_error"),
        ({**CONSENT, "privacy_policy_version": "2020-01-01"}, 409, "privacy_policy_outdated"),
    ],
    ids=["not-accepted", "missing", "outdated-version"],
)
async def test_sign_up_without_valid_consent_creates_no_account(
    integration_client: AsyncClient,
    db_session: AsyncSession,
    consent: dict[str, object],
    status: int,
    code: str,
) -> None:
    response = await integration_client.post(
        SIGN_UP_URL,
        json={"email": "no-consent@example.com", "password": "password123", **consent},
        headers=SIGN_UP_HEADERS,
    )

    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    count = await db_session.scalar(
        select(func.count()).select_from(User).where(User.email == "no-consent@example.com")
    )
    assert count == 0


async def test_sign_up_duplicate_email_returns_409(
    integration_client: AsyncClient,
) -> None:
    first = await integration_client.post(
        SIGN_UP_URL,
        json={
            "email": "user@example.com",
            "password": "password123",
            **CONSENT,
        },
        headers=SIGN_UP_HEADERS,
    )

    assert first.status_code == 201

    duplicate = await integration_client.post(
        SIGN_UP_URL,
        json={
            "email": "USER@EXAMPLE.COM",
            "password": "anotherpassword123",
            **CONSENT,
        },
        headers=SIGN_UP_HEADERS,
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
        json={**payload, **CONSENT},
        headers=SIGN_UP_HEADERS,
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
            **CONSENT,
        },
        headers=SIGN_UP_HEADERS,
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
                    json={"email": email, "password": "password123", **CONSENT},
                    headers=SIGN_UP_HEADERS,
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
