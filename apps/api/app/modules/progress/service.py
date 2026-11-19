"""Services for map availability, learning progress and the child profile."""

from __future__ import annotations

from uuid import UUID

from app.core.errors import ApiError, ErrorCode
from app.db.transaction import TransactionManager

from .domain import ChapterState as ChapterStateRecord
from .domain import (
    ChildProfile,
    InvalidChildProfile,
    calculate_chapter_state,
    calculate_chapter_states,
    calculate_map_states,
)
from .repository import ChildProfileRepository, ProgressRepository
from .schemas import (
    AgeBand,
    Avatar,
    ChapterState,
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


class LessonProgressService:
    """Record lesson completion once, scoped to the authenticated learner."""

    def __init__(
        self, repository: ProgressRepository, transaction_manager: TransactionManager
    ) -> None:
        self.repository = repository
        self.transaction_manager = transaction_manager

    async def complete_lesson(self, learning_profile_id: UUID, chapter_slug: str) -> ChapterState:
        content, location_progress = await self.repository.read_map(learning_profile_id)
        chapters = await self.repository.read_chapters(learning_profile_id)
        chapter = next((item for item in chapters if item.chapter_slug == chapter_slug), None)
        if chapter is None:
            raise ApiError(ErrorCode.CONTENT_NOT_FOUND, "Chapter not found.", status_code=404)

        location_states = calculate_map_states(content, location_progress).locations
        if location_states.get(chapter.location_slug, "locked") == "locked":
            raise ApiError(ErrorCode.CONFLICT, "Chapter is in a locked location.", status_code=409)

        async with self.transaction_manager.transaction():
            await self.repository.record_lesson(
                learning_profile_id, chapter_slug, chapter.location_slug
            )

        # Re-read after commit so concurrent/repeated requests return persisted state.
        updated = await self.repository.read_chapters(learning_profile_id)
        recorded = next(item for item in updated if item.chapter_slug == chapter_slug)
        return _chapter_state(
            calculate_chapter_state(
                recorded.chapter_slug, recorded.lesson_completed_at, recorded.completed_games
            )
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
