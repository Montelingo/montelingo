from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.modules.content.domain import Content, Location, Region
from app.modules.progress.domain import (
    ChapterProgressRecord,
    LocationProgressRecord,
    calculate_map_states,
    is_location_completed,
)
from app.modules.progress.schemas import GameId

NOW = datetime(2026, 10, 22, tzinfo=UTC)


def example_content() -> Content:
    return Content(
        starting_location="budva",
        regions=(
            Region(slug="coast", name="Coast"),
            Region(slug="north", name="North"),
        ),
        locations=(
            Location(
                slug="budva",
                name="Budva",
                region_slug="coast",
                is_starting=True,
            ),
            Location(
                slug="kotor",
                name="Kotor",
                region_slug="coast",
                is_starting=False,
            ),
            Location(
                slug="kolasin",
                name="Kolasin",
                region_slug="north",
                is_starting=False,
            ),
        ),
        chapters=(),
    )


@pytest.mark.parametrize(
    ("progress", "expected_locations", "expected_regions"),
    [
        pytest.param(
            [],
            {
                "budva": "available",
                "kotor": "locked",
                "kolasin": "locked",
            },
            {
                "coast": "available",
                "north": "locked",
            },
            id="no-progress",
        ),
        pytest.param(
            [
                LocationProgressRecord(
                    location_slug="budva",
                    started_at=NOW,
                ),
            ],
            {
                "budva": "in-progress",
                "kotor": "locked",
                "kolasin": "locked",
            },
            {
                "coast": "available",
                "north": "locked",
            },
            id="part-of-a-place-opens-nothing",
        ),
        pytest.param(
            [
                LocationProgressRecord(
                    location_slug="budva",
                    started_at=NOW,
                    completed_at=NOW,
                ),
            ],
            {
                "budva": "completed",
                "kotor": "available",
                "kolasin": "locked",
            },
            {
                "coast": "available",
                "north": "locked",
            },
            id="whole-place-opens-the-next",
        ),
        pytest.param(
            [
                LocationProgressRecord(
                    location_slug="budva",
                    started_at=NOW,
                    completed_at=NOW,
                ),
                LocationProgressRecord(
                    location_slug="kotor",
                    started_at=NOW,
                    completed_at=NOW,
                ),
            ],
            {
                "budva": "completed",
                "kotor": "completed",
                "kolasin": "available",
            },
            {
                "coast": "completed",
                "north": "available",
            },
            id="region-last-place-opens-the-next-region",
        ),
        pytest.param(
            [
                LocationProgressRecord(
                    location_slug="kotor",
                    started_at=NOW,
                ),
            ],
            {
                "budva": "available",
                "kotor": "in-progress",
                "kolasin": "locked",
            },
            {
                "coast": "available",
                "north": "locked",
            },
            id="non-starting-location-in-progress",
        ),
    ],
)
def test_map_unlock_rules(
    progress: list[LocationProgressRecord],
    expected_locations: dict[str, str],
    expected_regions: dict[str, str],
) -> None:
    result = calculate_map_states(example_content(), progress)

    assert result.locations == expected_locations
    assert result.regions == expected_regions


def test_every_location_and_region_preserves_content_order() -> None:
    result = calculate_map_states(example_content(), [])

    assert list(result.locations) == ["budva", "kotor", "kolasin"]
    assert list(result.regions) == ["coast", "north"]


def test_completed_location_remains_openable() -> None:
    result = calculate_map_states(
        example_content(),
        [
            LocationProgressRecord(
                location_slug="budva",
                completed_at=NOW,
            )
        ],
    )

    assert result.locations["budva"] == "completed"


def test_empty_region_is_locked() -> None:
    content = Content(
        starting_location="budva",
        regions=(
            Region(slug="coast", name="Coast"),
            Region(slug="empty", name="Empty"),
        ),
        locations=(
            Location(
                slug="budva",
                name="Budva",
                region_slug="coast",
                is_starting=True,
            ),
        ),
        chapters=(),
    )

    result = calculate_map_states(content, [])

    assert result.regions["empty"] == "locked"


def test_a_completed_place_opens_only_the_next_one() -> None:
    result = calculate_map_states(
        example_content(),
        [LocationProgressRecord(location_slug="budva", started_at=NOW, completed_at=NOW)],
    )

    assert result.locations["kotor"] == "available"
    assert result.locations["kolasin"] == "locked"


def test_the_next_place_keeps_its_own_progress() -> None:
    result = calculate_map_states(
        example_content(),
        [
            LocationProgressRecord(location_slug="budva", started_at=NOW, completed_at=NOW),
            LocationProgressRecord(location_slug="kotor", started_at=NOW),
        ],
    )

    assert result.locations["kotor"] == "in-progress"
    assert result.locations["kolasin"] == "locked"


def chapter(
    slug: str,
    *,
    location: str = "budva",
    lesson: bool = True,
    games: tuple[GameId, ...] = (),
) -> ChapterProgressRecord:
    return ChapterProgressRecord(
        chapter_slug=slug,
        location_slug=location,
        lesson_completed_at=NOW if lesson else None,
        completed_games=games,
    )


@pytest.mark.parametrize(
    ("chapters", "expected"),
    [
        pytest.param(
            [chapter("beach", lesson=False), chapter("old-town", lesson=False)],
            False,
            id="no-progress",
        ),
        pytest.param(
            [chapter("beach", games=("memory",)), chapter("old-town")],
            False,
            id="lesson-and-one-game",
        ),
        pytest.param(
            [chapter("beach", games=("memory", "match")), chapter("old-town")],
            False,
            id="one-chapter-of-two",
        ),
        pytest.param(
            [
                chapter("beach", games=("memory", "match")),
                chapter("old-town", games=("match", "memory")),
            ],
            True,
            id="every-chapter",
        ),
        pytest.param(
            [
                chapter("beach", games=("memory", "match")),
                chapter("old-town", games=("memory", "match")),
                chapter("walls", location="kotor"),
            ],
            True,
            id="other-places-do-not-count",
        ),
        pytest.param(
            [chapter("walls", location="kotor", games=("memory", "match"))],
            False,
            id="place-without-chapters",
        ),
    ],
)
def test_a_place_is_completed_when_every_lesson_and_game_is_done(
    chapters: list[ChapterProgressRecord],
    expected: bool,
) -> None:
    assert is_location_completed("budva", chapters) is expected


def test_games_without_the_lesson_do_not_complete_a_place() -> None:
    chapters = [chapter("beach", lesson=False, games=("memory", "match"))]

    assert is_location_completed("budva", chapters) is False
