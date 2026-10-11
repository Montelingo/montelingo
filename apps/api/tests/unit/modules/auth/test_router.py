
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.infrastructure.email import get_email_sender
from app.modules.auth.dependencies import get_auth_service


def test_sign_up_returns_201(client: TestClient) -> None:
    user = SimpleNamespace(
        id="123e4567-e89b-12d3-a456-426614174000",
        email="user@example.com",
        created_at=datetime.now(timezone.utc),
    )

    service = SimpleNamespace(
        sign_up=AsyncMock(return_value=user),
    )

    client.app.dependency_overrides[get_auth_service] = lambda: service

    try:
        response = client.post(
            "/api/v1/auth/sign-up",
            json={
                "email": "user@example.com",
                "password": "SecurePassword123!",
            },
        )

        assert response.status_code == 201
        assert response.json()["email"] == "user@example.com"

        service.sign_up.assert_awaited_once_with(
            email="user@example.com",
            password="SecurePassword123!",
        )
    finally:
        client.app.dependency_overrides.pop(get_auth_service, None)


def test_password_reset_unknown_email_returns_204(
    client: TestClient,
) -> None:
    service = SimpleNamespace(
        request_password_reset=AsyncMock(return_value=None),
    )

    email_sender = SimpleNamespace(
        send=AsyncMock(),
    )

    client.app.dependency_overrides[get_auth_service] = lambda: service
    client.app.dependency_overrides[get_email_sender] = lambda: email_sender

    try:
        response = client.post(
            "/api/v1/auth/password-reset",
            json={"email": "unknown@example.com"},
        )

        assert response.status_code == 204

        service.request_password_reset.assert_awaited_once_with(
            "unknown@example.com"
        )

        email_sender.send.assert_not_awaited()
    finally:
        client.app.dependency_overrides.pop(get_auth_service, None)
        client.app.dependency_overrides.pop(get_email_sender, None)


def test_password_reset_confirm_returns_204(
    client: TestClient,
) -> None:
    service = SimpleNamespace(
        confirm_password_reset=AsyncMock(return_value=None),
    )

    client.app.dependency_overrides[get_auth_service] = lambda: service

    try:
        response = client.post(
            "/api/v1/auth/password-reset/confirm",
            json={
                "token": "reset-token",
                "new_password": "NewSecurePassword123!",
            },
        )

        assert response.status_code == 204

        service.confirm_password_reset.assert_awaited_once_with(
            raw_token="reset-token",
            new_password="NewSecurePassword123!",
        )
    finally:
        client.app.dependency_overrides.pop(get_auth_service, None)


def test_sign_out_without_cookie_is_idempotent(
    client: TestClient,
) -> None:
    response = client.post("/api/v1/auth/sign-out")
    assert response.status_code == 204


def test_me_without_cookie_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_auth_routes_validate_input(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/sign-up",
        json={"email": "not-an-email", "password": "short"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_password_reset_token_has_a_maximum_length(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "token": "t" * 257,
            "new_password": "password123",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
