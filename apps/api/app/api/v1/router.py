from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.errors import ApiError, ErrorCode
from app.schemas.common import (
    ErrorEnvelope,
    LocalizedText,
    PageInfo,
    PaginatedResponse,
    UUIDString,
)

router = APIRouter(tags=["v1"])


class ExampleResource(BaseModel):
    id: UUIDString
    name: str = Field(..., min_length=1)
    language: LocalizedText | None = None


class ExampleCreate(BaseModel):
    name: str = Field(..., min_length=1)
    language: LocalizedText | None = None


@router.get(
    "/health",
    operation_id="health_get",
    response_model=dict,
    responses={
        200: {
            "description": "Service health check",
            "content": {"application/json": {"example": {"status": "ok"}}},
        },
        500: {"description": "Unexpected server error", "model": ErrorEnvelope},
    },
)
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/examples",
    operation_id="examples_list",
    response_model=PaginatedResponse[ExampleResource],
    responses={
        200: {"description": "Examples list"},
        400: {"description": "Bad request", "model": ErrorEnvelope},
        401: {"description": "Unauthorized", "model": ErrorEnvelope},
        422: {"description": "Validation failed", "model": ErrorEnvelope},
        500: {"description": "Unexpected server error", "model": ErrorEnvelope},
    },
)
def list_examples(
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = Query(default=None, description="Opaque pagination cursor"),
) -> PaginatedResponse[ExampleResource]:
    return PaginatedResponse[
        ExampleResource
    ].model_validate({
        "items": [{
            "id": "11111111-1111-4111-8111-111111111111",
            "name": "sample",
            "language": {"language_code": "en", "value": "sample"},
        }],
        "page": {"next_cursor": None, "has_more": False},
    })


@router.post(
    "/examples",
    operation_id="examples_create",
    response_model=ExampleResource,
    status_code=201,
    responses={
        201: {"description": "Created example"},
        400: {"description": "Bad request", "model": ErrorEnvelope},
        422: {"description": "Validation failed", "model": ErrorEnvelope},
        500: {"description": "Unexpected server error", "model": ErrorEnvelope},
    },
)
def create_example(payload: Annotated[ExampleCreate, Body(...)]) -> ExampleResource:
    if not payload.name.strip():
        raise ApiError(ErrorCode.VALIDATION_ERROR, "name is required", status_code=422)
    return ExampleResource(
        id="22222222-2222-4222-8222-222222222222",
        name=payload.name,
        language=payload.language,
    )


@router.get(
    "/not-found",
    operation_id="not_found_example",
    response_model=None,
    responses={
        404: {"description": "Resource not found", "model": ErrorEnvelope},
    },
)
def not_found_example() -> None:
    raise ApiError(ErrorCode.NOT_FOUND, "Example not found", status_code=404)
