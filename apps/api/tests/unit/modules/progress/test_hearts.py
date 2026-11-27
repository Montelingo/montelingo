"""Unit tests for the daily heart cap (ADR 0009)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.modules.progress.domain import (
    HEART_TIME_ZONE,
    HEARTS_PER_DAY,
    has_room_for_heart,
    heart_day_start,
)


def test_a_player_earns_at_most_five_hearts_a_day() -> None:
    assert HEARTS_PER_DAY == 5


@pytest.mark.parametrize(("today", "has_room"), [(0, True), (4, True), (5, False), (9, False)])
def test_there_is_room_until_the_cap(today: int, has_room: bool) -> None:
    assert has_room_for_heart(today) is has_room


def test_the_day_starts_at_midnight_in_podgorica() -> None:
    # 10:00 UTC in winter is 11:00 in Podgorica (UTC+1).
    start = heart_day_start(datetime(2026, 12, 3, 10, 0, tzinfo=UTC))

    assert start == datetime(2026, 12, 2, 23, 0, tzinfo=UTC)
    assert start.tzinfo is HEART_TIME_ZONE


def test_late_evening_utc_is_already_the_next_day_in_podgorica() -> None:
    # 23:30 UTC on 2 December is 00:30 on 3 December in Podgorica.
    start = heart_day_start(datetime(2026, 12, 2, 23, 30, tzinfo=UTC))

    assert start == datetime(2026, 12, 2, 23, 0, tzinfo=UTC)


def test_summer_time_moves_the_start_an_hour() -> None:
    # In summer Podgorica is UTC+2, so the day starts at 22:00 UTC.
    start = heart_day_start(datetime(2026, 7, 15, 12, 0, tzinfo=UTC))

    assert start == datetime(2026, 7, 14, 22, 0, tzinfo=UTC)


def test_the_day_the_clocks_change_starts_at_its_own_midnight() -> None:
    # Summer time starts on 29 March 2026 at 02:00. Midnight is still UTC+1.
    start = heart_day_start(datetime(2026, 3, 29, 12, 0, tzinfo=UTC))

    assert start == datetime(2026, 3, 28, 23, 0, tzinfo=UTC)
