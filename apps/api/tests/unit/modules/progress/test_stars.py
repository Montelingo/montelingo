"""Unit tests for calculate_location_stars and calculate_stars (ADR 0009)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.modules.progress.domain import (
    STARS_PER_PLACE,
    ChapterProgressRecord,
    calculate_location_stars,
    calculate_stars,
)
from app.modules.progress.schemas import GameId, MapState

NOW = datetime(2026, 11, 27, tzinfo=UTC)


def chapter(
    slug: str,
    *,
    lesson: bool = False,
    games: tuple[GameId, ...] = (),
    location: str = "budva",
) -> ChapterProgressRecord:
    return ChapterProgressRecord(
        chapter_slug=slug,
        location_slug=location,
        lesson_completed_at=NOW if lesson else None,
        completed_games=games,
    )


def test_a_place_gives_three_stars() -> None:
    # One for the lessons and one for each game, which the web's
    # STARS_PER_PLACE and LocationState's maximum assume.
    assert STARS_PER_PLACE == 3


def test_nothing_done_gives_no_stars() -> None:
    assert calculate_location_stars("available", [chapter("beach"), chapter("old-town")]) == 0


def test_a_lesson_in_only_one_of_two_chapters_gives_no_star() -> None:
    chapters = [chapter("beach", lesson=True), chapter("old-town")]

    assert calculate_location_stars("in-progress", chapters) == 0


def test_every_lesson_seen_gives_the_first_star() -> None:
    chapters = [chapter("beach", lesson=True), chapter("old-town", lesson=True)]

    assert calculate_location_stars("in-progress", chapters) == 1


def test_a_game_in_only_one_chapter_gives_no_star_for_it() -> None:
    chapters = [
        chapter("beach", lesson=True, games=("memory",)),
        chapter("old-town", lesson=True),
    ]

    assert calculate_location_stars("in-progress", chapters) == 1


@pytest.mark.parametrize("game", ["memory", "match"])
def test_each_game_completed_everywhere_gives_a_star(game: GameId) -> None:
    chapters = [
        chapter("beach", lesson=True, games=(game,)),
        chapter("old-town", lesson=True, games=(game,)),
    ]

    assert calculate_location_stars("in-progress", chapters) == 2


def test_everything_done_gives_every_star() -> None:
    chapters = [
        chapter("beach", lesson=True, games=("memory", "match")),
        chapter("old-town", lesson=True, games=("memory", "match")),
    ]

    assert calculate_location_stars("in-progress", chapters) == STARS_PER_PLACE


def test_a_completed_place_keeps_every_star_after_content_gains_a_chapter() -> None:
    chapters = [
        chapter("beach", lesson=True, games=("memory", "match")),
        chapter("new-chapter"),
    ]

    assert calculate_location_stars("completed", chapters) == STARS_PER_PLACE


@pytest.mark.parametrize("state", ["available", "in-progress"])
def test_a_place_without_chapters_gives_no_stars(state: MapState) -> None:
    assert calculate_location_stars(state, []) == 0


def test_a_locked_place_gives_no_stars() -> None:
    # Content may change under a child, but a locked place shows nothing.
    chapters = [chapter("walls", lesson=True, games=("memory", "match"), location="kotor")]

    assert calculate_location_stars("locked", chapters) == 0


def test_stars_are_listed_for_every_place_in_map_order() -> None:
    chapters = [
        chapter("beach", lesson=True, games=("memory",)),
        chapter("old-town", lesson=True, games=("memory",)),
        chapter("walls", lesson=True, location="kotor"),
    ]
    states: dict[str, MapState] = {
        "budva": "completed",
        "kotor": "in-progress",
        "kolasin": "locked",
    }

    stars = calculate_stars(chapters, states)

    assert list(stars.items()) == [("budva", 3), ("kotor", 1), ("kolasin", 0)]
