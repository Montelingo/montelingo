from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient


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


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "password123"},
        {"email": "user@example.com", "password": "short"},
        {"email": "user@example.com", "password": "x" * 129},
    ],
)
def test_sign_up_rejects_invalid_input(client: TestClient, payload: dict[str, str]) -> None:
    response = client.post("/api/v1/auth/sign-up", json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_password_reset_token_has_a_maximum_length(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": "t" * 257, "new_password": "password123"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
