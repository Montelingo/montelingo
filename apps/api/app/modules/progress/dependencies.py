from __future__ import annotations

from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError, ErrorCode
from app.db.session import get_db_session
from app.modules.auth import get_current_user
from app.modules.auth.schemas import CurrentUser

from .models import LearningProfile
from .repository import SqlAlchemyLearningProfileRepository


async def get_learning_profile(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LearningProfile:
    profile = await SqlAlchemyLearningProfileRepository(session).get_by_user_id(
        UUID(current_user.id)
    )
    if profile is None:
        raise ApiError(
            ErrorCode.UNEXPECTED_ERROR,
            "Learning profile is missing for the current user.",
            status_code=500,
        )
    return profile
