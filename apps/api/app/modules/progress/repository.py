"""Progress persistence and learning-profile repositories."""

from __future__ import annotations

from typing import Protocol, cast
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content import (
    Content,
    read_location_id,
    read_map_chapters,
    read_map_content,
)

from .domain import ChapterProgressRecord, ChildProfile, LocationProgressRecord
from .models import ChapterProgress, GameResult, LearningProfile, LocationProgress
from .schemas import AgeBand, Avatar, GameId


class LearningProfileRepository(Protocol):
    async def create_for_user(self, user_id: UUID) -> LearningProfile: ...

    async def get_by_user_id(
        self,
        user_id: UUID,
    ) -> LearningProfile | None: ...


class SqlAlchemyLearningProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_for_user(self, user_id: UUID) -> LearningProfile:
        profile = LearningProfile(user_id=user_id)
        self.session.add(profile)
        await self.session.flush()
        await self.session.refresh(profile)
        return profile

    async def get_by_user_id(
        self,
        user_id: UUID,
    ) -> LearningProfile | None:
        return await self.session.scalar(
            select(LearningProfile).where(LearningProfile.user_id == user_id)
        )


class ChildProfileRepository(Protocol):
    async def get(self, learning_profile_id: UUID) -> ChildProfile | None: ...

    async def save(self, learning_profile_id: UUID, profile: ChildProfile) -> bool: ...


def _child_profile(row: LearningProfile) -> ChildProfile:
    # The table's check constraints keep the band and avatar to the known values.
    return ChildProfile(
        name=row.name,
        age_band=cast(AgeBand | None, row.age_band),
        avatar=cast(Avatar | None, row.avatar),
    )


