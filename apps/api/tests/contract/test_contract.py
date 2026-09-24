from __future__ import annotations

import re
from collections.abc import Iterator
from typing import Annotated, Any

import pytest
from fastapi import APIRouter, Body, FastAPI, Query
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from pydantic import Field

from app.api.responses import error_responses
from app.core.errors import ApiError, ErrorCode
from app.main import create_app
from app.schemas.common import ApiSchema, PaginatedResponse

OPERATION_ID_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")
HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}


class _Item(ApiSchema):
    name: str = Field(..., min_length=1)


def _build_contract_router() -> APIRouter:
    """Test-only routes that exercise the shared contract machinery."""
    router = APIRouter(prefix="/contract-test")

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

    return router


@pytest.fixture
def contract_client() -> Iterator[TestClient]:
    app = create_app()
    app.include_router(_build_contract_router(), prefix="/api/v1")
    with TestClient(app) as client:
        yield client


def _operations(schema: dict[str, Any]) -> Iterator[tuple[str, str, dict[str, Any]]]:
    for path, path_item in schema["paths"].items():
        for method, operation in path_item.items():
            if method in HTTP_METHODS:
                yield path, method, operation


def _api_routes(app: FastAPI) -> list[APIRoute]:
    return [route for route in app.routes if isinstance(route, APIRoute)]


# --- Shared envelope behaviour (test-only routes) ---------------------------


def test_api_error_uses_error_envelope(contract_client: TestClient) -> None:
    response = contract_client.get("/api/v1/contract-test/missing")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert error["request_id"] == response.headers["X-Request-Id"]


def test_unknown_route_uses_error_envelope(contract_client: TestClient) -> None:
    response = contract_client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_validation_error_is_normalized(contract_client: TestClient) -> None:
    response = contract_client.post("/api/v1/contract-test/items", json={"name": ""})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert isinstance(error["details"], list)
    assert error["details"][0]["field"] == "name"


def test_paginated_collection_contract(contract_client: TestClient) -> None:
    response = contract_client.get("/api/v1/contract-test/items?page_size=3")
    assert response.status_code == 200
    assert response.json()["page"] == {"next_cursor": None, "has_more": False}


# --- Production OpenAPI schema ----------------------------------------------


def test_production_router_has_no_demo_routes() -> None:
    paths = set(create_app().openapi()["paths"])
    assert paths == {"/api/v1/health/live", "/api/v1/health/ready"}


def test_every_operation_declares_an_explicit_operation_id() -> None:
    implicit = [
        f"{sorted(route.methods)} {route.path}"
        for route in _api_routes(create_app())
        if route.include_in_schema and not route.operation_id
    ]
    assert not implicit, f"Routes relying on auto-generated operation IDs: {implicit}"


def test_operation_ids_are_unique_and_follow_naming_rule() -> None:
    operation_ids = [op["operationId"] for _, _, op in _operations(create_app().openapi())]
    assert len(operation_ids) == len(set(operation_ids))
    bad = [opid for opid in operation_ids if not OPERATION_ID_PATTERN.fullmatch(opid)]
    assert not bad, f"Operation IDs must be <resource>_<action> snake_case: {bad}"


def test_every_json_response_has_a_precise_schema() -> None:
    schema = create_app().openapi()
    components = schema["components"]["schemas"]
    imprecise = []
    for path, method, operation in _operations(schema):
        for status, response in operation["responses"].items():
            json_schema = response.get("content", {}).get("application/json", {}).get("schema")
            if json_schema is None:
                if status != "204":
                    imprecise.append(f"{method.upper()} {path} {status}: no JSON schema")
                continue
            ref = json_schema.get("$ref", "")
            target = components.get(ref.rsplit("/", 1)[-1]) if ref else json_schema
            if not target or (target.get("type") == "object" and not target.get("properties")):
                imprecise.append(f"{method.upper()} {path} {status}: untyped object")
    assert not imprecise, imprecise


def test_error_responses_use_error_envelope() -> None:
    schema = create_app().openapi()
    wrong = [
        f"{method.upper()} {path} {status}"
        for path, method, operation in _operations(schema)
        for status, response in operation["responses"].items()
        if int(status) >= 400
        and response["content"]["application/json"]["schema"].get("$ref")
        != "#/components/schemas/ErrorEnvelope"
    ]
    assert not wrong, wrong
    assert "HTTPValidationError" not in schema["components"]["schemas"]


def test_readiness_failure_is_documented() -> None:
    responses = create_app().openapi()["paths"]["/api/v1/health/ready"]["get"]["responses"]
    assert "503" in responses
