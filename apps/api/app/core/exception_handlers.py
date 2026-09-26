from __future__ import annotations

import logging
from collections.abc import Mapping

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import ApiError, ErrorCode
from app.core.request_id import REQUEST_ID_HEADER, get_request_id
from app.schemas.common import ErrorBody, ErrorDetail, ErrorEnvelope

logger = logging.getLogger("montelingo.api")

# Specific 4xx statuses with their own code and message; any other 4xx is bad_request.
_HTTP_ERRORS: dict[int, tuple[ErrorCode, str]] = {
    401: (ErrorCode.AUTHENTICATION_ERROR, "Authentication required."),
    403: (ErrorCode.AUTHORIZATION_ERROR, "Forbidden."),
    404: (ErrorCode.NOT_FOUND, "Resource not found."),
    405: (ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed."),
    429: (ErrorCode.RATE_LIMITED, "Too many requests."),
}


def http_error_code(status_code: int) -> tuple[ErrorCode, str]:
    if status_code in _HTTP_ERRORS:
        return _HTTP_ERRORS[status_code]
    if status_code >= 500:
        return ErrorCode.UNEXPECTED_ERROR, "An unexpected error occurred."
    return ErrorCode.BAD_REQUEST, "Bad request."


def _error_response(
    request: Request,
    *,
    code: str,
    message: str,
    status_code: int,
    details: list[ErrorDetail] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    request_id = get_request_id(request)
    payload = ErrorEnvelope(
        error=ErrorBody(code=code, message=message, request_id=request_id, details=details)
    )
    logger.warning(
        "api_error status_code=%s code=%s request_id=%s message=%s",
        status_code,
        code,
        request_id,
        message,
    )
    response = JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json"),
        headers=dict(headers) if headers else None,
    )
    response.headers[REQUEST_ID_HEADER] = request_id
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
        code, message = http_error_code(exc.status_code)
        # Keep protocol headers such as Allow (405) and Retry-After (429).
        return _error_response(
            request,
            code=code.value,
            message=message,
            status_code=exc.status_code,
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unexpected_exception", extra={"request_id": get_request_id(request)})
        return _error_response(
            request,
            code=ErrorCode.UNEXPECTED_ERROR.value,
            message="An unexpected error occurred.",
            status_code=500,
        )
