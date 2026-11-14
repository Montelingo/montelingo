from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.auth import get_current_user
from app.modules.progress.dependencies import get_learning_profile
from app.modules.progress.router import get_progress_service
from app.modules.progress.schemas import LocationState, ProgressState, RegionState


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
