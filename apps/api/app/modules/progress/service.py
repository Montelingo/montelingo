"""Services for reading map availability and learning progress."""

from __future__ import annotations

from uuid import UUID

from .domain import calculate_map_states
from .repository import ProgressRepository
from .schemas import LocationState, ProgressState, RegionState


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
