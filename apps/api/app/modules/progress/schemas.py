from __future__ import annotations

from typing import Annotated, Literal, get_args

from pydantic import StringConstraints

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


# A chapter's lesson and games (ADR 0006). The server decides them; the
# frontend never computes a lock.
LessonState = Literal["todo", "done"]
GameId = Literal["memory", "match"]
GameStatus = Literal["locked", "available", "completed"]

# The fixed set of games, in the order every chapter lists them.
GAME_IDS: tuple[GameId, ...] = get_args(GameId)


class GameState(ApiSchema):
    id: GameId
    state: GameStatus


class ChapterState(ApiSchema):
    """A chapter's lesson and its games, always listed `memory`, then `match`."""

    id: Slug
    lesson: LessonState
    games: list[GameState]


class ProgressState(ApiSchema):
    regions: list[RegionState]
    locations: list[LocationState]
    # Only the chapters of places that are not `locked` (ADR 0006).
    chapters: list[ChapterState]


# The child's profile on the learning profile (#117). The bands and buddies are
# the ones in Figma "1 · Welcome & Auth" (A5, A6).
AgeBand = Literal["3-4", "5-6", "7"]
Avatar = Literal["fox", "bear", "bunny", "frog", "owl", "cat"]

AGE_BANDS: tuple[AgeBand, ...] = get_args(AgeBand)
AVATARS: tuple[Avatar, ...] = get_args(Avatar)
NAME_MAX_LENGTH = 30

ProfileName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_MAX_LENGTH)
]


class Profile(ApiSchema):
    """The current account's child profile. Fields stay null until it is set up."""

    name: str | None
    age_band: AgeBand | None
    avatar: Avatar | None
    is_complete: bool


class ProfileUpdate(ApiSchema):
    """Sets the whole profile. The name is trimmed before its length is checked."""

    name: ProfileName
    age_band: AgeBand
    avatar: Avatar
