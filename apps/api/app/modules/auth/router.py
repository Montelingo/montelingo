from __future__ import annotations

import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Request,
    Response,
    status,
)

from app.api.responses import error_responses
from app.core.config import Settings, get_settings
from app.infrastructure.email import (
    EmailMessage,
    EmailSender,
    get_email_sender,
)

from .dependencies import get_auth_service, get_current_user
from .schemas import (
    CurrentUser,
    PasswordResetConfirm,
    PasswordResetRequest,
    SignInRequest,
    SignUpRequest,
)
from .service import AuthService
from .templates import get_password_reset_email_content


logger = logging.getLogger(__name__)

router = APIRouter()


def _set_session_cookie(
    response: Response,
    token: str,
    settings: Settings,
) -> None:
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
)
async def sign_up(
    payload: SignUpRequest,
    service: AuthService = Depends(get_auth_service),
) -> CurrentUser:
    user = await service.sign_up(
        email=str(payload.email),
        password=payload.password,
    )

    return CurrentUser(
        id=str(user.id),
        email=user.email,
        created_at=user.created_at,
    )


@router.post(
    "/sign-in",
    operation_id="auth_sign_in",
    response_model=CurrentUser,
    responses=error_responses(401, 403, 422, 429),
)
async def sign_in(
    payload: SignInRequest,
    request: Request,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    result = await service.sign_in(
        email=str(payload.email),
        password=payload.password,
        current_cookie=request.cookies.get(settings.session_cookie_name),
    )

    _set_session_cookie(
        response,
        result.token,
        settings,
    )

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

    response.status_code = status.HTTP_204_NO_CONTENT

    return response


@router.get(
    "/me",
    operation_id="auth_me",
    response_model=CurrentUser,
    responses=error_responses(401),
)
async def me(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    return user


@router.post(
    "/password-reset",
    operation_id="auth_password_reset_request",
    status_code=204,
    response_class=Response,
    responses=error_responses(403, 422, 429),
)
async def request_password_reset(
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
    email_sender: EmailSender = Depends(get_email_sender),
) -> Response:

    raw_token = await service.request_password_reset(str(payload.email))

    if raw_token is not None:
        reset_link = f"{str(settings.web_base_url).rstrip('/')}/reset-password?token={raw_token}"

        subject, text_content, html_content = get_password_reset_email_content(
            reset_link,
            int(settings.password_reset_ttl / 60),
        )

        message = EmailMessage(
            to=str(payload.email),
            subject=subject,
            text_body=text_content,
            html_body=html_content,
        )

        # Only email delivery runs as a background task.
        async def send_reset_email() -> None:
            try:
                await email_sender.send(message)
            except Exception:
                logger.exception("password_reset_email_send_failed")

        background_tasks.add_task(send_reset_email)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/password-reset/confirm",
    operation_id="auth_password_reset_confirm",
    status_code=204,
    response_class=Response,
    responses=error_responses(400, 403, 422),
)
async def confirm_password_reset(
    payload: PasswordResetConfirm,
    service: AuthService = Depends(get_auth_service),
) -> Response:
    await service.confirm_password_reset(
        raw_token=payload.token,
        new_password=payload.new_password,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
