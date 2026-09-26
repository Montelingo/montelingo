from __future__ import annotations

from typing import Annotated

import pytest
from fastapi import APIRouter, Body, FastAPI, Query
from fastapi.testclient import TestClient
from pydantic import Field

from app.api.responses import error_responses
from app.core.errors import ApiError, ErrorCode
from app.schemas.common import ApiSchema, PaginatedResponse


class _Item(ApiSchema):
    name: str = Field(..., min_length=1)


@pytest.fixture
def app(app: FastAPI) -> FastAPI:
    """Adds test-only routes that exercise the shared contract machinery."""
    router = APIRouter(prefix="/api/v1/contract-test")

    @router.get(
        "/items",
        operation_id="contract_test_items_list",
        response_model=PaginatedResponse[_Item],
        responses=error_responses(422),
    )
    def list_items(
        page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    ) -> PaginatedResponse[_Item]:
        return PaginatedResponse[_Item].model_validate(
            {"items": [{"name": "sample"}], "page": {"next_cursor": None, "has_more": False}}
        )

    @router.post(
        "/items",
        operation_id="contract_test_items_create",
        response_model=_Item,
        status_code=201,
        responses=error_responses(422),
    )
    def create_item(payload: Annotated[_Item, Body(...)]) -> _Item:
        return payload

    @router.get(
        "/missing",
        operation_id="contract_test_missing",
        response_model=_Item,
        responses=error_responses(404),
    )
    def missing() -> _Item:
        raise ApiError(ErrorCode.NOT_FOUND, "Item not found", status_code=404)

    app.include_router(router)
    return app


def test_api_error_uses_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/contract-test/missing")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert error["message"] == "Item not found"
    assert error["request_id"] == response.headers["X-Request-Id"]


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_validation_error_is_normalized(client: TestClient) -> None:
    response = client.post("/api/v1/contract-test/items", json={"name": ""})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert isinstance(error["details"], list)
    assert error["details"][0]["field"] == "name"


def test_paginated_collection_contract(client: TestClient) -> None:
    response = client.get("/api/v1/contract-test/items?page_size=3")
    assert response.status_code == 200
    assert response.json()["page"] == {"next_cursor": None, "has_more": False}
