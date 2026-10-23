from __future__ import annotations

from typing import Never

from fastapi import APIRouter, Depends

from app.api.responses import error_responses
from app.core.errors import ApiError, ErrorCode
from app.modules.auth import get_current_user
from app.schemas.common import PaginatedResponse

from .schemas import LocationDetail, RegionDetail, RegionSummary

# Every content route needs a session, so it answers 401 before anything else.
router = APIRouter(dependencies=[Depends(get_current_user)])


def _not_implemented() -> Never:
    # The contract is frozen in #58; #63 replaces these stubs with the read path.
    raise ApiError(
        ErrorCode.NOT_IMPLEMENTED,
        "Content endpoint is not implemented.",
        status_code=501,
    )


@router.get(
    "/regions",
    operation_id="content_list_regions",
    response_model=PaginatedResponse[RegionSummary],
    responses=error_responses(401),
)
async def list_regions() -> PaginatedResponse[RegionSummary]:
    _not_implemented()


@router.get(
    "/regions/{region_id}",
    operation_id="content_get_region",
    response_model=RegionDetail,
    responses=error_responses(401, 404, 422),
)
async def get_region(region_id: str) -> RegionDetail:
    _not_implemented()


@router.get(
    "/locations/{location_id}",
    operation_id="content_get_location",
    response_model=LocationDetail,
    responses=error_responses(401, 404, 422),
)
async def get_location(location_id: str) -> LocationDetail:
    _not_implemented()
