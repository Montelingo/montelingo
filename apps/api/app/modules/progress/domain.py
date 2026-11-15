"""Pure domain rules for map availability and the child profile."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

from app.modules.content import Content
from app.modules.progress.schemas import (
    AGE_BANDS,
    AVATARS,
    NAME_MAX_LENGTH,
    AgeBand,
    Avatar,
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
