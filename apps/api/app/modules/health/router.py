from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.core.errors import ApiError, ErrorCode
from app.db.session import get_db_session

from .repository import SqlAlchemyDatabaseProbe
from .schemas import LiveHealth, ReadyHealth
from .service import HealthService

router = APIRouter()


def get_health_service(session: AsyncSession = Depends(get_db_session)) -> HealthService:
    return HealthService(database=SqlAlchemyDatabaseProbe(session))


@router.get(
    "/live",
    operation_id="health_live",
    summary="Liveness probe",
    response_model=LiveHealth,
    responses=error_responses(500),
)
async def live() -> LiveHealth:
    return LiveHealth()


@router.get(
    "/ready",
    operation_id="health_ready",
    summary="Readiness probe",
    response_model=ReadyHealth,
    responses=error_responses(500, 503),
)
async def ready(service: HealthService = Depends(get_health_service)) -> ReadyHealth:
    if not await service.is_ready():
        raise ApiError(ErrorCode.SERVICE_UNAVAILABLE, "Service is not ready.", status_code=503)
    return ReadyHealth()
