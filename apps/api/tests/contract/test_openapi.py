from __future__ import annotations

import re
from collections.abc import Iterator
from typing import Any

import pytest
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
    assert set(app.openapi()["paths"]) == {
        "/api/v1/auth/sign-up",
        "/api/v1/auth/sign-in",
        "/api/v1/auth/sign-out",
        "/api/v1/auth/me",
        "/api/v1/auth/password-reset",
        "/api/v1/auth/password-reset/confirm",
        "/api/v1/health/live",
        "/api/v1/health/ready",
        "/api/v1/regions",
        "/api/v1/regions/{region_id}",
        "/api/v1/locations/{location_id}",
        "/api/v1/progress",
    }


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


def test_password_reset_request_operation_id_is_frozen(app: FastAPI) -> None:
    operation = app.openapi()["paths"]["/api/v1/auth/password-reset"]["post"]
    assert operation["operationId"] == "auth_password_reset_request"


def test_stubs_do_not_document_not_implemented(app: FastAPI) -> None:
    assert all("501" not in op["responses"] for _, _, op in _operations(app.openapi()))


# The phase 1 map contract, frozen in #58 (epic #70). Changing a row is a contract change.
# Routes with a path parameter also document 422: FastAPI adds it for any parameter, and
# declaring it keeps it on the error envelope instead of HTTPValidationError.
MAP_CONTRACT = [
    ("/api/v1/regions", "content_list_regions", "PaginatedResponse_RegionSummary_", {"401"}),
    ("/api/v1/regions/{region_id}", "content_get_region", "RegionDetail", {"401", "404", "422"}),
    (
        "/api/v1/locations/{location_id}",
        "content_get_location",
        "LocationDetail",
        {"401", "404", "422"},
    ),
    ("/api/v1/progress", "progress_get", "ProgressState", {"401", "500"}),
]


@pytest.mark.parametrize(("path", "operation_id", "model", "errors"), MAP_CONTRACT)
def test_map_contract_is_frozen(
    app: FastAPI, path: str, operation_id: str, model: str, errors: set[str]
) -> None:
    operation = app.openapi()["paths"][path]["get"]

    assert operation["operationId"] == operation_id
    assert set(operation["responses"]) == {"200", *errors}
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema == {"$ref": f"#/components/schemas/{model}"}


def test_map_states_are_the_svg_map_contract_literals(app: FastAPI) -> None:
    components = app.openapi()["components"]["schemas"]

    for name in ("RegionState", "LocationState"):
        assert components[name]["properties"]["state"]["enum"] == [
            "locked",
            "available",
            "in-progress",
            "completed",
        ]


def test_word_media_fields_are_required_and_nullable(app: FastAPI) -> None:
    word = app.openapi()["components"]["schemas"]["Word"]

    assert set(word["required"]) == {"id", "number", "text", "note", "image_url", "audio_url"}
    for field in ("image_url", "audio_url"):
        assert {"type": "null"} in word["properties"][field]["anyOf"]
