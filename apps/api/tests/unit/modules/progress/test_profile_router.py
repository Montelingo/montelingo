"""Router tests for GET and PUT /profile, with the service and profile faked."""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.auth import get_current_user
from app.modules.progress.dependencies import get_learning_profile
from app.modules.progress.router import get_child_profile_service
from app.modules.progress.schemas import Profile

ORIGIN = "http://localhost:3000"
VALID = {"name": "Mia", "age_band": "5-6", "avatar": "fox"}


class FakeChildProfileService:
    def __init__(self) -> None:
        self.read_profile_id: UUID | None = None
        self.saved: tuple[UUID, dict[str, Any]] | None = None

    async def get(self, learning_profile_id: UUID) -> Profile:
        self.read_profile_id = learning_profile_id
        return Profile(name=None, age_band=None, avatar=None, is_complete=False)

    async def set_up(self, learning_profile_id: UUID, **fields: Any) -> Profile:
        self.saved = (learning_profile_id, fields)
        return Profile(**fields, is_complete=True)


@pytest.fixture
def profile_id() -> UUID:
    return uuid4()


@pytest.fixture
def service(app: FastAPI, profile_id: UUID) -> Iterator[FakeChildProfileService]:
    fake = FakeChildProfileService()
    app.dependency_overrides[get_current_user] = lambda: object()
    app.dependency_overrides[get_learning_profile] = lambda: SimpleNamespace(id=profile_id)
    app.dependency_overrides[get_child_profile_service] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def put_profile(client: TestClient, body: dict[str, Any]) -> httpx.Response:
    return client.put("/api/v1/profile", json=body, headers={"Origin": ORIGIN})


def test_get_profile_requires_a_session(client: TestClient) -> None:
    response = client.get("/api/v1/profile")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


@pytest.mark.parametrize("headers", [{"Origin": ORIGIN}, {}])
def test_put_profile_requires_a_session(client: TestClient, headers: dict[str, str]) -> None:
    response = client.put("/api/v1/profile", json=VALID, headers=headers)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_get_profile_reads_the_current_learning_profile(
    client: TestClient, service: FakeChildProfileService, profile_id: UUID
) -> None:
    response = client.get("/api/v1/profile")

    assert response.status_code == 200
    assert response.json() == {
        "name": None,
        "age_band": None,
        "avatar": None,
        "is_complete": False,
    }
    assert service.read_profile_id == profile_id


def test_put_profile_sets_the_current_learning_profile(
    client: TestClient, service: FakeChildProfileService, profile_id: UUID
) -> None:
    response = put_profile(client, {**VALID, "name": "  Mia  "})

    assert response.status_code == 200, response.text
    assert response.json() == {**VALID, "is_complete": True}
    assert service.saved == (profile_id, VALID)


def test_put_profile_accepts_a_thirty_character_name(
    client: TestClient, service: FakeChildProfileService
) -> None:
    response = put_profile(client, {**VALID, "name": "M" * 30})

    assert response.status_code == 200, response.text


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", ""),
        ("name", "   "),
        ("name", "\t\n"),
        ("name", "M" * 31),
        ("name", None),
        ("age_band", "8"),
        ("age_band", "5–6"),
        ("age_band", None),
        ("avatar", "dragon"),
        ("avatar", "Fox"),
        ("avatar", None),
    ],
)
def test_put_profile_rejects_invalid_values(
    client: TestClient, service: FakeChildProfileService, field: str, value: Any
) -> None:
    response = put_profile(client, {**VALID, field: value})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert [detail["field"] for detail in error["details"]] == [field]
    assert service.saved is None


@pytest.mark.parametrize("missing", ["name", "age_band", "avatar"])
def test_put_profile_requires_every_field(
    client: TestClient, service: FakeChildProfileService, missing: str
) -> None:
    body = {key: value for key, value in VALID.items() if key != missing}

    response = put_profile(client, body)

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == missing
    assert service.saved is None


def test_put_profile_rejects_an_untrusted_origin(
    client: TestClient, service: FakeChildProfileService
) -> None:
    response = client.put("/api/v1/profile", json=VALID, headers={"Origin": "https://evil.test"})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "authorization_error"
    assert service.saved is None
