import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException


@pytest.fixture
def app(app: FastAPI) -> FastAPI:
    router = APIRouter(prefix="/api/v1/test-errors")

    @router.get("/status/{status_code}", include_in_schema=False)
    def raise_status(status_code: int) -> None:
        headers = {"Retry-After": "30"} if status_code == 429 else None
        raise StarletteHTTPException(status_code=status_code, headers=headers)

    @router.get("/crash", include_in_schema=False)
    def crash() -> None:
        raise RuntimeError("boom")

    app.include_router(router)
    return app


@pytest.mark.parametrize(
    ("status_code", "code"),
    [
        (400, "bad_request"),
        (401, "authentication_error"),
        (403, "authorization_error"),
        (404, "not_found"),
        (409, "bad_request"),
        (418, "bad_request"),
        (429, "rate_limited"),
        (500, "internal_server_error"),
        (502, "internal_server_error"),
        (503, "internal_server_error"),
    ],
)
def test_http_exception_maps_to_error_code(client: TestClient, status_code: int, code: str) -> None:
    response = client.get(f"/api/v1/test-errors/status/{status_code}")
    assert response.status_code == status_code
    assert response.json()["error"]["code"] == code


def test_method_not_allowed_keeps_allow_header(client: TestClient) -> None:
    response = client.post("/api/v1/health/live")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"
    assert response.headers["Allow"] == "GET"


def test_rate_limited_keeps_retry_after_header(client: TestClient) -> None:
    response = client.get("/api/v1/test-errors/status/429")
    assert response.headers["Retry-After"] == "30"


def test_unexpected_exception_uses_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/test-errors/crash")
    assert response.status_code == 500
    error = response.json()["error"]
    assert error["code"] == "internal_server_error"
    assert error["message"] == "An unexpected error occurred."
    assert error["request_id"] == response.headers["X-Request-Id"]
