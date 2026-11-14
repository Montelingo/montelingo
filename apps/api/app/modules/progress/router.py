from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.db.session import get_db_session

from .dependencies import get_learning_profile
from .models import LearningProfile
from .repository import SqlAlchemyProgressRepository
from .schemas import ProgressState
from .service import DatabaseProgressService

router = APIRouter()


def get_progress_service(
    session: AsyncSession = Depends(get_db_session),
) -> DatabaseProgressService:
    repository = SqlAlchemyProgressRepository(session)
    return DatabaseProgressService(repository)


@router.get(
    "",
    operation_id="progress_get",
    response_model=ProgressState,
    responses=error_responses(401, 500),
)
async def get_progress(
    service: DatabaseProgressService = Depends(get_progress_service),
    learning_profile: LearningProfile = Depends(get_learning_profile),
) -> ProgressState:
    return await service.get_state(learning_profile.id)
