from __future__ import annotations

from typing import Never

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.core.errors import ApiError, ErrorCode
from app.db.session import get_db_session
from app.db.transaction import SessionTransactionManager
from app.modules.auth import require_trusted_origin
from app.modules.content.schemas import Slug

from .dependencies import get_learning_profile
from .models import LearningProfile
from .repository import SqlAlchemyChildProfileRepository, SqlAlchemyProgressRepository
from .schemas import ChapterState, Profile, ProfileUpdate, ProgressState
from .service import ChildProfileService, DatabaseProgressService

# The module owns three top-level resources, /progress, /chapters and /profile,
# so its routes carry their paths and tags.
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


# Recording a lesson or a game writes progress, so it needs a session and, like
# every write, a trusted Origin. The session is checked first, so a request
# without one is a 401.
_RECORD_DEPENDENCIES = [Depends(get_learning_profile), Depends(require_trusted_origin)]
# Path parameters are slugs, so a malformed one is a 422 (ADR 0006).
_RECORD_ERRORS = error_responses(401, 403, 404, 409, 422, 500)


def _not_implemented() -> Never:
    # The contract is frozen in ADR 0006; #125 and #126 replace these stubs.
    raise ApiError(
        ErrorCode.NOT_IMPLEMENTED,
        "Recording chapter progress is not implemented.",
        status_code=501,
    )


@router.post(
    "/chapters/{chapter_id}/lesson",
    operation_id="progress_complete_lesson",
    tags=["progress"],
    response_model=ChapterState,
    responses=_RECORD_ERRORS,
    dependencies=_RECORD_DEPENDENCIES,
)
async def complete_lesson(chapter_id: Slug) -> ChapterState:
    _not_implemented()


@router.post(
    "/chapters/{chapter_id}/games/{game_id}/result",
    operation_id="progress_complete_game",
    tags=["progress"],
    response_model=ChapterState,
    responses=_RECORD_ERRORS,
    dependencies=_RECORD_DEPENDENCIES,
)
async def complete_game(chapter_id: Slug, game_id: Slug) -> ChapterState:
    # `game_id` is a slug, not the game literal, so an unknown game is a 404
    # `content_not_found` like an unknown chapter, not a 422.
    _not_implemented()


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
