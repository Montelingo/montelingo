from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.core.errors import ApiError
from app.modules.auth.schemas import CurrentUser
from app.modules.progress import dependencies


class MissingProfileRepository:
    async def get_by_user_id(self, user_id: UUID) -> None:
        return None


@pytest.mark.asyncio
async def test_get_learning_profile_rejects_missing_profile(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        dependencies,
        "SqlAlchemyLearningProfileRepository",
        lambda session: MissingProfileRepository(),
    )
    current_user = CurrentUser(
        id="7d3c6a8e-1f4b-4c2a-9e5d-2b8f0a6c4d1e",
        email="user@example.com",
        created_at=datetime(2026, 10, 18, tzinfo=UTC),
    )

    with pytest.raises(ApiError) as error:
        await dependencies.get_learning_profile(current_user, object())  # type: ignore[arg-type]

    assert error.value.status_code == 500
    assert error.value.stable_code == "internal_server_error"
