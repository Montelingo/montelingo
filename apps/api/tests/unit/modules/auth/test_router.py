from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("POST", "/api/v1/auth/sign-up", {"email": "user@example.com", "password": "password123"}),
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
    response = client.request(method, path, json=payload)

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "not_implemented"


def test_sign_out_without_cookie_is_idempotent(client: TestClient) -> None:
    response = client.post("/api/v1/auth/sign-out")

    assert response.status_code == 204


def test_me_without_cookie_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_auth_routes_validate_input_before_stub(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/sign-up",
        json={"email": "not-an-email", "password": "short"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_password_reset_token_has_a_maximum_length(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": "t" * 257, "new_password": "password123"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_sign_up_rate_limit_returns_envelope_and_retry_after(client: TestClient) -> None:
    headers = {"Origin": "http://localhost:3000"}
    for _ in range(10):
        assert (
            client.post(
                "/api/v1/auth/sign-up",
                json={"email": "user@example.com", "password": "password123"},
                headers=headers,
            ).status_code
            == 501
        )

    response = client.post(
        "/api/v1/auth/sign-up",
        json={"email": "user@example.com", "password": "password123"},
        headers=headers,
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert response.headers["Retry-After"] == "3600"


def test_foreign_origin_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/sign-up",
        json={"email": "user@example.com", "password": "password123"},
        headers={"Origin": "https://foreign.example"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "authorization_error"
