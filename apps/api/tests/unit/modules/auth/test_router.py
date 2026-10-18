from __future__ import annotations

from collections.abc import Iterator
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from app.core.security import SecureToken
from app.infrastructure.email import InMemoryEmailSender
from app.modules.auth.dependencies import get_auth_service

from .test_password_reset_service import (
    NOW,
    FailingEmailSender,
    FakeResetRepository,
    MutableClock,
    make_user,
)
from .test_password_reset_service import make_service as make_reset_service
from .test_sign_up_service import FakeUsersService, make_sign_up_service

ORIGIN = {"Origin": "http://localhost:3000"}


@pytest.fixture
def email_sender() -> InMemoryEmailSender:
    return InMemoryEmailSender()


@pytest.fixture
def reset_repository(
    client: TestClient, email_sender: InMemoryEmailSender
) -> Iterator[FakeResetRepository]:
    repository = FakeResetRepository(make_user())
    service = make_reset_service(repository, MutableClock(NOW), email_sender)
    client.app.dependency_overrides[get_auth_service] = lambda: service
    yield repository
    client.app.dependency_overrides.pop(get_auth_service, None)


def test_password_reset_emails_the_issued_token(
    client: TestClient,
    reset_repository: FakeResetRepository,
    email_sender: InMemoryEmailSender,
) -> None:
    response = client.post(
        "/api/v1/auth/password-reset", json={"email": "user@example.com"}, headers=ORIGIN
    )

    assert response.status_code == 204
    [message] = email_sender.messages
    assert message.to == "user@example.com"
    link = next(line for line in message.text_body.splitlines() if "token=" in line)
    [token] = parse_qs(urlsplit(link).query)["token"]
    assert list(reset_repository.tokens) == [SecureToken.hash(token)]


def test_password_reset_for_unknown_email_answers_the_same_and_sends_nothing(
    client: TestClient,
    reset_repository: FakeResetRepository,
    email_sender: InMemoryEmailSender,
) -> None:
    response = client.post(
        "/api/v1/auth/password-reset", json={"email": "nobody@example.com"}, headers=ORIGIN
    )

    assert response.status_code == 204
    assert email_sender.messages == []
    assert reset_repository.tokens == {}


def test_password_reset_email_failure_does_not_change_the_response(client: TestClient) -> None:
    repository = FakeResetRepository(make_user())
    service = make_reset_service(repository, MutableClock(NOW), FailingEmailSender())
    client.app.dependency_overrides[get_auth_service] = lambda: service
    try:
        response = client.post(
            "/api/v1/auth/password-reset", json={"email": "user@example.com"}, headers=ORIGIN
        )
    finally:
        client.app.dependency_overrides.pop(get_auth_service, None)

    assert response.status_code == 204
    assert len(repository.tokens) == 1


def test_password_reset_confirm_rejects_an_invalid_token(
    client: TestClient, reset_repository: FakeResetRepository
) -> None:
    response = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": "not-a-real-token", "new_password": "password123"},
        headers=ORIGIN,
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_reset_token"


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/auth/password-reset", {"email": "user@example.com"}),
        (
            "/api/v1/auth/password-reset/confirm",
            {"token": "reset-token", "new_password": "password123"},
        ),
    ],
)
def test_password_reset_routes_reject_a_foreign_origin(
    client: TestClient, path: str, payload: dict[str, str]
) -> None:
    response = client.post(path, json=payload, headers={"Origin": "https://foreign.example"})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "authorization_error"


def test_password_reset_request_is_rate_limited_per_email(
    client: TestClient,
    reset_repository: FakeResetRepository,
    email_sender: InMemoryEmailSender,
) -> None:
    for _ in range(3):
        response = client.post(
            "/api/v1/auth/password-reset", json={"email": "user@example.com"}, headers=ORIGIN
        )
        assert response.status_code == 204

    response = client.post(
        "/api/v1/auth/password-reset", json={"email": "user@example.com"}, headers=ORIGIN
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"


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


def test_sign_up_validates_input_before_reaching_the_service(client: TestClient) -> None:
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
