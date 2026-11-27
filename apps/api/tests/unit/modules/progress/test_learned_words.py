"""Unit tests for calculate_learned_chapters (#232)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.modules.content import Content, Location, Region
from app.modules.progress.domain import (
    ChapterProgressRecord,
    LearnedChapters,
    LearnedPlace,
    NextPlace,
    calculate_learned_chapters,
    calculate_progress_counts,
)
from app.modules.progress.schemas import MapState

NOW = datetime(2026, 11, 25, tzinfo=UTC)

CONTENT = Content(
    starting_location="budva",
    regions=(Region(slug="coast", name="Primorje"), Region(slug="north", name="Sjever")),
    locations=(
        Location(slug="budva", name="Budva", region_slug="coast", is_starting=True),
        Location(slug="kotor", name="Kotor", region_slug="coast", is_starting=False),
        Location(slug="kolasin", name="Kolašin", region_slug="north", is_starting=False),
    ),
    chapters=(),
)

NEW_ACCOUNT: dict[str, MapState] = {
    "budva": "available",
    "kotor": "locked",
    "kolasin": "locked",
}
BUDVA_STARTED: dict[str, MapState] = {**NEW_ACCOUNT, "budva": "in-progress"}
BUDVA_COMPLETED: dict[str, MapState] = {**NEW_ACCOUNT, "budva": "completed", "kotor": "available"}
ALL_OPEN: dict[str, MapState] = {"budva": "completed", "kotor": "completed", "kolasin": "available"}


def chapters(*seen: str) -> list[ChapterProgressRecord]:
    """Every chapter in map order, with a seen lesson for each slug in `seen`."""

    def chapter(slug: str, place: str, words: int) -> ChapterProgressRecord:
        return ChapterProgressRecord(
            chapter_slug=slug,
            location_slug=place,
            lesson_completed_at=NOW if slug in seen else None,
            word_count=words,
        )

    return [
        chapter("budva-beach", "budva", 10),
        chapter("budva-old-town", "budva", 8),
        chapter("kotor-walls", "kotor", 12),
        chapter("kolasin-forest", "kolasin", 9),
    ]


def test_without_progress_nothing_is_learned_and_budva_is_next() -> None:
    assert calculate_learned_chapters(CONTENT, chapters(), NEW_ACCOUNT) == LearnedChapters(
        places=(),
        next_place=NextPlace(location_slug="budva", word_count=18),
    )


def test_one_seen_lesson_lists_its_place_and_the_rest_of_it_is_next() -> None:
    learned = calculate_learned_chapters(CONTENT, chapters("budva-beach"), BUDVA_STARTED)

    assert learned == LearnedChapters(
        places=(LearnedPlace(location_slug="budva", chapter_slugs=("budva-beach",)),),
        next_place=NextPlace(location_slug="budva", word_count=8),
    )


def test_a_completed_place_points_to_the_place_it_opened() -> None:
    learned = calculate_learned_chapters(
        CONTENT, chapters("budva-beach", "budva-old-town"), BUDVA_COMPLETED
    )

    assert learned == LearnedChapters(
        places=(
            LearnedPlace(location_slug="budva", chapter_slugs=("budva-beach", "budva-old-town")),
        ),
        next_place=NextPlace(location_slug="kotor", word_count=12),
    )


def test_a_locked_place_is_never_next() -> None:
    # Every open lesson is seen, but Budva's games are not done, so Kotor is still locked.
    learned = calculate_learned_chapters(
        CONTENT, chapters("budva-beach", "budva-old-town"), BUDVA_STARTED
    )

    assert learned.next_place is None


def test_with_every_lesson_seen_there_is_no_next_place() -> None:
    every = ("budva-beach", "budva-old-town", "kotor-walls", "kolasin-forest")
    learned = calculate_learned_chapters(CONTENT, chapters(*every), ALL_OPEN)

    assert [place.location_slug for place in learned.places] == ["budva", "kotor", "kolasin"]
    assert learned.next_place is None


def test_a_played_game_without_the_lesson_learns_no_words() -> None:
    # The API never records one (409 game_locked), but only the lesson counts.
    record = ChapterProgressRecord(
        chapter_slug="budva-beach",
        location_slug="budva",
        completed_games=("memory", "match"),
        word_count=10,
    )

    assert calculate_learned_chapters(CONTENT, [record], BUDVA_STARTED).places == ()


def test_places_follow_content_order_not_the_order_lessons_were_seen() -> None:
    learned = calculate_learned_chapters(
        CONTENT, list(reversed(chapters("budva-beach", "kotor-walls"))), ALL_OPEN
    )

    assert [place.location_slug for place in learned.places] == ["budva", "kotor"]


@pytest.mark.parametrize(
    ("seen", "states"),
    [
        ((), NEW_ACCOUNT),
        (("budva-beach",), BUDVA_STARTED),
        (("budva-beach", "budva-old-town"), BUDVA_COMPLETED),
        (("budva-beach", "budva-old-town", "kotor-walls", "kolasin-forest"), ALL_OPEN),
    ],
)
def test_the_learned_words_add_up_to_the_words_learned_count(
    seen: tuple[str, ...], states: dict[str, MapState]
) -> None:
    records = chapters(*seen)
    word_counts = {record.chapter_slug: record.word_count for record in records}

    learned = calculate_learned_chapters(CONTENT, records, states)
    listed = sum(word_counts[slug] for place in learned.places for slug in place.chapter_slugs)

    assert listed == calculate_progress_counts(records, states).words_learned


def test_a_place_whose_unseen_lessons_have_no_words_is_not_next() -> None:
    # A chapter whose words are still being recorded must not say "collect 0 more words".
    records = [
        ChapterProgressRecord(
            chapter_slug="budva-beach",
            location_slug="budva",
            lesson_completed_at=NOW,
            word_count=10,
        ),
        ChapterProgressRecord(chapter_slug="budva-empty", location_slug="budva", word_count=0),
        ChapterProgressRecord(chapter_slug="kotor-walls", location_slug="kotor", word_count=12),
    ]

    learned = calculate_learned_chapters(CONTENT, records, BUDVA_COMPLETED)

    assert learned.next_place == NextPlace(location_slug="kotor", word_count=12)
