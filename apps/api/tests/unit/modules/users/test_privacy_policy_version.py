from __future__ import annotations

from datetime import date

from app.modules.users.privacy import PRIVACY_POLICY_VERSION


def test_the_version_is_the_date_the_policy_takes_effect() -> None:
    # ADR 0008: a version is a date, YYYY-MM-DD, so versions sort.
    assert date.fromisoformat(PRIVACY_POLICY_VERSION).isoformat() == PRIVACY_POLICY_VERSION
