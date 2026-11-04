from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.modules.auth import get_current_user
from app.modules.auth.schemas import CurrentUser
from app.modules.progress import get_learning_profile
from app.modules.progress.models import LearningProfile

MAP_ROUTES = [
    "/api/v1/regions",
    "/api/v1/regions/coast",
    "/api/v1/locations/budva",
    "/api/v1/progress",
]


@pytest.fixture
def signed_in(client: TestClient) -> Iterator[None]:
    client.app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="7d3c6a8e-1f4b-4c2a-9e5d-2b8f0a6c4d1e",
        email="user@example.com",
        created_at=datetime(2026, 10, 18, tzinfo=UTC),
    )
    client.app.dependency_overrides[get_learning_profile] = lambda: LearningProfile(
        user_id=UUID("7d3c6a8e-1f4b-4c2a-9e5d-2b8f0a6c4d1e")
    )
    yield
    client.app.dependency_overrides.pop(get_current_user, None)
    client.app.dependency_overrides.pop(get_learning_profile, None)


@pytest.mark.parametrize("path", MAP_ROUTES)
def test_map_routes_require_a_session(client: TestClient, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


@pytest.mark.parametrize("path", MAP_ROUTES[:3])
def test_content_routes_are_stubs_until_63(client: TestClient, signed_in: None, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "not_implemented"


def test_progress_returns_the_starting_state(client: TestClient, signed_in: None) -> None:
    response = client.get("/api/v1/progress")

    assert response.status_code == 200
    body = response.json()
    assert {"id": "budva", "state": "available"} in body["locations"]
    assert {"id": "coast", "state": "available"} in body["regions"]
