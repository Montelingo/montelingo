from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.api.responses import error_responses
from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.request_id import get_request_id
from app.modules.auth import get_current_session, require_trusted_origin
from app.modules.auth.cookies import clear_session_cookie
from app.modules.auth.rate_limit import AccountPasswordRateLimit
from app.modules.auth.service import ResolvedSession

from .dependencies import get_account_service, rate_limit_account_password
from .schemas import AccountDeleteRequest
from .service import AccountService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/delete",
    operation_id="account_delete",
    status_code=204,
    response_class=Response,
    responses=error_responses(401, 403, 422, 429),
)
async def delete_account(
    payload: AccountDeleteRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    # The session is checked before the Origin, so a request without one is a 401.
    session: ResolvedSession = Depends(get_current_session),
    _trusted_origin: None = Depends(require_trusted_origin),
    rate_limit: AccountPasswordRateLimit = Depends(rate_limit_account_password),
    service: AccountService = Depends(get_account_service),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        deleted = await service.delete_account(session, payload.password)
    except ApiError as exc:
        if exc.stable_code == ErrorCode.INVALID_PASSWORD.value:
            rate_limit.record_failure()
        raise
    # The user id and the request id, never the email (ADR 0008). A warning, so
    # it reaches the container log: the API configures no logging, and Python
    # drops INFO by default.
    logger.warning(
        "account_deleted user_id=%s request_id=%s", deleted.user_id, get_request_id(request)
    )
    # Sent after the response, so delivery neither delays nor changes it.
    background_tasks.add_task(service.send_deleted_email, deleted)
    response = Response(status_code=204)
    clear_session_cookie(response, settings)
    return response
