from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.modules.auth import get_current_user
from app.modules.auth.schemas import CurrentUser
from app.modules.content import domain
from app.modules.content.router import get_content_service

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
    yield
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.parametrize("path", MAP_ROUTES)
def test_map_routes_require_a_session(client: TestClient, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


class FakeContentService:
    async def list_regions(self) -> tuple[domain.RegionSummaryRead, ...]:
        return ()

    async def get_region(self, slug: str) -> domain.RegionDetailRead:
        return domain.RegionDetailRead(slug=slug, name="Coast", locations=())

    async def get_location(self, slug: str) -> domain.LocationDetailRead:
        return domain.LocationDetailRead(
            slug=slug, name="Budva", region_slug="coast", chapters=()
        )


@pytest.mark.parametrize("path", MAP_ROUTES[:3])
def test_content_routes_are_implemented(
    client: TestClient, signed_in: None, path: str
) -> None:
    client.app.dependency_overrides[get_content_service] = FakeContentService
    try:
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "private, max-age=300"
    finally:
        client.app.dependency_overrides.pop(get_content_service, None)


def test_progress_returns_the_starting_state(client: TestClient, signed_in: None) -> None:
    response = client.get("/api/v1/progress")
    assert response.status_code == 200
    body = response.json()
    assert {"id": "budva", "state": "available"} in body["locations"]
    assert {"id": "coast", "state": "available"} in body["regions"]
