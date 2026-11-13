"""Progress persistence and learning-profile repository."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content import Content, read_map_content

from .domain import LocationProgressRecord
from .models import LearningProfile, LocationProgress


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


class ProgressRepository(Protocol):
    async def read_map(
        self,
        learning_profile_id: UUID,
    ) -> tuple[Content, list[LocationProgressRecord]]: ...


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
