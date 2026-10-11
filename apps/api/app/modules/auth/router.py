from __future__ import annotations

from typing import Never

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.security import Argon2PasswordHasher, SecureToken, SystemClock
from app.db.session import get_db_session
from app.db.transaction import SessionTransactionManager
from app.modules.users.domain import UserAccount

from .repository import SqlAlchemyAuthRepository
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


def get_auth_service(
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthService:
    return AuthService(
        repository=SqlAlchemyAuthRepository(session),
        password_hasher=Argon2PasswordHasher(),
        token=SecureToken,
        clock=SystemClock(),
        transaction_manager=SessionTransactionManager(session),
        session_ttl=settings.session_ttl,
        session_refresh_threshold=settings.session_refresh_threshold,
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


def _current_user(account: UserAccount) -> CurrentUser:
    return CurrentUser(
        id=str(account.id),
        email=account.email,
        created_at=account.created_at,
    )


async def get_optional_user(
    request: Request,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> CurrentUser | None:
    cookie = request.cookies.get(settings.session_cookie_name)
    resolved = await service.resolve_session(cookie)
    if resolved is None:
        return None
    if resolved.refresh and cookie is not None:
        _set_session_cookie(response, cookie, settings)
    return _current_user(resolved.user)


async def get_current_user(
    request: Request,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    user = await get_optional_user(request, response, service, settings)
    if user is None:
        raise ApiError(ErrorCode.AUTHENTICATION_ERROR, "Authentication required.", status_code=401)
    return user


@router.post(
    "/sign-up",
    operation_id="auth_sign_up",
    response_model=CurrentUser,
    status_code=201,
    responses=error_responses(403, 409, 422, 429),
)
async def sign_up(payload: SignUpRequest) -> CurrentUser:
    _not_implemented()


@router.post(
    "/sign-in",
    operation_id="auth_sign_in",
    response_model=CurrentUser,
    responses=error_responses(401, 403, 422, 429),
)
async def sign_in(
    payload: SignInRequest,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    result = await service.sign_in(email=str(payload.email), password=payload.password)
    _set_session_cookie(response, result.token, settings)
    return _current_user(result.user)


@router.post(
    "/sign-out",
    operation_id="auth_sign_out",
    status_code=204,
    response_class=Response,
    responses=error_responses(403),
)
async def sign_out(
    request: Request,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> Response:
    await service.sign_out(request.cookies.get(settings.session_cookie_name))
    response.delete_cookie(key=settings.session_cookie_name, path="/")
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
)
async def request_password_reset(payload: PasswordResetRequest) -> Response:
    _not_implemented()


@router.post(
    "/password-reset/confirm",
    operation_id="auth_password_reset_confirm",
    status_code=204,
    response_class=Response,
    responses=error_responses(400, 403, 422),
)
async def confirm_password_reset(payload: PasswordResetConfirm) -> Response:
    _not_implemented()
