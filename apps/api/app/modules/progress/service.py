"""Services for reading map availability and learning progress."""

from __future__ import annotations

from uuid import UUID

from app.modules.content import Content

from .domain import calculate_map_states
from .repository import ProgressRepository
from .schemas import LocationState, ProgressState, RegionState


class ProgressService:
    """Legacy map state service, retained until database integration is active."""

    def __init__(self, content: Content) -> None:
        self.content = content

    def get_state(self) -> ProgressState:
        start = next(loc for loc in self.content.locations if loc.is_starting)

        return ProgressState(
            regions=[
                RegionState(
                    id=region.slug,
                    state="available" if region.slug == start.region_slug else "locked",
                )
                for region in self.content.regions
            ],
            locations=[
                LocationState(
                    id=location.slug,
                    state="available" if location.slug == start.slug else "locked",
                )
                for location in self.content.locations
            ],
        )


class DatabaseProgressService:
    """Calculate map states from content and one learning profile's progress."""

    def __init__(self, repository: ProgressRepository) -> None:
        self.repository = repository

    async def get_state(self, learning_profile_id: UUID) -> ProgressState:
        content, progress = await self.repository.read_map(learning_profile_id)
        states = calculate_map_states(content, progress)

        return ProgressState(
            regions=[RegionState(id=slug, state=state) for slug, state in states.regions.items()],
            locations=[
                LocationState(id=slug, state=state) for slug, state in states.locations.items()
            ],
        )
