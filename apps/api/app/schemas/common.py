from __future__ import annotations

from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from pydantic.types import StringConstraints

UUID_PATTERN = (
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-"
    r"[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
)


class ApiSchema(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)


class ErrorDetail(ApiSchema):
    field: str | None = None
    code: str = "invalid_value"
    message: str = "Invalid value"


class ErrorBody(ApiSchema):
    code: str
    message: str
    request_id: str
    details: list[ErrorDetail] | None = None


class ErrorEnvelope(ApiSchema):
    error: ErrorBody = Field(...)


UUIDString = Annotated[str, StringConstraints(pattern=UUID_PATTERN)]


class LocalizedText(ApiSchema):
    language_code: str = Field(
        ..., pattern=r"^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)?(?:_[A-Za-z0-9-]+)?$"
    )
    value: str


class PageInfo(ApiSchema):
    next_cursor: str | None = None
    has_more: bool = False


T = TypeVar("T")


class PaginatedResponse(ApiSchema, Generic[T]):
    items: list[T]
    page_info: PageInfo = Field(alias="page", default_factory=PageInfo)

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_serialization_defaults_required=True
    )
