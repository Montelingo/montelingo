from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("POST", "/api/v1/auth/sign-up", {"email": "user@example.com", "password": "password123"}),
        ("POST", "/api/v1/auth/sign-in", {"email": "user@example.com", "password": "x"}),
        ("POST", "/api/v1/auth/sign-out", None),
        ("GET", "/api/v1/auth/me", None),
        ("POST", "/api/v1/auth/password-reset", {"email": "user@example.com"}),
        (
            "POST",
            "/api/v1/auth/password-reset/confirm",
            {"token": "reset-token", "new_password": "password123"},
        ),
    ],
)
def test_auth_routes_reach_not_implemented_stub(
    client: TestClient, method: str, path: str, payload: dict[str, Any] | None
) -> None:
    response = client.request(method, path, json=payload)

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "not_implemented"


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
