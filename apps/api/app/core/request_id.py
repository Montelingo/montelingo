from __future__ import annotations

import re
import uuid

from fastapi import Request

SAFE_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def normalize_request_id(raw_value: str | None) -> str:
    if raw_value is None:
        return str(uuid.uuid4())
    value = raw_value.strip()
    if value and SAFE_REQUEST_ID_PATTERN.fullmatch(value):
        return value
    return str(uuid.uuid4())


def get_request_id(request: Request) -> str:
    incoming = request.headers.get("X-Request-Id")
    return normalize_request_id(incoming)
