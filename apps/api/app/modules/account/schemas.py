from __future__ import annotations

from pydantic import Field

from app.schemas.common import ApiSchema


class AccountDeleteRequest(ApiSchema):
    # Typed again: a child may be holding a signed-in tablet (ADR 0008).
    password: str = Field(min_length=1, max_length=128)
