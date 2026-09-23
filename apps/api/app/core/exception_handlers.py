from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import ApiError, ErrorCode
from app.core.request_id import get_request_id
from app.schemas.common import ErrorBody, ErrorDetail, ErrorEnvelope

logger = logging.getLogger("montelingo.api")


def _error_response(
    request: Request,
    *,
    code: str,
    message: str,
    status_code: int,
    details: Any = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", get_request_id(request))
    payload = ErrorEnvelope(
        error=ErrorBody(
            code=code,
            message=message,
            request_id=request_id,
            details=details if details is not None else None,
        )
    )
    logger.warning(
        "api_error status_code=%s code=%s request_id=%s message=%s",
        status_code,
        code,
        request_id,
        message,
    )
    response = JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))
    response.headers["X-Request-Id"] = request_id
    return response


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return _error_response(
            request,
            code=exc.stable_code,
            message=exc.message,
            status_code=exc.status_code,
            details=exc.details,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = []
        for error in exc.errors():
            loc = ".".join(str(part) for part in error.get("loc", ()) if str(part) != "body")
            details.append(
                ErrorDetail(
                    field=loc or None,
                    code="validation_error",
                    message=error.get("msg", "Invalid value"),
                )
            )
        return _error_response(
            request,
            code=ErrorCode.VALIDATION_ERROR.value,
            message="Request validation failed.",
            status_code=422,
            details=details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code == 404:
            return _error_response(
                request,
                code=ErrorCode.NOT_FOUND.value,
                message="Resource not found.",
                status_code=404,
            )
        if exc.status_code == 401:
            return _error_response(
                request,
                code=ErrorCode.AUTHENTICATION_ERROR.value,
                message="Authentication required.",
                status_code=401,
            )
        if exc.status_code == 403:
            return _error_response(
                request,
                code=ErrorCode.AUTHORIZATION_ERROR.value,
                message="Forbidden.",
                status_code=403,
            )
        return _error_response(
            request,
            code=ErrorCode.BAD_REQUEST.value,
            message="Bad request.",
            status_code=exc.status_code,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", get_request_id(request))
        logger.exception("unexpected_exception", extra={"request_id": request_id})
        return _error_response(
            request,
            code=ErrorCode.UNEXPECTED_ERROR.value,
            message="An unexpected error occurred.",
            status_code=500,
            details=None,
        )
