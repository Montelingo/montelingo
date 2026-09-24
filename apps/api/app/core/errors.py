from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "validation_error"
    AUTHENTICATION_ERROR = "authentication_error"
    AUTHORIZATION_ERROR = "authorization_error"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    RATE_LIMITED = "rate_limited"
    UNEXPECTED_ERROR = "internal_server_error"
    BAD_REQUEST = "bad_request"


@dataclass
class ApiError(Exception):
    code: ErrorCode | str
    message: str
    status_code: int = 400
    details: Any | None = None

    @property
    def stable_code(self) -> str:
        return self.code.value if isinstance(self.code, ErrorCode) else str(self.code)

    def __str__(self) -> str:
        return self.message
