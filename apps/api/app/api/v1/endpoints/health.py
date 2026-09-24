from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.core.errors import ApiError, ErrorCode
from app.db.session import get_db_session
from app.schemas.health import LiveHealth, ReadyHealth

router = APIRouter()


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
async def ready(db: AsyncSession = Depends(get_db_session)) -> ReadyHealth:
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        # Any failure to reach the database means "not ready"; fail safe.
        raise ApiError(
            ErrorCode.SERVICE_UNAVAILABLE,
            "Service is not ready.",
            status_code=503,
        ) from exc
    return ReadyHealth()
