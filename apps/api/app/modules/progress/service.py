"""Services for map availability, learning progress and the child profile."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID

from app.core.errors import ApiError, ErrorCode
from app.db.transaction import TransactionManager
from app.modules.content.schemas import Word

from .domain import (
    ChapterProgressRecord,
    ChildProfile,
    InvalidChildProfile,
    calculate_chapter_state,
    calculate_chapter_states,
    calculate_learned_chapters,
    calculate_map_states,
    calculate_progress_counts,
    calculate_stars,
    has_room_for_heart,
    heart_day_start,
    is_location_completed,
)
from .domain import ChapterState as ChapterStateRecord
from .repository import ChildProfileRepository, ProgressRepository
from .schemas import (
    GAME_IDS,
    PRACTICE_GAME_IDS,
    AgeBand,
    Avatar,
    ChapterResult,
    ChapterState,
    GameId,
    GameState,
    HeartSource,
    LearnedPlace,
    LearnedWords,
    LocationState,
    NextPlace,
    PracticeGameId,
    PracticeResult,
    Profile,
    ProgressCounts,
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
        counts = calculate_progress_counts(chapters, states.locations)
        stars = calculate_stars(chapters, states.locations)
        hearts = await self.repository.count_hearts(learning_profile_id)

        return ProgressState(
            regions=[RegionState(id=slug, state=state) for slug, state in states.regions.items()],
            locations=[
                LocationState(id=slug, state=state, stars=stars[slug])
                for slug, state in states.locations.items()
            ],
            chapters=[_chapter_state(chapter) for chapter in chapter_states],
            counts=ProgressCounts(
                words_learned=counts.words_learned,
                stickers=counts.stickers,
                stars=counts.stars,
                hearts=hearts,
            ),
        )

    async def get_learned_words(self, learning_profile_id: UUID) -> LearnedWords:
        """Every word the child has learned, by place, and the place to learn more (#232)."""

        content, progress = await self.repository.read_map(learning_profile_id)
        chapters = await self.repository.read_chapters(learning_profile_id)
        states = calculate_map_states(content, progress)
        learned = calculate_learned_chapters(content, chapters, states.locations)
        words = await self.repository.read_words(
            slug for place in learned.places for slug in place.chapter_slugs
        )
        locations = {location.slug: location for location in content.locations}

        next_place = None
        if learned.next_place is not None:
            location = locations[learned.next_place.location_slug]
            next_place = NextPlace(
                id=location.slug,
                region_id=location.region_slug,
                name=location.name,
                word_count=learned.next_place.word_count,
            )

        return LearnedWords(
            places=[
                LearnedPlace(
                    id=place.location_slug,
                    region_id=locations[place.location_slug].region_slug,
                    name=locations[place.location_slug].name,
                    words=[
                        Word.from_read(word)
                        for slug in place.chapter_slugs
                        for word in words.get(slug, ())
                    ],
                )
                for place in learned.places
            ],
            next_place=next_place,
        )


# The time now, aware. Services take it so tests can cross a day.
Clock = Callable[[], datetime]


def _utc_now() -> datetime:
    return datetime.now(UTC)


async def _earn_heart(
    repository: ProgressRepository,
    learning_profile_id: UUID,
    now: datetime,
    source: HeartSource,
    *,
    chapter_slug: str | None = None,
    game: PracticeGameId | None = None,
) -> bool:
    """Add a heart unless the player has reached today's cap (ADR 0009).

    Must be called in a transaction. The player stays locked until it ends,
    so two replays at once cannot both pass the cap.
    """

    await repository.lock_hearts(learning_profile_id)
    today = await repository.count_hearts(learning_profile_id, since=heart_day_start(now))
    if not has_room_for_heart(today):
        return False
    await repository.add_heart(
        learning_profile_id, earned_at=now, source=source, chapter_slug=chapter_slug, game=game
    )
    return True


class LessonProgressService:
    """Record a seen lesson once, and a heart when it is seen again (ADR 0009)."""

    def __init__(
        self,
        repository: ProgressRepository,
        transaction_manager: TransactionManager,
        clock: Clock = _utc_now,
    ) -> None:
        self.repository = repository
        self.transaction_manager = transaction_manager
        self.clock = clock

    async def complete_lesson(self, learning_profile_id: UUID, chapter_slug: str) -> ChapterResult:
        content, location_progress = await self.repository.read_map(learning_profile_id)
        chapters = await self.repository.read_chapters(learning_profile_id)
        chapter = _find_chapter(chapters, chapter_slug)

        location_states = calculate_map_states(content, location_progress).locations
        if location_states.get(chapter.location_slug, "locked") == "locked":
            raise ApiError(
                ErrorCode.CHAPTER_LOCKED,
                "The chapter's place is locked.",
                status_code=409,
            )

        # Seeing a lesson again is practice; the first time gives a star instead.
        is_replay = chapter.lesson_completed_at is not None
        heart_earned = False
        async with self.transaction_manager.transaction():
            await self.repository.record_lesson(
                learning_profile_id, chapter_slug, chapter.location_slug
            )
            if is_replay:
                heart_earned = await _earn_heart(
                    self.repository,
                    learning_profile_id,
                    self.clock(),
                    "lesson",
                    chapter_slug=chapter_slug,
                )
            # Read back what was stored, so a concurrent call answers the same state.
            recorded = await self.repository.read_chapters(learning_profile_id)

        return _chapter_result(_calculate(_find_chapter(recorded, chapter_slug)), heart_earned)


class GameProgressService:
    """Record a finished game once, and a heart when it is played again (ADR 0009)."""

    def __init__(
        self,
        repository: ProgressRepository,
        transaction_manager: TransactionManager,
        clock: Clock = _utc_now,
    ) -> None:
        self.repository = repository
        self.transaction_manager = transaction_manager
        self.clock = clock

    async def complete_game(
        self,
        learning_profile_id: UUID,
        chapter_slug: str,
        game_slug: str,
    ) -> ChapterResult:
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
            # Recorded once (ADR 0006): a replay changes no state, but may give
            # a heart (ADR 0009). It does complete a place whose games are all
            # done but that isn't marked, like one finished before #139 or
            # before content changed.
            async with self.transaction_manager.transaction():
                if location_states[chapter.location_slug] != "completed" and is_location_completed(
                    chapter.location_slug, chapters
                ):
                    await self.repository.complete_location(
                        learning_profile_id, chapter.location_slug
                    )
                heart_earned = await _earn_heart(
                    self.repository,
                    learning_profile_id,
                    self.clock(),
                    "game",
                    chapter_slug=chapter_slug,
                    game=game,
                )
            return _chapter_result(state, heart_earned)

        async with self.transaction_manager.transaction():
            # `record_game` locks the place's progress row, so the read below
            # sees a game recorded at the same moment in the same place.
            await self.repository.record_game(learning_profile_id, chapter_slug, game)
            # Read back what was stored, so a concurrent call answers the same state.
            recorded = await self.repository.read_chapters(learning_profile_id)
            # The place's last game completes it, which opens the next place (#139).
            if is_location_completed(chapter.location_slug, recorded):
                await self.repository.complete_location(learning_profile_id, chapter.location_slug)

        # The first time gives a star, not a heart.
        return _chapter_result(_calculate(_find_chapter(recorded, chapter_slug)), False)


class PracticeProgressService:
    """Record a finished practice game from the Riječi tab, as a heart (ADR 0009).

    Practice has no chapter, so it changes no lock, sticker, star or count:
    it only adds a heart, under the same daily cap as replays.
    """

    def __init__(
        self,
        repository: ProgressRepository,
        transaction_manager: TransactionManager,
        clock: Clock = _utc_now,
    ) -> None:
        self.repository = repository
        self.transaction_manager = transaction_manager
        self.clock = clock

    async def complete_practice(self, learning_profile_id: UUID, game_slug: str) -> PracticeResult:
        game = _find_practice_game(game_slug)
        chapters = await self.repository.read_chapters(learning_profile_id)
        # The same rule as `words_learned`: practice deals from learned words.
        if not any(
            chapter.lesson_completed_at is not None and chapter.word_count > 0
            for chapter in chapters
        ):
            raise ApiError(
                ErrorCode.NO_LEARNED_WORDS,
                "There are no learned words to practise yet.",
                status_code=409,
            )

        async with self.transaction_manager.transaction():
            heart_earned = await _earn_heart(
                self.repository, learning_profile_id, self.clock(), "practice", game=game
            )
        return PracticeResult(heart_earned=heart_earned)


def _find_chapter(
    chapters: list[ChapterProgressRecord], chapter_slug: str
) -> ChapterProgressRecord:
    chapter = next((item for item in chapters if item.chapter_slug == chapter_slug), None)
    if chapter is None:
        raise ApiError(ErrorCode.CONTENT_NOT_FOUND, "Chapter not found.", status_code=404)
    return chapter


def _find_game(game_slug: str) -> GameId:
    return _find_one_of(GAME_IDS, game_slug)


def _find_practice_game(game_slug: str) -> PracticeGameId:
    # `spell` is practice only (#294): a chapter result for it is a 404.
    return _find_one_of(PRACTICE_GAME_IDS, game_slug)


def _find_one_of[G: str](game_ids: tuple[G, ...], game_slug: str) -> G:
    # Game ids are a fixed set in code, not content, but an unknown one is a 404
    # like an unknown chapter (ADR 0006).
    game = next((game_id for game_id in game_ids if game_id == game_slug), None)
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


def _chapter_result(chapter: ChapterStateRecord, heart_earned: bool) -> ChapterResult:
    return ChapterResult(
        id=chapter.id,
        lesson=chapter.lesson,
        games=[GameState(id=game.id, state=game.state) for game in chapter.games],
        heart_earned=heart_earned,
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
