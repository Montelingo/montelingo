from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.modules.auth.dependencies import get_auth_service

from .test_sign_up_service import FakeUsersService, make_sign_up_service


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("POST", "/api/v1/auth/password-reset", {"email": "user@example.com"}),
        (
            "POST",
            "/api/v1/auth/password-reset/confirm",
            {"token": "reset-token", "new_password": "password123"},
        ),
    ],
)
def test_unimplemented_auth_routes_reach_stub(
    client: TestClient, method: str, path: str, payload: dict[str, Any] | None
) -> None:
    response = client.request(
        method, path, json=payload, headers={"Origin": "http://localhost:3000"}
    )

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "not_implemented"


def test_sign_out_without_cookie_is_idempotent(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/sign-out",
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 204


def test_me_without_cookie_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "password123"},
        {"email": "user@example.com", "password": "short"},
        {"email": "user@example.com", "password": "x" * 129},
    ],
)
def test_sign_up_rejects_invalid_input(client: TestClient, payload: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/auth/sign-up",
        json=payload,
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_auth_routes_validate_input_before_stub(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/sign-up",
        json={"email": "not-an-email", "password": "short"},
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_password_reset_token_has_a_maximum_length(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": "t" * 257, "new_password": "password123"},
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_sign_up_rate_limit_returns_envelope_and_retry_after(
    client: TestClient,
) -> None:
    users = FakeUsersService()
    service, _ = make_sign_up_service(users)

    client.app.dependency_overrides[get_auth_service] = lambda: service

    try:
        headers = {"Origin": "http://localhost:3000"}

        for _ in range(10):
            response = client.post(
                "/api/v1/auth/sign-up",
                json={
                    "email": "user@example.com",
                    "password": "password123",
                },
                headers=headers,
            )
            assert response.status_code == 201

        response = client.post(
            "/api/v1/auth/sign-up",
            json={
                "email": "user@example.com",
                "password": "password123",
            },
            headers=headers,
        )

        assert response.status_code == 429
        assert response.json()["error"]["code"] == "rate_limited"

        retry_after = int(response.headers["Retry-After"])
        assert 1 <= retry_after <= 3600

    finally:
        client.app.dependency_overrides.pop(get_auth_service, None)


def test_foreign_origin_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/sign-up",
        json={"email": "user@example.com", "password": "password123"},
        headers={"Origin": "https://foreign.example"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "authorization_error"
