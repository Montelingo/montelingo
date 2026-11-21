"""Services for map availability, learning progress and the child profile."""

from __future__ import annotations

from uuid import UUID

from app.core.errors import ApiError, ErrorCode
from app.db.transaction import TransactionManager

from .domain import (
    ChapterProgressRecord,
    ChildProfile,
    InvalidChildProfile,
    calculate_chapter_state,
    calculate_chapter_states,
    calculate_map_states,
    is_location_completed,
)
from .domain import ChapterState as ChapterStateRecord
from .repository import ChildProfileRepository, ProgressRepository
from .schemas import (
    GAME_IDS,
    AgeBand,
    Avatar,
    ChapterState,
    GameId,
    GameState,
    LocationState,
    Profile,
    ProgressState,
    RegionState,
)


class DatabaseProgressService:
    """Calculate map states from content and one learning profile's progress."""

    def __init__(self, repository: ProgressRepository) -> None:
        self.repository = repository

    async def get_state(self, learning_profile_id: UUID) -> ProgressState:
        content, progress = await self.repository.read_map(learning_profile_id)
        chapters = await self.repository.read_chapters(learning_profile_id)
        states = calculate_map_states(content, progress)
        chapter_states = calculate_chapter_states(chapters, states.locations)

        return ProgressState(
            regions=[RegionState(id=slug, state=state) for slug, state in states.regions.items()],
            locations=[
                LocationState(id=slug, state=state) for slug, state in states.locations.items()
            ],
            chapters=[_chapter_state(chapter) for chapter in chapter_states],
        )


class GameProgressService:
    """Record a finished game once, for the current account's learning profile."""

    def __init__(
        self,
        repository: ProgressRepository,
        transaction_manager: TransactionManager,
    ) -> None:
        self.repository = repository
        self.transaction_manager = transaction_manager

    async def complete_game(
        self,
        learning_profile_id: UUID,
        chapter_slug: str,
        game_slug: str,
    ) -> ChapterState:
        content, location_progress = await self.repository.read_map(learning_profile_id)
        chapters = await self.repository.read_chapters(learning_profile_id)
        chapter = _find_chapter(chapters, chapter_slug)
        game = _find_game(game_slug)

        location_states = calculate_map_states(content, location_progress).locations
        if location_states.get(chapter.location_slug, "locked") == "locked":
            raise ApiError(
                ErrorCode.CHAPTER_LOCKED,
                "The chapter's place is locked.",
                status_code=409,
            )

        state = _calculate(chapter)
        game_state = next(item.state for item in state.games if item.id == game)
        if game_state == "locked":
            raise ApiError(
                ErrorCode.GAME_LOCKED,
                "The game is locked until the lesson is seen.",
                status_code=409,
            )
        if game_state == "completed":
            # Recorded once (ADR 0006): a replay answers 200 and records nothing.
            # It does complete a place whose games are all done but that isn't
            # marked, like one finished before #139 or before content changed.
            if location_states[chapter.location_slug] != "completed" and is_location_completed(
                chapter.location_slug, chapters
            ):
                async with self.transaction_manager.transaction():
                    await self.repository.complete_location(
                        learning_profile_id, chapter.location_slug
                    )
            return _chapter_state(state)

        async with self.transaction_manager.transaction():
            # `record_game` locks the place's progress row, so the read below
            # sees a game recorded at the same moment in the same place.
            await self.repository.record_game(learning_profile_id, chapter_slug, game)
            # Read back what was stored, so a concurrent call answers the same state.
            recorded = await self.repository.read_chapters(learning_profile_id)
            # The place's last game completes it, which opens the next place (#139).
            if is_location_completed(chapter.location_slug, recorded):
                await self.repository.complete_location(learning_profile_id, chapter.location_slug)

        return _chapter_state(_calculate(_find_chapter(recorded, chapter_slug)))


def _find_chapter(
    chapters: list[ChapterProgressRecord], chapter_slug: str
) -> ChapterProgressRecord:
    chapter = next((item for item in chapters if item.chapter_slug == chapter_slug), None)
    if chapter is None:
        raise ApiError(ErrorCode.CONTENT_NOT_FOUND, "Chapter not found.", status_code=404)
    return chapter


def _find_game(game_slug: str) -> GameId:
    # Game ids are a fixed set in code, not content, but an unknown one is a 404
    # like an unknown chapter (ADR 0006).
    game = next((game_id for game_id in GAME_IDS if game_id == game_slug), None)
    if game is None:
        raise ApiError(ErrorCode.CONTENT_NOT_FOUND, "Game not found.", status_code=404)
    return game


def _calculate(chapter: ChapterProgressRecord) -> ChapterStateRecord:
    return calculate_chapter_state(
        chapter.chapter_slug,
        chapter.lesson_completed_at,
        chapter.completed_games,
    )


def _chapter_state(chapter: ChapterStateRecord) -> ChapterState:
    return ChapterState(
        id=chapter.id,
        lesson=chapter.lesson,
        games=[GameState(id=game.id, state=game.state) for game in chapter.games],
    )


def _profile(profile: ChildProfile) -> Profile:
    return Profile(
        name=profile.name,
        age_band=profile.age_band,
        avatar=profile.avatar,
        is_complete=profile.is_complete,
    )


def _missing_profile() -> ApiError:
    return ApiError(
        ErrorCode.UNEXPECTED_ERROR,
        "Learning profile is missing for the current user.",
        status_code=500,
    )


class ChildProfileService:
    """Read and set the child profile of one learning profile.

    Callers pass the current account's learning profile ID, so an account only
    ever reads or writes its own profile.
    """

    def __init__(
        self,
        repository: ChildProfileRepository,
        transaction_manager: TransactionManager,
    ) -> None:
        self.repository = repository
        self.transaction_manager = transaction_manager

    async def get(self, learning_profile_id: UUID) -> Profile:
        profile = await self.repository.get(learning_profile_id)
        if profile is None:
            raise _missing_profile()
        return _profile(profile)

    async def set_up(
        self,
        learning_profile_id: UUID,
        *,
        name: str,
        age_band: AgeBand,
        avatar: Avatar,
    ) -> Profile:
        try:
            profile = ChildProfile.set_up(name=name, age_band=age_band, avatar=avatar)
        except InvalidChildProfile as error:
            # The request schema checks the same rules, so this is a second line of defence.
            raise ApiError(ErrorCode.VALIDATION_ERROR, str(error), status_code=422) from error
        async with self.transaction_manager.transaction():
            if not await self.repository.save(learning_profile_id, profile):
                raise _missing_profile()
        return _profile(profile)
