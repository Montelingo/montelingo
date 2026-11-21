from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.auth import get_current_user
from app.modules.progress.dependencies import get_learning_profile
from app.modules.progress.router import get_game_progress_service, get_progress_service
from app.modules.progress.schemas import (
    ChapterState,
    GameState,
    LocationState,
    ProgressState,
    RegionState,
)


class FakeDatabaseProgressService:
    def __init__(self) -> None:
        self.received_profile_id: UUID | None = None

    async def get_state(self, learning_profile_id: UUID) -> ProgressState:
        self.received_profile_id = learning_profile_id

        return ProgressState(
            regions=[
                RegionState(id="coast", state="available"),
                RegionState(id="north", state="locked"),
            ],
            locations=[
                LocationState(id="budva", state="available"),
                LocationState(id="kotor", state="locked"),
            ],
            chapters=[
                ChapterState(
                    id="budva-beach",
                    lesson="todo",
                    games=[
                        GameState(id="memory", state="locked"),
                        GameState(id="match", state="locked"),
                    ],
                )
            ],
        )


def test_get_progress_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/progress")

    assert response.status_code == 401


def test_get_progress_uses_current_learning_profile(
    app: FastAPI,
    client: TestClient,
) -> None:
    profile_id = uuid4()
    service = FakeDatabaseProgressService()

    app.dependency_overrides[get_current_user] = lambda: object()
    app.dependency_overrides[get_learning_profile] = lambda: SimpleNamespace(id=profile_id)
    app.dependency_overrides[get_progress_service] = lambda: service

    try:
        response = client.get("/api/v1/progress")

        assert response.status_code == 200
        assert service.received_profile_id == profile_id

        body = response.json()

        assert body["regions"] == [
            {"id": "coast", "state": "available"},
            {"id": "north", "state": "locked"},
        ]
        assert body["locations"] == [
            {"id": "budva", "state": "available"},
            {"id": "kotor", "state": "locked"},
        ]
        assert body["chapters"] == [
            {
                "id": "budva-beach",
                "lesson": "todo",
                "games": [
                    {"id": "memory", "state": "locked"},
                    {"id": "match", "state": "locked"},
                ],
            }
        ]
    finally:
        app.dependency_overrides.clear()


def test_get_progress_uses_different_profile_ids(
    app: FastAPI,
    client: TestClient,
) -> None:
    service = FakeDatabaseProgressService()

    first_profile_id = uuid4()
    second_profile_id = uuid4()

    app.dependency_overrides[get_current_user] = lambda: object()
    app.dependency_overrides[get_progress_service] = lambda: service

    try:
        for profile_id in (first_profile_id, second_profile_id):
            app.dependency_overrides[get_learning_profile] = lambda profile_id=profile_id: (
                SimpleNamespace(id=profile_id)
            )

            response = client.get("/api/v1/progress")

            assert response.status_code == 200
            assert service.received_profile_id == profile_id
    finally:
        app.dependency_overrides.clear()


ORIGIN = "http://localhost:3000"
# The chapter routes are frozen in ADR 0006 (#125, #126).
RECORD_ROUTES = [
    "/api/v1/chapters/budva-beach/lesson",
    "/api/v1/chapters/budva-beach/games/memory/result",
]


@pytest.mark.parametrize("path", RECORD_ROUTES)
@pytest.mark.parametrize("headers", [{"Origin": ORIGIN}, {}])
def test_record_routes_require_a_session(
    client: TestClient, path: str, headers: dict[str, str]
) -> None:
    response = client.post(path, headers=headers)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


@pytest.mark.parametrize("path", RECORD_ROUTES)
def test_record_routes_require_a_trusted_origin(
    app: FastAPI, client: TestClient, path: str
) -> None:
    app.dependency_overrides[get_learning_profile] = lambda: SimpleNamespace(id=uuid4())
    try:
        response = client.post(path, headers={"Origin": "https://evil.example"})

        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


class FakeGameProgressService:
    def __init__(self) -> None:
        self.received: tuple[UUID, str, str] | None = None

    async def complete_game(
        self, learning_profile_id: UUID, chapter_slug: str, game_slug: str
    ) -> ChapterState:
        self.received = (learning_profile_id, chapter_slug, game_slug)
        return ChapterState(
            id=chapter_slug,
            lesson="done",
            games=[
                GameState(id="memory", state="completed"),
                GameState(id="match", state="available"),
            ],
        )


def test_game_route_records_for_the_current_learning_profile(
    app: FastAPI, client: TestClient
) -> None:
    profile_id = uuid4()
    service = FakeGameProgressService()
    app.dependency_overrides[get_learning_profile] = lambda: SimpleNamespace(id=profile_id)
    app.dependency_overrides[get_game_progress_service] = lambda: service
    try:
        response = client.post(
            "/api/v1/chapters/budva-beach/games/memory/result", headers={"Origin": ORIGIN}
        )

        assert response.status_code == 200
        assert service.received == (profile_id, "budva-beach", "memory")
        assert response.json() == {
            "id": "budva-beach",
            "lesson": "done",
            "games": [
                {"id": "memory", "state": "completed"},
                {"id": "match", "state": "available"},
            ],
        }
    finally:
        app.dependency_overrides.clear()


def test_game_route_rejects_a_malformed_game_slug(app: FastAPI, client: TestClient) -> None:
    app.dependency_overrides[get_learning_profile] = lambda: SimpleNamespace(id=uuid4())
    app.dependency_overrides[get_game_progress_service] = FakeGameProgressService
    try:
        response = client.post(
            "/api/v1/chapters/budva-beach/games/Not_A_Slug/result", headers={"Origin": ORIGIN}
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
    finally:
        app.dependency_overrides.clear()
