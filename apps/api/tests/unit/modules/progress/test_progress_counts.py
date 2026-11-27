"""Unit tests for calculate_progress_counts (#175)."""

from __future__ import annotations

from datetime import UTC, datetime

from app.modules.progress.domain import (
    ChapterProgressRecord,
    ProgressCounts,
    calculate_progress_counts,
)
from app.modules.progress.schemas import MapState

NOW = datetime(2026, 11, 22, tzinfo=UTC)

NEW_ACCOUNT_STATES: dict[str, MapState] = {
    "budva": "available",
    "kotor": "locked",
    "kolasin": "locked",
}


def chapters(
    *,
    beach_lesson: datetime | None = None,
    old_town_lesson: datetime | None = None,
) -> list[ChapterProgressRecord]:
    return [
        ChapterProgressRecord(
            chapter_slug="budva-beach",
            location_slug="budva",
            lesson_completed_at=beach_lesson,
            word_count=10,
        ),
        ChapterProgressRecord(
            chapter_slug="budva-old-town",
            location_slug="budva",
            lesson_completed_at=old_town_lesson,
            word_count=8,
        ),
        ChapterProgressRecord(chapter_slug="kotor-walls", location_slug="kotor", word_count=12),
    ]


def test_without_progress_nothing_is_counted() -> None:
    assert calculate_progress_counts(chapters(), NEW_ACCOUNT_STATES) == ProgressCounts(
        words_learned=0, stickers=0, stars=0
    )


def test_a_seen_lesson_counts_every_word_of_its_chapter() -> None:
    counts = calculate_progress_counts(
        chapters(beach_lesson=NOW),
        {**NEW_ACCOUNT_STATES, "budva": "in-progress"},
    )

    assert counts == ProgressCounts(words_learned=10, stickers=0, stars=0)


def test_a_played_game_without_the_lesson_learns_no_words() -> None:
    # The API never records one (409 game_locked), but only the lesson counts.
    record = ChapterProgressRecord(
        chapter_slug="budva-beach",
        location_slug="budva",
        completed_games=("memory", "match"),
        word_count=10,
    )

    assert calculate_progress_counts([record], NEW_ACCOUNT_STATES).words_learned == 0


def test_a_completed_place_gives_one_sticker() -> None:
    counts = calculate_progress_counts(
        chapters(beach_lesson=NOW, old_town_lesson=NOW),
        {"budva": "completed", "kotor": "available", "kolasin": "locked"},
    )

    assert counts == ProgressCounts(words_learned=18, stickers=1, stars=3)


def test_every_completed_place_gives_a_sticker() -> None:
    counts = calculate_progress_counts(
        [],
        {"budva": "completed", "kotor": "completed", "kolasin": "in-progress"},
    )

    assert counts == ProgressCounts(words_learned=0, stickers=2, stars=6)
