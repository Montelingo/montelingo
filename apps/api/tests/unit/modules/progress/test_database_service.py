from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.modules.content.domain import Content, Location, Region
from app.modules.progress.domain import LocationProgressRecord
from app.modules.progress.service import DatabaseProgressService

NOW = datetime(2026, 10, 22, tzinfo=UTC)


class FakeProgressRepository:
    def __init__(
        self,
        content: Content,
        progress: list[LocationProgressRecord],
    ) -> None:
        self.content = content
        self.progress = progress
        self.received_profile_id: UUID | None = None

    async def read_map(
        self,
        learning_profile_id: UUID,
    ) -> tuple[Content, list[LocationProgressRecord]]:
        self.received_profile_id = learning_profile_id
        return self.content, self.progress


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
    ("progress", "expected_budva", "expected_coast"),
    [
        pytest.param([], "available", "available", id="no-progress"),
        pytest.param(
            [LocationProgressRecord(location_slug="budva", started_at=NOW)],
            "in-progress",
            "available",
            id="started",
        ),
        pytest.param(
            [
                LocationProgressRecord(
                    location_slug="budva",
                    started_at=NOW,
                    completed_at=NOW,
                )
            ],
            "completed",
            "available",
            id="completed",
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
            "completed",
            "completed",
            id="region-completed",
        ),
    ],
)
async def test_database_service_returns_profile_map_states(
    progress: list[LocationProgressRecord],
    expected_budva: str,
    expected_coast: str,
) -> None:
    repository = FakeProgressRepository(example_content(), progress)
    service = DatabaseProgressService(repository)
    profile_id = uuid4()

    result = await service.get_state(profile_id)

    assert repository.received_profile_id == profile_id
    assert result.locations[0].id == "budva"
    assert result.locations[0].state == expected_budva
    assert result.regions[0].id == "coast"
    assert result.regions[0].state == expected_coast

    assert [location.id for location in result.locations] == [
        "budva",
        "kotor",
        "kolasin",
    ]
    assert [region.id for region in result.regions] == ["coast", "north"]
