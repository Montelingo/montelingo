from __future__ import annotations

from typing import Never

from fastapi import APIRouter, Response

from app.api.responses import error_responses
from app.core.errors import ApiError, ErrorCode

from .schemas import (
    CurrentUser,
    PasswordResetConfirm,
    PasswordResetRequest,
    SignInRequest,
    SignUpRequest,
)

router = APIRouter()


def _not_implemented() -> Never:
    raise ApiError(
        ErrorCode.NOT_IMPLEMENTED,
        "Authentication endpoint is not implemented.",
        status_code=501,
    )


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
async def sign_in(payload: SignInRequest) -> CurrentUser:
    _not_implemented()


@router.post(
    "/sign-out",
    operation_id="auth_sign_out",
    status_code=204,
    response_class=Response,
    responses=error_responses(403),
)
async def sign_out() -> Response:
    _not_implemented()


@router.get(
    "/me",
    operation_id="auth_me",
    response_model=CurrentUser,
    responses=error_responses(401),
)
async def me() -> CurrentUser:
    _not_implemented()


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
