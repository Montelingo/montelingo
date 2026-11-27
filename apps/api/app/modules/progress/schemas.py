from __future__ import annotations

from typing import Annotated, Literal, get_args

from pydantic import Field, StringConstraints

from app.modules.content.schemas import Slug, Word
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
    # 0 to 3: one for the place's lessons and one for each game (ADR 0009).
    stars: int = Field(ge=0, le=3)


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


class ChapterResult(ChapterState):
    """What recording a lesson or a game answers: the chapter, and whether it gave a heart.

    A heart comes from a replay, up to a daily cap (ADR 0009). Past the cap,
    or the first time, `heart_earned` is false and nothing else changes.
    """

    heart_earned: bool


class PracticeResult(ApiSchema):
    """What recording a practice game answers: whether it gave a heart (ADR 0009).

    Practice changes no lock, sticker, star or count of words. Past the daily
    cap `heart_earned` is false.
    """

    heart_earned: bool


# What a heart was earned for (ADR 0009).
HeartSource = Literal["lesson", "game", "practice"]
HEART_SOURCES: tuple[HeartSource, ...] = get_args(HeartSource)


class ProgressCounts(ApiSchema):
    """What the child has collected, for the Ja screen and the grown-ups area (#175).

    The server counts them, so the frontend never does (ADR 0005).
    """

    # Every word of each chapter whose lesson is `done`.
    words_learned: int
    # One per `completed` place, the same rule as the Prizes screen.
    stickers: int
    # The sum of every place's `stars` (ADR 0009).
    stars: int
    # Every heart the player has earned (ADR 0009).
    hearts: int


class ProgressState(ApiSchema):
    regions: list[RegionState]
    locations: list[LocationState]
    # Only the chapters of places that are not `locked` (ADR 0006).
    chapters: list[ChapterState]
    counts: ProgressCounts


class LearnedPlace(ApiSchema):
    """A place where the child has seen at least one lesson, with those lessons' words."""

    id: Slug
    region_id: Slug
    name: str
    # Chapter by chapter in map order, each chapter's words in recording order.
    words: list[Word]


class NextPlace(ApiSchema):
    """The first open place with a lesson still to see: "Posjeti Kotor i sakupi još 4 riječi"."""

    id: Slug
    region_id: Slug
    name: str
    # The words of the lessons not seen yet in that place, always more than 0.
    word_count: int = Field(ge=1)


class LearnedWords(ApiSchema):
    """Every word the child has learned, by place, for the Riječi tab (#232).

    A word is learned once its chapter's lesson is seen, the same rule as
    `ProgressCounts.words_learned`, so the words listed add up to that count.
    """

    # In content order. A place without a seen lesson is not listed.
    places: list[LearnedPlace]
    # Null when every lesson of every open place has been seen.
    next_place: NextPlace | None


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
