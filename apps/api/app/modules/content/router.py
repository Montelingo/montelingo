
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.db.session import get_db_session
from app.modules.auth import get_current_user
from app.schemas.common import PaginatedResponse

from .repository import SqlAlchemyContentRepository
from .schemas import LocationDetail, RegionDetail, RegionSummary
from .service import ContentService

router = APIRouter(dependencies=[Depends(get_current_user)])

CACHE_CONTROL = "private, max-age=300"


def get_content_service(
    session: AsyncSession = Depends(get_db_session),
) -> ContentService:
    return ContentService(repository=SqlAlchemyContentRepository(session))


@router.get(
    "/regions",
    operation_id="content_list_regions",
    response_model=PaginatedResponse[RegionSummary],
    responses=error_responses(401),
)
async def list_regions(
    response: Response,
    service: ContentService = Depends(get_content_service),
) -> PaginatedResponse[RegionSummary]:
    result = await service.list_regions()
    response.headers["Cache-Control"] = CACHE_CONTROL
    return result


@router.get(
    "/regions/{region_id}",
    operation_id="content_get_region",
    response_model=RegionDetail,
    responses=error_responses(401, 404, 422),
)
async def get_region(
    region_id: str,
    response: Response,
    service: ContentService = Depends(get_content_service),
) -> RegionDetail:
    result = await service.get_region(region_id)
    response.headers["Cache-Control"] = CACHE_CONTROL
    return result


@router.get(
    "/locations/{location_id}",
    operation_id="content_get_location",
    response_model=LocationDetail,
    responses=error_responses(401, 404, 422),
)
async def get_location(
    location_id: str,
    response: Response,
    service: ContentService = Depends(get_content_service),
) -> LocationDetail:
    result = await service.get_location(location_id)
    response.headers["Cache-Control"] = CACHE_CONTROL
    return result
