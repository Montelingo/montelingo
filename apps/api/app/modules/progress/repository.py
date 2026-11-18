"""Progress persistence and learning-profile repositories."""

from __future__ import annotations

from typing import Protocol, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content import Content, read_map_chapters, read_map_content

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
