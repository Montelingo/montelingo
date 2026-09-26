import pytest

from app.modules.health.service import HealthService


class _FakeProbe:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    async def ping(self) -> None:
        if self.error is not None:
            raise self.error


@pytest.mark.asyncio
async def test_ready_when_database_responds() -> None:
    assert await HealthService(database=_FakeProbe()).is_ready() is True


@pytest.mark.asyncio
async def test_not_ready_when_database_fails() -> None:
    probe = _FakeProbe(error=ConnectionRefusedError("connection refused"))
    assert await HealthService(database=probe).is_ready() is False
