from __future__ import annotations

import re
from collections.abc import Iterator
from typing import Any

from fastapi import FastAPI
from fastapi.routing import APIRoute

OPERATION_ID_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")
HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}


def _operations(schema: dict[str, Any]) -> Iterator[tuple[str, str, dict[str, Any]]]:
    for path, path_item in schema["paths"].items():
        for method, operation in path_item.items():
            if method in HTTP_METHODS:
                yield path, method, operation


def test_production_router_has_no_demo_routes(app: FastAPI) -> None:
    assert set(app.openapi()["paths"]) == {"/api/v1/health/live", "/api/v1/health/ready"}


def test_every_operation_declares_an_explicit_operation_id(app: FastAPI) -> None:
    implicit = [
        f"{sorted(route.methods)} {route.path}"
        for route in app.routes
        if isinstance(route, APIRoute) and route.include_in_schema and not route.operation_id
    ]
    assert not implicit, f"Routes relying on auto-generated operation IDs: {implicit}"


def test_operation_ids_are_unique_and_follow_naming_rule(app: FastAPI) -> None:
    operation_ids = [op["operationId"] for _, _, op in _operations(app.openapi())]
    assert len(operation_ids) == len(set(operation_ids))
    bad = [opid for opid in operation_ids if not OPERATION_ID_PATTERN.fullmatch(opid)]
    assert not bad, f"Operation IDs must be <resource>_<action> snake_case: {bad}"


def test_every_json_response_has_a_precise_schema(app: FastAPI) -> None:
    schema = app.openapi()
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


def test_error_responses_use_error_envelope(app: FastAPI) -> None:
    schema = app.openapi()
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


def test_readiness_failure_is_documented(app: FastAPI) -> None:
    responses = app.openapi()["paths"]["/api/v1/health/ready"]["get"]["responses"]
    assert "503" in responses
