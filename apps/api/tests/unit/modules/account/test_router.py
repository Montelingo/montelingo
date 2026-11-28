from __future__ import annotations

import logging
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.infrastructure.email import InMemoryEmailSender
from app.modules.account.dependencies import get_account_service
from app.modules.auth.dependencies import get_current_session

from .test_service import make_service, make_session

DELETE = "/api/v1/account/delete"
ORIGIN = {"Origin": "http://localhost:3000"}


@pytest.fixture
def signed_in(client: TestClient) -> Iterator[tuple[TestClient, InMemoryEmailSender]]:
    """A client whose session is a signed-in account, with a fake service behind it."""
    sender = InMemoryEmailSender()
    service, *_ = make_service(email_sender=sender)
    session = make_session()
    client.app.dependency_overrides[get_current_session] = lambda: session
    client.app.dependency_overrides[get_account_service] = lambda: service
    yield client, sender
    client.app.dependency_overrides.clear()


def wrong_password(client: TestClient) -> None:
    """Puts a service behind the client that rejects every password."""
    service = make_service(valid=False)[0]
    client.app.dependency_overrides[get_account_service] = lambda: service


def test_deleting_answers_204_clears_the_cookie_and_sends_the_email(
    signed_in: tuple[TestClient, InMemoryEmailSender],
) -> None:
    client, sender = signed_in

    response = client.post(DELETE, json={"password": "password123"}, headers=ORIGIN)

    assert response.status_code == 204
    assert response.content == b""
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{get_settings().session_cookie_name}=")
    assert "Max-Age=0" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/" in cookie
    assert [message.to for message in sender.messages] == ["family@example.com"]


def test_the_deletion_is_logged_by_user_and_request_id_never_by_email(
    signed_in: tuple[TestClient, InMemoryEmailSender], caplog: pytest.LogCaptureFixture
) -> None:
    client, _ = signed_in
    session = client.app.dependency_overrides[get_current_session]()

    with caplog.at_level(logging.WARNING, logger="app.modules.account.router"):
        response = client.post(
            DELETE,
            json={"password": "password123"},
            headers={**ORIGIN, "X-Request-Id": "request-251"},
        )

    assert response.status_code == 204
    [record] = [r for r in caplog.records if r.name == "app.modules.account.router"]
    assert (
        record.getMessage() == f"account_deleted user_id={session.user.id} request_id=request-251"
    )
    assert "family@example.com" not in caplog.text


def test_without_a_session_it_is_401(client: TestClient) -> None:
    response = client.post(DELETE, json={"password": "password123"}, headers=ORIGIN)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_a_foreign_origin_is_403(signed_in: tuple[TestClient, InMemoryEmailSender]) -> None:
    client, sender = signed_in

    response = client.post(
        DELETE, json={"password": "password123"}, headers={"Origin": "https://foreign.example"}
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "authorization_error"
    assert sender.messages == []


def test_a_wrong_password_is_403_invalid_password_and_keeps_the_cookie(
    signed_in: tuple[TestClient, InMemoryEmailSender],
) -> None:
    client, sender = signed_in
    wrong_password(client)

    response = client.post(DELETE, json={"password": "wrong-password"}, headers=ORIGIN)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "invalid_password"
    assert "set-cookie" not in response.headers
    assert sender.messages == []


@pytest.mark.parametrize("body", [{}, {"password": ""}, {"password": "x" * 129}])
def test_a_missing_or_overlong_password_is_422(
    signed_in: tuple[TestClient, InMemoryEmailSender], body: dict[str, str]
) -> None:
    client, _ = signed_in

    response = client.post(DELETE, json=body, headers=ORIGIN)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_wrong_passwords_share_the_sign_in_account_limit_then_429(
    signed_in: tuple[TestClient, InMemoryEmailSender],
) -> None:
    client, _ = signed_in
    wrong_password(client)
    limit = get_settings().sign_in_account_limit

    for _ in range(limit):
        response = client.post(DELETE, json={"password": "wrong-password"}, headers=ORIGIN)
        assert response.status_code == 403

    response = client.post(DELETE, json={"password": "wrong-password"}, headers=ORIGIN)
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert 1 <= int(response.headers["Retry-After"]) <= get_settings().sign_in_account_window

    # The same bucket as sign-in: the account cannot be signed in to either.
    sign_in = client.post(
        "/api/v1/auth/sign-in",
        json={"email": "family@example.com", "password": "password123"},
        headers=ORIGIN,
    )
    assert sign_in.status_code == 429
