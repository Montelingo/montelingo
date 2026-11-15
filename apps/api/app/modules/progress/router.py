from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.db.session import get_db_session
from app.db.transaction import SessionTransactionManager
from app.modules.auth import require_trusted_origin

from .dependencies import get_learning_profile
from .models import LearningProfile
from .repository import SqlAlchemyChildProfileRepository, SqlAlchemyProgressRepository
from .schemas import Profile, ProfileUpdate, ProgressState
from .service import ChildProfileService, DatabaseProgressService

# The module owns two top-level resources, /progress and /profile, so its routes
# carry their paths and tags.
router = APIRouter()


def get_progress_service(
    session: AsyncSession = Depends(get_db_session),
) -> DatabaseProgressService:
    repository = SqlAlchemyProgressRepository(session)
    return DatabaseProgressService(repository)


def get_child_profile_service(
    session: AsyncSession = Depends(get_db_session),
) -> ChildProfileService:
    return ChildProfileService(
        repository=SqlAlchemyChildProfileRepository(session),
        transaction_manager=SessionTransactionManager(session),
    )


@router.get(
    "/progress",
    operation_id="progress_get",
    tags=["progress"],
    response_model=ProgressState,
    responses=error_responses(401, 500),
)
async def get_progress(
    service: DatabaseProgressService = Depends(get_progress_service),
    learning_profile: LearningProfile = Depends(get_learning_profile),
) -> ProgressState:
    return await service.get_state(learning_profile.id)


@router.get(
    "/profile",
    operation_id="profile_get",
    tags=["profile"],
    response_model=Profile,
    responses=error_responses(401, 500),
)
async def get_profile(
    learning_profile: LearningProfile = Depends(get_learning_profile),
    service: ChildProfileService = Depends(get_child_profile_service),
) -> Profile:
    return await service.get(learning_profile.id)


@router.put(
    "/profile",
    operation_id="profile_update",
    tags=["profile"],
    response_model=Profile,
    responses=error_responses(401, 403, 422, 500),
)
async def update_profile(
    payload: ProfileUpdate,
    # The session is checked before the Origin, so a request without one is a 401.
    learning_profile: LearningProfile = Depends(get_learning_profile),
    _trusted_origin: None = Depends(require_trusted_origin),
    service: ChildProfileService = Depends(get_child_profile_service),
) -> Profile:
    return await service.set_up(
        learning_profile.id,
        name=payload.name,
        age_band=payload.age_band,
        avatar=payload.avatar,
    )
