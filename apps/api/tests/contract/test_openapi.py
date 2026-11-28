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
        "/api/v1/words",
        "/api/v1/chapters/{chapter_id}/lesson",
        "/api/v1/chapters/{chapter_id}/games/{game_id}/result",
        "/api/v1/practice/{game_id}/result",
        "/api/v1/profile",
        "/api/v1/players",
        "/api/v1/players/{player_id}/select",
        "/api/v1/privacy-policy",
        "/api/v1/account/delete",
        "/api/v1/account/export",
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
    ("/api/v1/words", "progress_list_words", "LearnedWords", {"401", "500"}),
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

    assert set(word["required"]) == {
        "id",
        "number",
        "text",
        "note",
        "image_url",
        "image_url_512",
        "audio_url",
    }
    for field in ("image_url", "image_url_512", "audio_url"):
        assert {"type": "null"} in word["properties"][field]["anyOf"]


# The child profile contract (#117). The frontend half of #114 builds on it.
PROFILE_CONTRACT = [
    ("get", "profile_get", None, {"401", "500"}),
    ("put", "profile_update", "ProfileUpdate", {"401", "403", "422", "500"}),
]


@pytest.mark.parametrize(("method", "operation_id", "body", "errors"), PROFILE_CONTRACT)
def test_profile_contract(
    app: FastAPI, method: str, operation_id: str, body: str | None, errors: set[str]
) -> None:
    operation = app.openapi()["paths"]["/api/v1/profile"][method]

    assert operation["operationId"] == operation_id
    assert set(operation["responses"]) == {"200", *errors}
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema == {"$ref": "#/components/schemas/Profile"}
    if body is None:
        assert "requestBody" not in operation
    else:
        request = operation["requestBody"]["content"]["application/json"]["schema"]
        assert request == {"$ref": f"#/components/schemas/{body}"}


def test_profile_fields_are_required_and_nullable(app: FastAPI) -> None:
    profile = app.openapi()["components"]["schemas"]["Profile"]

    assert set(profile["required"]) == {"name", "age_band", "avatar", "is_complete"}
    for field in ("name", "age_band", "avatar"):
        assert {"type": "null"} in profile["properties"][field]["anyOf"]
    assert profile["properties"]["is_complete"]["type"] == "boolean"


def test_profile_bands_and_avatars_are_the_figma_values(app: FastAPI) -> None:
    update = app.openapi()["components"]["schemas"]["ProfileUpdate"]

    assert set(update["required"]) == {"name", "age_band", "avatar"}
    assert update["properties"]["age_band"]["enum"] == ["3-4", "5-6", "7"]
    assert update["properties"]["avatar"]["enum"] == ["fox", "bear", "bunny", "frog", "owl", "cat"]
    assert update["properties"]["name"]["maxLength"] == 30


# The phase 2 chapter contract, frozen in ADR 0006 (epic #120). Writes also document
# 403 for an untrusted Origin, and 422 because their path parameters are slugs.
CHAPTER_CONTRACT = [
    ("/api/v1/chapters/{chapter_id}/lesson", "progress_complete_lesson", {"chapter_id"}),
    (
        "/api/v1/chapters/{chapter_id}/games/{game_id}/result",
        "progress_complete_game",
        {"chapter_id", "game_id"},
    ),
]


@pytest.mark.parametrize(("path", "operation_id", "parameters"), CHAPTER_CONTRACT)
def test_chapter_contract_is_frozen(
    app: FastAPI, path: str, operation_id: str, parameters: set[str]
) -> None:
    path_item = app.openapi()["paths"][path]
    operation = path_item["post"]

    assert set(path_item) == {"post"}
    assert operation["operationId"] == operation_id
    assert operation["tags"] == ["progress"]
    assert "requestBody" not in operation
    assert {parameter["name"] for parameter in operation["parameters"]} == parameters
    assert set(operation["responses"]) == {"200", "401", "403", "404", "409", "422", "500"}
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema == {"$ref": "#/components/schemas/ChapterResult"}


def test_practice_contract_is_frozen(app: FastAPI) -> None:
    # ADR 0009: a practice game records a heart, nothing else. Like the chapter
    # routes: a session, a trusted Origin, a slug parameter, and no body.
    path_item = app.openapi()["paths"]["/api/v1/practice/{game_id}/result"]
    operation = path_item["post"]

    assert set(path_item) == {"post"}
    assert operation["operationId"] == "progress_complete_practice"
    assert operation["tags"] == ["progress"]
    assert "requestBody" not in operation
    assert {parameter["name"] for parameter in operation["parameters"]} == {"game_id"}
    assert set(operation["responses"]) == {"200", "401", "403", "404", "409", "422", "500"}
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema == {"$ref": "#/components/schemas/PracticeResult"}
    result = app.openapi()["components"]["schemas"]["PracticeResult"]
    assert result["required"] == ["heart_earned"]
    assert result["properties"]["heart_earned"]["type"] == "boolean"


def test_a_result_is_the_chapter_and_whether_it_gave_a_heart(app: FastAPI) -> None:
    result = app.openapi()["components"]["schemas"]["ChapterResult"]

    assert set(result["required"]) == {"id", "lesson", "games", "heart_earned"}
    assert result["properties"]["heart_earned"]["type"] == "boolean"


def test_progress_state_lists_chapters(app: FastAPI) -> None:
    components = app.openapi()["components"]["schemas"]
    progress = components["ProgressState"]

    assert set(progress["required"]) == {"regions", "locations", "chapters", "counts"}
    assert progress["properties"]["chapters"]["items"] == {
        "$ref": "#/components/schemas/ChapterState"
    }
    assert set(components["ChapterState"]["required"]) == {"id", "lesson", "games"}
    assert set(components["GameState"]["required"]) == {"id", "state"}


def test_progress_state_sends_the_counts(app: FastAPI) -> None:
    components = app.openapi()["components"]["schemas"]

    assert components["ProgressState"]["properties"]["counts"] == {
        "$ref": "#/components/schemas/ProgressCounts"
    }
    counts = components["ProgressCounts"]
    assert set(counts["required"]) == {"words_learned", "stickers", "stars", "hearts"}
    assert counts["properties"]["words_learned"]["type"] == "integer"
    assert counts["properties"]["stickers"]["type"] == "integer"
    assert counts["properties"]["stars"]["type"] == "integer"
    assert counts["properties"]["hearts"]["type"] == "integer"


def test_each_location_sends_its_stars(app: FastAPI) -> None:
    location = app.openapi()["components"]["schemas"]["LocationState"]

    assert set(location["required"]) == {"id", "state", "stars"}
    assert location["properties"]["stars"] == {
        "type": "integer",
        "minimum": 0,
        "maximum": 3,
        "title": "Stars",
    }


def test_chapter_states_are_the_adr_literals(app: FastAPI) -> None:
    components = app.openapi()["components"]["schemas"]

    assert components["ChapterState"]["properties"]["lesson"]["enum"] == ["todo", "done"]
    assert components["GameState"]["properties"]["id"]["enum"] == ["memory", "match"]
    assert components["GameState"]["properties"]["state"]["enum"] == [
        "locked",
        "available",
        "completed",
    ]
