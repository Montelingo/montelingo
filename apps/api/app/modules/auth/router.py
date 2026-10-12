from __future__ import annotations

from typing import Never

from fastapi import APIRouter, Depends, Request, Response

from app.api.responses import error_responses
from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode

from .dependencies import get_auth_service, get_current_user
from .rate_limit import (
    SignInRateLimitContext,
    rate_limit_password_reset,
    rate_limit_sign_in,
    rate_limit_sign_up,
    require_trusted_origin,
)
from .schemas import (
    CurrentUser,
    PasswordResetConfirm,
    PasswordResetRequest,
    SignInRequest,
    SignUpRequest,
)
from .service import AuthService

router = APIRouter()


def _not_implemented() -> Never:
    raise ApiError(
        ErrorCode.NOT_IMPLEMENTED,
        "Authentication endpoint is not implemented.",
        status_code=501,
    )


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


@router.post(
    "/sign-up",
    operation_id="auth_sign_up",
    response_model=CurrentUser,
    status_code=201,
    responses=error_responses(403, 409, 422, 429),
    dependencies=[Depends(require_trusted_origin), Depends(rate_limit_sign_up)],
)
async def sign_up(payload: SignUpRequest) -> CurrentUser:
    _not_implemented()


@router.post(
    "/sign-in",
    operation_id="auth_sign_in",
    response_model=CurrentUser,
    responses=error_responses(401, 403, 422, 429),
    dependencies=[Depends(require_trusted_origin)],
)
async def sign_in(
    payload: SignInRequest,
    request: Request,
    response: Response,
    rate_limit: SignInRateLimitContext = Depends(rate_limit_sign_in),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    try:
        result = await service.sign_in(
            email=str(payload.email),
            password=payload.password,
            current_cookie=request.cookies.get(settings.session_cookie_name),
        )
    except ApiError as exc:
        if exc.stable_code == ErrorCode.INVALID_CREDENTIALS.value:
            rate_limit.record_failure()
        raise
    _set_session_cookie(response, result.token, settings)
    return CurrentUser(
        id=str(result.user.id),
        email=result.user.email,
        created_at=result.user.created_at,
    )


@router.post(
    "/sign-out",
    operation_id="auth_sign_out",
    status_code=204,
    response_class=Response,
    responses=error_responses(403),
    dependencies=[Depends(require_trusted_origin)],
)
async def sign_out(
    request: Request,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> Response:
    await service.sign_out(request.cookies.get(settings.session_cookie_name))
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    response.status_code = 204
    return response


@router.get(
    "/me",
    operation_id="auth_me",
    response_model=CurrentUser,
    responses=error_responses(401),
)
async def me(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return user


@router.post(
    "/password-reset",
    operation_id="auth_password_reset_request",
    status_code=204,
    response_class=Response,
    responses=error_responses(403, 422, 429),
    dependencies=[Depends(require_trusted_origin), Depends(rate_limit_password_reset)],
)
async def request_password_reset(payload: PasswordResetRequest) -> Response:
    _not_implemented()


@router.post(
    "/password-reset/confirm",
    operation_id="auth_password_reset_confirm",
    status_code=204,
    response_class=Response,
    responses=error_responses(400, 403, 422),
    dependencies=[Depends(require_trusted_origin)],
)
async def confirm_password_reset(payload: PasswordResetConfirm) -> Response:
    _not_implemented()
