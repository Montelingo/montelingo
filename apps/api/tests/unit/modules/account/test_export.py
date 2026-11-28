from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.modules.account.dependencies import get_account_export_service
from app.modules.account.export import AccountExportService, export_filename
from app.modules.account.schemas import ExportPlayer
from app.modules.auth.dependencies import get_current_session
from app.modules.auth.service import ResolvedSession
from app.modules.users.domain import UserAccount
from tests.unit.modules.auth.test_service import NOW, FakeClock

EXPORT = "/api/v1/account/export"


class FakeExportRepository:
    def __init__(self, players: list[ExportPlayer]) -> None:
        self._players = players
        self.asked_for: list[UUID] = []

    async def players(self, user_id: UUID) -> list[ExportPlayer]:
        self.asked_for.append(user_id)
        return self._players


def make_session() -> ResolvedSession:
    user = UserAccount(
        id=uuid4(),
        email="family@example.com",
        password_hash="$argon2id$secret-hash",
        password_changed_at=NOW,
        created_at=NOW,
        updated_at=NOW,
        consent_accepted_at=NOW,
        privacy_policy_version="2026-12-01",
    )
    return ResolvedSession(user=user, session_id=uuid4())


@pytest.mark.parametrize(
    ("exported_at", "filename"),
    [
        (datetime(2026, 12, 1, 9, 0, tzinfo=UTC), "montelingo-2026-12-01.json"),
        # 23:30 UTC is already the next day in Podgorica (UTC+1 in winter).
        (datetime(2026, 12, 31, 23, 30, tzinfo=UTC), "montelingo-2027-01-01.json"),
    ],
)
def test_the_filename_is_the_day_in_montenegro(exported_at: datetime, filename: str) -> None:
    assert export_filename(exported_at) == filename


async def test_the_export_holds_the_account_and_only_the_signed_in_users_players() -> None:
    session = make_session()
    repository = FakeExportRepository([])
    service = AccountExportService(repository, FakeClock())

    export = await service.export(session)

    assert repository.asked_for == [session.user.id]
    assert export.format_version == 1
    assert export.exported_at == NOW
    assert export.account.model_dump() == {
        "email": "family@example.com",
        "created_at": NOW,
        "consent_accepted_at": NOW,
        "privacy_policy_version": "2026-12-01",
    }
    assert "secret-hash" not in export.model_dump_json()


@pytest.fixture
def signed_in(client: TestClient) -> Iterator[TestClient]:
    session = make_session()
    service = AccountExportService(FakeExportRepository([]), FakeClock())
    client.app.dependency_overrides[get_current_session] = lambda: session
    client.app.dependency_overrides[get_account_export_service] = lambda: service
    yield client
    client.app.dependency_overrides.clear()


def test_the_export_is_a_json_attachment_that_is_never_cached(signed_in: TestClient) -> None:
    response = signed_in.get(EXPORT)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    # NOW is 2026-10-11 00:00 UTC, which is still 2026-10-11 in Podgorica.
    assert response.headers["content-disposition"] == (
        'attachment; filename="montelingo-2026-10-11.json"'
    )
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["players"] == []


def test_without_a_session_it_is_401(client: TestClient) -> None:
    response = client.get(EXPORT)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"
