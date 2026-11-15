"""Unit tests for calculate_chapter_state (ADR 0006)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.modules.progress.domain import ChapterState, GameState, calculate_chapter_state
from app.modules.progress.schemas import GAME_IDS, GameId

NOW = datetime(2026, 11, 15, tzinfo=UTC)


def game_states(state: ChapterState) -> dict[str, str]:
    return {game.id: game.state for game in state.games}


def test_without_the_lesson_every_game_is_locked() -> None:
    state = calculate_chapter_state("budva-beach", None, [])

    assert state == ChapterState(
        id="budva-beach",
        lesson="todo",
        games=(GameState(id="memory", state="locked"), GameState(id="match", state="locked")),
    )


def test_after_the_lesson_every_game_without_a_result_is_available() -> None:
    state = calculate_chapter_state("budva-beach", NOW, [])

    assert state.lesson == "done"
    assert game_states(state) == {"memory": "available", "match": "available"}


@pytest.mark.parametrize(
    ("completed_games", "expected"),
    [
        pytest.param(["memory"], {"memory": "completed", "match": "available"}, id="memory"),
        pytest.param(["match"], {"memory": "available", "match": "completed"}, id="match"),
        pytest.param(["memory", "match"], {"memory": "completed", "match": "completed"}, id="both"),
    ],
)
def test_a_game_with_a_result_is_completed(
    completed_games: list[GameId], expected: dict[str, str]
) -> None:
    state = calculate_chapter_state("budva-beach", NOW, completed_games)

    assert state.lesson == "done"
    assert game_states(state) == expected


def test_a_recorded_result_counts_even_without_the_lesson() -> None:
    # The API never records one (409 game_locked), but a stored result is never hidden.
    state = calculate_chapter_state("budva-beach", None, ["match"])

    assert state.lesson == "todo"
    assert game_states(state) == {"memory": "locked", "match": "completed"}


def test_a_repeated_result_counts_once() -> None:
    state = calculate_chapter_state("budva-beach", NOW, ["memory", "memory"])

    assert game_states(state) == {"memory": "completed", "match": "available"}


@pytest.mark.parametrize(
    ("lesson_completed_at", "completed_games"),
    [
        (None, []),
        (NOW, []),
        (NOW, ["match"]),
        (NOW, ["match", "memory"]),
        (NOW, iter(["match", "memory"])),
    ],
)
def test_games_are_always_listed_memory_then_match(
    lesson_completed_at: datetime | None, completed_games: list[GameId]
) -> None:
    state = calculate_chapter_state("budva-beach", lesson_completed_at, completed_games)

    assert [game.id for game in state.games] == ["memory", "match"]
    assert GAME_IDS == ("memory", "match")


def test_the_chapter_keeps_its_slug() -> None:
    assert calculate_chapter_state("kotor-old-town", None, []).id == "kotor-old-town"
