from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Argon2PasswordHasher, SecureToken
from app.modules.auth.models import AuthSession
from app.modules.users.models import User

pytestmark = pytest.mark.integration


async def test_sign_in_cookie_attributes_and_sign_out_revokes_session(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    password = "correct horse battery staple"
    user = User(
        email="integration@example.com",
        password_hash=Argon2PasswordHasher().hash(password),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db_session.add(user)
    await db_session.flush()

    sign_in = await integration_client.post(
        "/api/v1/auth/sign-in",
        json={"email": " INTEGRATION@EXAMPLE.COM ", "password": password},
    )

    assert sign_in.status_code == 200
    assert sign_in.json()["email"] == "integration@example.com"
    cookie = sign_in.headers["set-cookie"]
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/" in cookie
    assert "Max-Age=2592000" in cookie

    session = await db_session.scalar(select(AuthSession).where(AuthSession.user_id == user.id))
    assert session is not None
    assert session.token_hash != integration_client.cookies.get("montelingo_session")
    assert SecureToken.hash(integration_client.cookies["montelingo_session"]) == session.token_hash

    me = await integration_client.get("/api/v1/auth/me")
    assert me.status_code == 200

    sign_out = await integration_client.post("/api/v1/auth/sign-out")
    assert sign_out.status_code == 204
    assert "Max-Age=0" in sign_out.headers["set-cookie"]

    assert await db_session.get(AuthSession, session.id) is None
    me_after_sign_out = await integration_client.get("/api/v1/auth/me")
    assert me_after_sign_out.status_code == 401
    assert me_after_sign_out.json()["error"]["code"] == "authentication_error"
