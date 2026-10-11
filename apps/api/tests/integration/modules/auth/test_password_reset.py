from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import Argon2PasswordHasher, SecureToken
from app.infrastructure.email import InMemoryEmailSender, get_email_sender
from app.modules.auth.models import AuthSession, PasswordResetToken
from app.modules.users.models import User


pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_password_reset_full_lifecycle(
    integration_app: FastAPI,
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    # 1. Capture emails without sending real messages.
    email_sender = InMemoryEmailSender()
    integration_app.dependency_overrides[get_email_sender] = lambda: email_sender

    original_password = "OriginalSecurePassword123!"
    new_password = "NewSecurePassword456!"
    email = "password-reset-integration@example.com"

    hasher = Argon2PasswordHasher()

    # 2. Create a real user in PostgreSQL.
    user = User(
        email=email,
        password_hash=hasher.hash(original_password),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db_session.add(user)
    await db_session.flush()

    user_id = user.id

    # 3. Sign in and establish an active session.
    sign_in_response = await integration_client.post(
        "/api/v1/auth/sign-in",
        json={
            "email": email,
            "password": original_password,
        },
    )

    assert sign_in_response.status_code == 200

    me_before = await integration_client.get("/api/v1/auth/me")
    assert me_before.status_code == 200

    sessions_before = (
        await db_session.scalars(select(AuthSession).where(AuthSession.user_id == user_id))
    ).all()

    assert len(sessions_before) == 1

    # 4. Request password reset.
    reset_response = await integration_client.post(
        "/api/v1/auth/password-reset",
        json={"email": email},
    )

    assert reset_response.status_code == 204

    # 5. Verify that the email was generated.
    assert len(email_sender.messages) == 1

    message = email_sender.messages[0]

    assert message.to == email
    assert message.text_body
    assert message.html_body

    settings = get_settings()
    expiry_minutes = settings.password_reset_ttl // 60

    assert f"{expiry_minutes} minutes" in message.text_body

    # 6. Extract the reset link and token from the email.
    reset_link = next(
        line.strip() for line in message.text_body.splitlines() if "/reset-password?token=" in line
    )

    parsed_url = urlparse(reset_link)

    assert parsed_url.path == "/reset-password"

    reset_token = parse_qs(parsed_url.query)["token"][0]

    assert reset_token

    # 7. Verify the hashed reset token in PostgreSQL.
    stored_tokens = (
        await db_session.scalars(
            select(PasswordResetToken).where(PasswordResetToken.user_id == user_id)
        )
    ).all()

    assert len(stored_tokens) == 1

    stored_token = stored_tokens[0]
    stored_token_id = stored_token.id

    assert stored_token.token_hash == SecureToken.hash(reset_token)
    assert stored_token.used_at is None

    # 8. Confirm the reset and set a new password.
    confirm_response = await integration_client.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "token": reset_token,
            "new_password": new_password,
        },
    )

    assert confirm_response.status_code == 204

    # 9. Verify that the old session is revoked.
    me_after = await integration_client.get("/api/v1/auth/me")

    assert me_after.status_code == 401

    remaining_sessions = (
        await db_session.scalars(select(AuthSession).where(AuthSession.user_id == user_id))
    ).all()

    assert len(remaining_sessions) == 0

    # 10. Verify password and token changes in PostgreSQL.
    db_session.expire_all()

    updated_user = await db_session.get(User, user_id)

    assert updated_user is not None
    assert updated_user.password_changed_at is not None

    assert hasher.verify(
        new_password,
        updated_user.password_hash,
    )

    updated_token = await db_session.get(
        PasswordResetToken,
        stored_token_id,
    )

    assert updated_token is not None
    assert updated_token.used_at is not None

    # 11. The same reset token cannot be used twice.
    reused_response = await integration_client.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "token": reset_token,
            "new_password": "AnotherSecurePassword789!",
        },
    )

    assert reused_response.status_code == 400
    assert reused_response.json()["error"]["code"] == "invalid_reset_token"

    # 12. Old password must fail.
    old_sign_in = await integration_client.post(
        "/api/v1/auth/sign-in",
        json={
            "email": email,
            "password": original_password,
        },
    )

    assert old_sign_in.status_code == 401

    # 13. New password must work.
    new_sign_in = await integration_client.post(
        "/api/v1/auth/sign-in",
        json={
            "email": email,
            "password": new_password,
        },
    )

    assert new_sign_in.status_code == 200
