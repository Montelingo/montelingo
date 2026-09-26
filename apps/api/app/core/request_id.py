from __future__ import annotations

import re
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

REQUEST_ID_HEADER = "X-Request-Id"
SAFE_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def normalize_request_id(raw_value: str | None) -> str:
    if raw_value is None:
        return str(uuid.uuid4())
    value = raw_value.strip()
    if value and SAFE_REQUEST_ID_PATTERN.fullmatch(value):
        return value
    return str(uuid.uuid4())


def get_request_id(request: Request) -> str:
    """Return the request's ID, resolving it from the header only on first use."""
    request_id: str | None = getattr(request.state, "request_id", None)
    if request_id is None:
        request_id = normalize_request_id(request.headers.get(REQUEST_ID_HEADER))
        request.state.request_id = request_id
    return request_id


async def request_id_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_id = get_request_id(request)
    response = await call_next(request)
    response.headers[REQUEST_ID_HEADER] = request_id
    return response
