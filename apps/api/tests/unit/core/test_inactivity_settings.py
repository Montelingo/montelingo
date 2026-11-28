from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_the_periods_default_to_the_adr() -> None:
    settings = Settings()

    # ADR 0008: deleted after 24 months, warned 30 days before.
    assert (settings.inactive_warning_days, settings.inactive_delete_days) == (700, 730)


def test_the_periods_come_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MONTELINGO_INACTIVE_WARNING_DAYS", "10")
    monkeypatch.setenv("MONTELINGO_INACTIVE_DELETE_DAYS", "20")

    settings = Settings()

    assert (settings.inactive_warning_days, settings.inactive_delete_days) == (10, 20)


@pytest.mark.parametrize(("warning", "delete"), [(730, 730), (731, 730), (0, 730)])
def test_the_warning_must_come_before_the_deletion(warning: int, delete: int) -> None:
    with pytest.raises(ValidationError):
        Settings(inactive_warning_days=warning, inactive_delete_days=delete)
