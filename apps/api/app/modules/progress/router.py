from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.db.session import get_db_session
from app.db.transaction import SessionTransactionManager
from app.modules.auth import require_trusted_origin
from app.modules.content.schemas import Slug

from .dependencies import get_learning_profile
from .models import LearningProfile
from .repository import SqlAlchemyChildProfileRepository, SqlAlchemyProgressRepository
from .schemas import ChapterResult, LearnedWords, Profile, ProfileUpdate, ProgressState
from .service import (
    ChildProfileService,
    DatabaseProgressService,
    GameProgressService,
    LessonProgressService,
)

# The module owns four top-level resources, /progress, /words, /chapters and /profile,
# so its routes carry their paths and tags.
router = APIRouter()


def get_progress_service(
    session: AsyncSession = Depends(get_db_session),
) -> DatabaseProgressService:
    repository = SqlAlchemyProgressRepository(session)
    return DatabaseProgressService(repository)


def get_lesson_service(
    session: AsyncSession = Depends(get_db_session),
) -> LessonProgressService:
    return LessonProgressService(
        repository=SqlAlchemyProgressRepository(session),
        transaction_manager=SessionTransactionManager(session),
    )


def get_game_progress_service(
    session: AsyncSession = Depends(get_db_session),
) -> GameProgressService:
    return GameProgressService(
        repository=SqlAlchemyProgressRepository(session),
        transaction_manager=SessionTransactionManager(session),
    )


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
    "/words",
    operation_id="progress_list_words",
    tags=["progress"],
    response_model=LearnedWords,
    responses=error_responses(401, 500),
)
async def list_learned_words(
    service: DatabaseProgressService = Depends(get_progress_service),
    learning_profile: LearningProfile = Depends(get_learning_profile),
) -> LearnedWords:
    """The child's learned words by place, for the Riječi tab (#232)."""
    return await service.get_learned_words(learning_profile.id)


# Recording a lesson or a game writes progress, so it needs a session and, like
# every write, a trusted Origin. The session is checked first, so a request
# without one is a 401.
_RECORD_DEPENDENCIES = [Depends(get_learning_profile), Depends(require_trusted_origin)]
# Path parameters are slugs, so a malformed one is a 422 (ADR 0006).
_RECORD_ERRORS = error_responses(401, 403, 404, 409, 422, 500)


@router.post(
    "/chapters/{chapter_id}/lesson",
    operation_id="progress_complete_lesson",
    tags=["progress"],
    response_model=ChapterResult,
    responses=_RECORD_ERRORS,
    dependencies=_RECORD_DEPENDENCIES,
)
async def complete_lesson(
    chapter_id: Slug,
    learning_profile: LearningProfile = Depends(get_learning_profile),
    service: LessonProgressService = Depends(get_lesson_service),
) -> ChapterResult:
    return await service.complete_lesson(learning_profile.id, chapter_id)


@router.post(
    "/chapters/{chapter_id}/games/{game_id}/result",
    operation_id="progress_complete_game",
    tags=["progress"],
    response_model=ChapterResult,
    responses=_RECORD_ERRORS,
    dependencies=_RECORD_DEPENDENCIES,
)
async def complete_game(
    chapter_id: Slug,
    # A slug, not the game literal, so an unknown game is a 404
    # `content_not_found` like an unknown chapter, not a 422.
    game_id: Slug,
    learning_profile: LearningProfile = Depends(get_learning_profile),
    service: GameProgressService = Depends(get_game_progress_service),
) -> ChapterResult:
    return await service.complete_game(learning_profile.id, chapter_id, game_id)


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
