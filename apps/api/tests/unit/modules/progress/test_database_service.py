from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.modules.content.domain import Content, Location, Region
from app.modules.progress.domain import ChapterProgressRecord, LocationProgressRecord
from app.modules.progress.service import DatabaseProgressService

NOW = datetime(2026, 10, 22, tzinfo=UTC)


class FakeProgressRepository:
    def __init__(
        self,
        content: Content,
        progress: list[LocationProgressRecord],
        chapters: list[ChapterProgressRecord] | None = None,
    ) -> None:
        self.content = content
        self.progress = progress
        self.chapters = chapters or []
        self.received_profile_id: UUID | None = None
        self.received_chapters_profile_id: UUID | None = None

    async def read_map(
        self,
        learning_profile_id: UUID,
    ) -> tuple[Content, list[LocationProgressRecord]]:
        self.received_profile_id = learning_profile_id
        return self.content, self.progress

    async def read_chapters(
        self,
        learning_profile_id: UUID,
    ) -> list[ChapterProgressRecord]:
        self.received_chapters_profile_id = learning_profile_id
        return self.chapters


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


async def test_new_account_lists_only_the_starting_place_chapters() -> None:
    repository = FakeProgressRepository(
        example_content(),
        [],
        [
            ChapterProgressRecord(chapter_slug="budva-beach", location_slug="budva"),
            ChapterProgressRecord(chapter_slug="budva-old-town", location_slug="budva"),
            ChapterProgressRecord(chapter_slug="kotor-walls", location_slug="kotor"),
        ],
    )
    profile_id = uuid4()

    result = await DatabaseProgressService(repository).get_state(profile_id)

    assert repository.received_chapters_profile_id == profile_id
    assert [chapter.model_dump() for chapter in result.chapters] == [
        {
            "id": slug,
            "lesson": "todo",
            "games": [
                {"id": "memory", "state": "locked"},
                {"id": "match", "state": "locked"},
            ],
        }
        for slug in ("budva-beach", "budva-old-town")
    ]


async def test_chapters_follow_the_places_map_states() -> None:
    chapters = [
        ChapterProgressRecord(chapter_slug="budva-beach", location_slug="budva"),
        ChapterProgressRecord(
            chapter_slug="budva-old-town",
            location_slug="budva",
            lesson_completed_at=NOW,
            completed_games=("match",),
        ),
        ChapterProgressRecord(chapter_slug="kotor-walls", location_slug="kotor"),
        ChapterProgressRecord(chapter_slug="kolasin-forest", location_slug="kolasin"),
    ]
    progress = [LocationProgressRecord(location_slug="kotor", started_at=NOW)]
    repository = FakeProgressRepository(example_content(), progress, chapters)

    result = await DatabaseProgressService(repository).get_state(uuid4())

    assert [chapter.id for chapter in result.chapters] == [
        "budva-beach",
        "budva-old-town",
        "kotor-walls",
    ]
    old_town = result.chapters[1]
    assert old_town.lesson == "done"
    assert [(game.id, game.state) for game in old_town.games] == [
        ("memory", "available"),
        ("match", "completed"),
    ]


async def test_new_account_has_nothing_counted() -> None:
    chapters = [
        ChapterProgressRecord(chapter_slug="budva-beach", location_slug="budva", word_count=10)
    ]
    repository = FakeProgressRepository(example_content(), [], chapters)

    result = await DatabaseProgressService(repository).get_state(uuid4())

    assert result.counts.model_dump() == {"words_learned": 0, "stickers": 0}


async def test_counts_learned_words_and_completed_places() -> None:
    chapters = [
        ChapterProgressRecord(
            chapter_slug="budva-beach",
            location_slug="budva",
            lesson_completed_at=NOW,
            completed_games=("memory", "match"),
            word_count=10,
        ),
        ChapterProgressRecord(
            chapter_slug="kotor-walls",
            location_slug="kotor",
            lesson_completed_at=NOW,
            word_count=7,
        ),
        ChapterProgressRecord(chapter_slug="kotor-bay", location_slug="kotor", word_count=9),
    ]
    progress = [
        LocationProgressRecord(location_slug="budva", started_at=NOW, completed_at=NOW),
        LocationProgressRecord(location_slug="kotor", started_at=NOW),
    ]
    repository = FakeProgressRepository(example_content(), progress, chapters)

    result = await DatabaseProgressService(repository).get_state(uuid4())

    assert result.counts.model_dump() == {"words_learned": 17, "stickers": 1}
