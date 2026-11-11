from __future__ import annotations

from app.modules.content import Content

from .schemas import LocationState, ProgressState, RegionState


class ProgressService:
    """Map state for the current learning profile.

    Until #66, every profile gets the phase 1 starting state, read from the
    content data file: the starting location and its region are `available`,
    everything else is `locked`. #66 replaces this with the unlock rule over
    the profile's `location_progress` rows.
    """

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
