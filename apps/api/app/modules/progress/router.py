from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, Depends

from app.api.responses import error_responses
from app.modules.progress import get_learning_profile
from app.modules.content import Content, load_content
from .models import LearningProfile

from .dependencies import get_learning_profile
from .models import LearningProfile
from .schemas import ProgressState
from .service import ProgressService

router = APIRouter()


@lru_cache
def _content() -> Content:
    return load_content()


def get_progress_service() -> ProgressService:
    return ProgressService(_content())


@router.get(
    "",
    operation_id="progress_get",
    response_model=ProgressState,
    responses=error_responses(401, 500),
)
async def get_progress(
    service: ProgressService = Depends(get_progress_service),
    _learning_profile: LearningProfile = Depends(get_learning_profile),
) -> ProgressState:
    return service.get_state()
