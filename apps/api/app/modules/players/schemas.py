from __future__ import annotations

from app.modules.progress.schemas import AgeBand, Avatar
from app.schemas.common import ApiSchema, UUIDString


class Player(ApiSchema):
    """A child on the account: the `Profile` with its id, and whether this session plays as it."""

    id: UUIDString
    name: str | None
    age_band: AgeBand | None
    avatar: Avatar | None
    is_complete: bool
    is_active: bool