class SqlAlchemyChildProfileRepository:
    """Reads and writes the child profile columns of one learning profile."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, learning_profile_id: UUID) -> ChildProfile | None:
        row = await self.session.get(LearningProfile, learning_profile_id)
        return _child_profile(row) if row is not None else None

    async def save(self, learning_profile_id: UUID, profile: ChildProfile) -> bool:
        """Store the profile. Returns False when the learning profile does not exist."""
        row = await self.session.get(LearningProfile, learning_profile_id)
        if row is None:
            return False
        row.name = profile.name
        row.age_band = profile.age_band
        row.avatar = profile.avatar
        await self.session.flush()
        return True


class ProgressRepository(Protocol):
    async def read_map(
        self,
        learning_profile_id: UUID,
    ) -> tuple[Content, list[LocationProgressRecord]]: ...

    async def read_chapters(
        self,
        learning_profile_id: UUID,
    ) -> list[ChapterProgressRecord]: ...

    async def record_lesson(
        self, learning_profile_id: UUID, chapter_slug: str, location_slug: str
    ) -> None: ...

    async def record_game(
        self,
        learning_profile_id: UUID,
        chapter_slug: str,
        game: GameId,
    ) -> None:
        """Record a finished game once, and start its place if it wasn't started.

        Must be called in a transaction. It also locks the place's progress
        row until that transaction ends, so two games finished at once in one
        place are recorded one after the other. A `read_chapters` after it in
        the same transaction then sees every game recorded before it,
        including the other call's, which `GameProgressService.complete_game`
        relies on to complete the place (#139).

        That holds under PostgreSQL's default READ COMMITTED isolation, where
        each statement sees what was committed before it started. Under
        REPEATABLE READ the second transaction would keep its first snapshot
        and miss the other game.
        """
        ...

    async def complete_location(
        self,
        learning_profile_id: UUID,
        location_slug: str,
    ) -> None: ...


class SqlAlchemyProgressRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def read_map(
        self,
        learning_profile_id: UUID,
    ) -> tuple[Content, list[LocationProgressRecord]]:
        content, location_slugs = await read_map_content(self.session)

        progress_result = await self.session.execute(
            select(
                LocationProgress.location_id,
                LocationProgress.started_at,
                LocationProgress.completed_at,
            ).where(LocationProgress.learning_profile_id == learning_profile_id)
        )

        progress = [
            LocationProgressRecord(
                location_slug=location_slugs[location_id],
                started_at=started_at,
                completed_at=completed_at,
            )
            for location_id, started_at, completed_at in progress_result.all()
        ]

        return content, progress

    async def read_chapters(
        self,
        learning_profile_id: UUID,
    ) -> list[ChapterProgressRecord]:
        """Every content chapter in map order, with this profile's lesson and games."""

        chapters = await read_map_chapters(self.session)

        lesson_result = await self.session.execute(
            select(ChapterProgress.chapter_id, ChapterProgress.lesson_completed_at).where(
                ChapterProgress.learning_profile_id == learning_profile_id
            )
        )
        lessons = dict(lesson_result.tuples().all())

        game_result = await self.session.execute(
            select(GameResult.chapter_id, GameResult.game).where(
                GameResult.learning_profile_id == learning_profile_id
            )
        )
        games: dict[UUID, list[GameId]] = {}
        for chapter_id, game in game_result.tuples().all():
            # The table's check constraint keeps `game` to the known game ids.
            games.setdefault(chapter_id, []).append(game)

        return [
            ChapterProgressRecord(
                chapter_slug=chapter.slug,
                location_slug=chapter.location_slug,
                lesson_completed_at=lessons.get(chapter.id),
                completed_games=tuple(games.get(chapter.id, ())),
            )
            for chapter in chapters
        ]

    async def record_lesson(
        self, learning_profile_id: UUID, chapter_slug: str, location_slug: str
    ) -> None:
        """Record the first time a lesson is seen, and start its place if it wasn't started.

        `ON CONFLICT` keeps the first completion time, so a repeated or a
        concurrent call changes nothing (ADR 0006). The caller has checked the
        chapter exists and owns the transaction.
        """

        chapters = await read_map_chapters(self.session)
        chapter = next((item for item in chapters if item.slug == chapter_slug), None)
        if chapter is None or chapter.location_slug != location_slug:
            raise LookupError(f"Chapter {chapter_slug!r} is no longer in the content.")

        location_id = await self._location_id(location_slug)

        # Doing anything in a place starts it (ADR 0006).
        await self.session.execute(
            insert(LocationProgress)
            .values(learning_profile_id=learning_profile_id, location_id=location_id)
            .on_conflict_do_nothing()
        )

        chapter_insert = insert(ChapterProgress).values(
            learning_profile_id=learning_profile_id,
            chapter_id=chapter.id,
            lesson_completed_at=func.now(),
        )
        await self.session.execute(
            chapter_insert.on_conflict_do_update(
                index_elements=[ChapterProgress.learning_profile_id, ChapterProgress.chapter_id],
                set_={
                    "lesson_completed_at": func.coalesce(
                        ChapterProgress.lesson_completed_at, func.now()
                    )
                },
            )
        )

    async def record_game(
        self,
        learning_profile_id: UUID,
        chapter_slug: str,
        game: GameId,
    ) -> None:
        """Record a finished game once, and start its place if it wasn't started.

        `ON CONFLICT DO NOTHING` keeps the first result, so a repeated or a
        concurrent call changes nothing (ADR 0006). The caller has checked the
        chapter exists and owns the transaction.

        The place's progress row stays locked until the transaction ends; see
        `ProgressRepository.record_game` for why (#139).
        """

        chapters = await read_map_chapters(self.session)
        chapter = next((item for item in chapters if item.slug == chapter_slug), None)
        if chapter is None:
            raise LookupError(f"Chapter {chapter_slug!r} is no longer in the content.")

        location_id = await self._location_id(chapter.location_slug)

        # Doing anything in a place starts it (ADR 0006).
        await self.session.execute(
            insert(LocationProgress)
            .values(learning_profile_id=learning_profile_id, location_id=location_id)
            .on_conflict_do_nothing()
        )
        await self.session.execute(
            select(LocationProgress.location_id)
            .where(
                LocationProgress.learning_profile_id == learning_profile_id,
                LocationProgress.location_id == location_id,
            )
            .with_for_update()
        )
        await self.session.execute(
            insert(GameResult)
            .values(learning_profile_id=learning_profile_id, chapter_id=chapter.id, game=game)
            .on_conflict_do_nothing()
        )

    async def complete_location(
        self,
        learning_profile_id: UUID,
        location_slug: str,
    ) -> None:
        """Mark a started place completed. The first completion is kept.

        `completed_at IS NULL` makes it safe to call again: a replay that
        finds a place complete but not marked calls it too (#139). A place
        that was never started has no row, so nothing changes.
        """

        location_id = await self._location_id(location_slug)
        await self.session.execute(
            update(LocationProgress)
            .where(
                LocationProgress.learning_profile_id == learning_profile_id,
                LocationProgress.location_id == location_id,
                LocationProgress.completed_at.is_(None),
            )
            .values(completed_at=func.now())
        )

    async def _location_id(self, location_slug: str) -> UUID:
        location_id = await read_location_id(self.session, location_slug)
        if location_id is None:
            raise LookupError(f"Place {location_slug!r} is no longer in the content.")
        return location_id
