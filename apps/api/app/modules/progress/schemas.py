from __future__ import annotations

from typing import Literal

from app.modules.content.schemas import Slug
from app.schemas.common import ApiSchema

# The same literals as the SVG map contract. The server decides them; the
# frontend never computes a state (ADR 0005).
MapState = Literal["locked", "available", "in-progress", "completed"]


class RegionState(ApiSchema):
    id: Slug
    state: MapState


class LocationState(ApiSchema):
    id: Slug
    state: MapState


class ProgressState(ApiSchema):
    regions: list[RegionState]
    locations: list[LocationState]
