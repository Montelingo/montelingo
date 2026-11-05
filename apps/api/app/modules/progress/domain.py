from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

from app.modules.content.domain import Content
from app.modules.progress.schemas import MapState


@dataclass(frozen=True, slots=True)
class LocationProgressRecord:
    """Progress for one location, already scoped to a learning profile."""

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
    """Calculate every map state without database access or side effects."""
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
