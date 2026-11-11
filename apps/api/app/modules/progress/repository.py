from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import LearningProfile, LocationProgress


class LearningProfileRepository(Protocol):
    async def create_for_user(self, user_id: UUID) -> LearningProfile: ...

    async def get_by_user_id(self, user_id: UUID) -> LearningProfile | None: ...


class ProgressRepository(Protocol):
    async def get_location_progress(self, learning_profile_id: UUID) -> list[LocationProgress]: ...


class SqlAlchemyLearningProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_for_user(self, user_id: UUID) -> LearningProfile:
        profile = LearningProfile(user_id=user_id)
        self.session.add(profile)
        await self.session.flush()
        await self.session.refresh(profile)
        return profile

    async def get_by_user_id(self, user_id: UUID) -> LearningProfile | None:
        return await self.session.scalar(
            select(LearningProfile).where(LearningProfile.user_id == user_id)
        )


class SqlAlchemyProgressRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_location_progress(self, learning_profile_id: UUID) -> list[LocationProgress]:
        result = await self.session.scalars(
            select(LocationProgress).where(
                LocationProgress.learning_profile_id == learning_profile_id
            )
        )
        return list(result)
