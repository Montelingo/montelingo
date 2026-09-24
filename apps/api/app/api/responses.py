from __future__ import annotations

from typing import Any

from app.schemas.common import ErrorEnvelope

_ERROR_DESCRIPTIONS: dict[int, str] = {
    400: "Bad request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Resource not found",
    409: "Conflict",
    422: "Validation failed",
    429: "Rate limited",
    500: "Unexpected server error",
    503: "Service unavailable",
}


def error_responses(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    """Document error statuses with the shared error envelope.

    Declaring 422 here also replaces FastAPI's default ``HTTPValidationError``
    schema, which does not match what the validation handler actually returns.
    """
    return {
        status_code: {
            "description": _ERROR_DESCRIPTIONS.get(status_code, "Error"),
            "model": ErrorEnvelope,
        }
        for status_code in status_codes
    }
