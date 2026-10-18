from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Argon2PasswordHasher, SecureToken
from app.infrastructure.email import InMemoryEmailSender, get_email_sender
from app.modules.auth.models import AuthSession, PasswordResetToken
from app.modules.users.models import User

pytestmark = pytest.mark.integration

ORIGIN = {"Origin": "http://localhost:3000"}
OLD_PASSWORD = "original password 123"
NEW_PASSWORD = "brand new password 456"


@pytest.fixture
def email_sender(integration_app: FastAPI) -> InMemoryEmailSender:
    sender = InMemoryEmailSender()
    integration_app.dependency_overrides[get_email_sender] = lambda: sender
    return sender


async def create_user(db_session: AsyncSession, email: str) -> User:
    user = User(
        email=email,
        password_hash=Argon2PasswordHasher().hash(OLD_PASSWORD),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def request_reset_token(client: AsyncClient, sender: InMemoryEmailSender, email: str) -> str:
    response = await client.post(
        "/api/v1/auth/password-reset", json={"email": email}, headers=ORIGIN
    )
    assert response.status_code == 204
    link = next(line for line in sender.messages[-1].text_body.splitlines() if "token=" in line)
    assert urlsplit(link).path == "/reset-password"
    return parse_qs(urlsplit(link).query)["token"][0]


async def confirm_status(client: AsyncClient, token: str, password: str = NEW_PASSWORD) -> int:
    response = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "new_password": password},
        headers=ORIGIN,
    )
    if response.status_code == 400:
        assert response.json()["error"]["code"] == "invalid_reset_token"
    return response.status_code


async def sign_in(client: AsyncClient, email: str, password: str) -> int:
    response = await client.post(
        "/api/v1/auth/sign-in", json={"email": email, "password": password}, headers=ORIGIN
    )
    return response.status_code


async def test_reset_changes_password_revokes_sessions_and_does_not_sign_in(
    integration_client: AsyncClient,
    db_session: AsyncSession,
    email_sender: InMemoryEmailSender,
) -> None:
    email = "reset-lifecycle@example.com"
    user = await create_user(db_session, email)
    assert await sign_in(integration_client, email, OLD_PASSWORD) == 200
    assert (await integration_client.get("/api/v1/auth/me")).status_code == 200

    token = await request_reset_token(integration_client, email_sender, email)

    stored = await db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )
    assert stored is not None
    assert stored.token_hash == SecureToken.hash(token)
    assert stored.used_at is None

    confirm_response = await integration_client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "new_password": NEW_PASSWORD},
        headers=ORIGIN,
    )
    assert confirm_response.status_code == 204
    assert "set-cookie" not in confirm_response.headers

    # The old session cookie is still in the client, and no longer works.
    me = await integration_client.get("/api/v1/auth/me")
    assert me.status_code == 401
    sessions = await db_session.scalars(select(AuthSession).where(AuthSession.user_id == user.id))
    assert sessions.all() == []

    await db_session.refresh(user)
    assert user.password_changed_at is not None
    await db_session.refresh(stored)
    assert stored.used_at is not None

    assert await confirm_status(integration_client, token, "another password 789") == 400
    assert await sign_in(integration_client, email, OLD_PASSWORD) == 401
    assert await sign_in(integration_client, email, NEW_PASSWORD) == 200


async def test_requesting_again_invalidates_the_earlier_link(
    integration_client: AsyncClient,
    db_session: AsyncSession,
    email_sender: InMemoryEmailSender,
) -> None:
    email = "reset-replaced@example.com"
    user = await create_user(db_session, email)

    first = await request_reset_token(integration_client, email_sender, email)
    second = await request_reset_token(integration_client, email_sender, email)

    tokens = await db_session.scalars(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )
    assert [t.token_hash for t in tokens.all()] == [SecureToken.hash(second)]
    assert await confirm_status(integration_client, first) == 400
    assert await confirm_status(integration_client, second) == 204


async def test_expired_token_is_rejected(
    integration_client: AsyncClient,
    db_session: AsyncSession,
    email_sender: InMemoryEmailSender,
) -> None:
    email = "reset-expired@example.com"
    user = await create_user(db_session, email)
    token = await request_reset_token(integration_client, email_sender, email)

    stored = await db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )
    assert stored is not None
    stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.flush()

    assert await confirm_status(integration_client, token) == 400
    assert await sign_in(integration_client, email, OLD_PASSWORD) == 200


async def test_unknown_email_answers_204_and_stores_nothing(
    integration_client: AsyncClient,
    db_session: AsyncSession,
    email_sender: InMemoryEmailSender,
) -> None:
    tokens_before = await db_session.scalar(select(func.count()).select_from(PasswordResetToken))

    response = await integration_client.post(
        "/api/v1/auth/password-reset", json={"email": "nobody@example.com"}, headers=ORIGIN
    )

    assert response.status_code == 204
    assert email_sender.messages == []
    tokens_after = await db_session.scalar(select(func.count()).select_from(PasswordResetToken))
    assert tokens_after == tokens_before
