from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field
from pydantic.types import StringConstraints
from typing_extensions import Annotated

T = TypeVar("T")

UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"


class ErrorDetail(BaseModel):
    field: str | None = None
    code: str = "invalid_value"
    message: str = "Invalid value"


class ErrorEnvelope(BaseModel):
    error: "ErrorBody" = Field(...)


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str
    details: list[ErrorDetail] | None = None


UUIDString = Annotated[str, StringConstraints(pattern=UUID_PATTERN)]


class LocalizedText(BaseModel):
    language_code: str = Field(..., pattern=r"^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)?(?:_[A-Za-z0-9-]+)?$")
    value: str


class PageInfo(BaseModel):
    next_cursor: str | None = None
    has_more: bool = False


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    page: PageInfo
