from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.modules.content.domain import Content, Location, Region
from app.modules.progress.domain import LocationProgressRecord, calculate_map_states

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
            id="one-started",
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
                "kotor": "locked",
                "kolasin": "locked",
            },
            {
                "coast": "available",
                "north": "locked",
            },
            id="one-completed",
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
                "kolasin": "locked",
            },
            {
                "coast": "completed",
                "north": "locked",
            },
            id="whole-region-completed",
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
