"""Pure domain rules for map availability, chapter state and the child profile."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime

from app.modules.content import Content
from app.modules.progress.schemas import (
    AGE_BANDS,
    AVATARS,
    GAME_IDS,
    NAME_MAX_LENGTH,
    AgeBand,
    Avatar,
    GameId,
    GameStatus,
    LessonState,
    MapState,
)


@dataclass(frozen=True, slots=True)
class LocationProgressRecord:
    """Progress for one location, scoped to a learning profile."""

    location_slug: str
    started_at: datetime | None = None
    completed_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class MapStates:
    """States keyed by slug, preserving content ordering."""

    regions: dict[str, MapState]
    locations: dict[str, MapState]


def calculate_map_states(
    content: Content,
    progress: Iterable[LocationProgressRecord],
) -> MapStates:
    """Calculate map states without database access or side effects."""

    progress_by_slug = {row.location_slug: row for row in progress}

    location_states: dict[str, MapState] = {}

    for location in content.locations:
        row = progress_by_slug.get(location.slug)

        if row is not None and row.completed_at is not None:
            state: MapState = "completed"
        elif row is not None and row.started_at is not None:
            state = "in-progress"
        elif location.is_starting:
            state = "available"
        else:
            state = "locked"

        location_states[location.slug] = state

    region_states: dict[str, MapState] = {}

    for region in content.regions:
        states = [
            location_states[location.slug]
            for location in content.locations
            if location.region_slug == region.slug
        ]

        if not states or all(state == "locked" for state in states):
            region_state: MapState = "locked"
        elif all(state == "completed" for state in states):
            region_state = "completed"
        else:
            region_state = "available"

        region_states[region.slug] = region_state

    return MapStates(
        regions=region_states,
        locations=location_states,
    )


@dataclass(frozen=True, slots=True)
class GameState:
    """One game of a chapter and whether the child may play it."""

    id: GameId
    state: GameStatus


@dataclass(frozen=True, slots=True)
class ChapterState:
    """A chapter's lesson and its games, with the games in `GAME_IDS` order."""

    id: str
    lesson: LessonState
    games: tuple[GameState, ...]


def calculate_chapter_state(
    chapter_slug: str,
    lesson_completed_at: datetime | None,
    completed_games: Iterable[GameId],
) -> ChapterState:
    """Calculate one chapter's state without database access or side effects.

    The lesson unlocks the games (ADR 0006): every game is `locked` until the
    lesson is `done`, then `available`, and `completed` once it has a result.
    A recorded result always counts as `completed`.
    """

    lesson: LessonState = "done" if lesson_completed_at is not None else "todo"
    completed = set(completed_games)

    games: list[GameState] = []
    for game_id in GAME_IDS:
        if game_id in completed:
            state: GameStatus = "completed"
        elif lesson == "done":
            state = "available"
        else:
            state = "locked"
        games.append(GameState(id=game_id, state=state))

    return ChapterState(id=chapter_slug, lesson=lesson, games=tuple(games))


@dataclass(frozen=True, slots=True)
class ChapterProgressRecord:
    """One content chapter with a profile's progress in it. No progress is the default."""

    chapter_slug: str
    location_slug: str
    lesson_completed_at: datetime | None = None
    completed_games: tuple[GameId, ...] = ()


def calculate_chapter_states(
    chapters: Iterable[ChapterProgressRecord],
    location_states: Mapping[str, MapState],
) -> tuple[ChapterState, ...]:
    """Calculate the state of every chapter whose place is not `locked`.

    A child can only open a place that is not `locked`, so only those
    chapters are listed (ADR 0006). The order of `chapters` is kept.
    """

    return tuple(
        calculate_chapter_state(
            chapter.chapter_slug,
            chapter.lesson_completed_at,
            chapter.completed_games,
        )
        for chapter in chapters
        if location_states.get(chapter.location_slug, "locked") != "locked"
    )


class InvalidChildProfile(ValueError):
    """A child profile value breaks one of the profile's rules."""


@dataclass(frozen=True, slots=True)
class ChildProfile:
    """The child's name, age band and animal buddy on a learning profile.

    A profile created at sign-up has none of them; they are set together when
    the grown-up sets the profile up.
    """

    name: str | None = None
    age_band: AgeBand | None = None
    avatar: Avatar | None = None

    @property
    def is_complete(self) -> bool:
        return self.name is not None and self.age_band is not None and self.avatar is not None

    @classmethod
    def set_up(cls, *, name: str, age_band: AgeBand, avatar: Avatar) -> ChildProfile:
        trimmed = name.strip()
        if not 1 <= len(trimmed) <= NAME_MAX_LENGTH:
            raise InvalidChildProfile(
                f"The name must be 1 to {NAME_MAX_LENGTH} characters after trimming."
            )
        if age_band not in AGE_BANDS:
            raise InvalidChildProfile(f"Unknown age band: {age_band!r}.")
        if avatar not in AVATARS:
            raise InvalidChildProfile(f"Unknown avatar: {avatar!r}.")
        return cls(name=trimmed, age_band=age_band, avatar=avatar)
