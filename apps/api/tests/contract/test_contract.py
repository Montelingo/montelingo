from fastapi.testclient import TestClient

from app.main import app


def test_api_prefix_and_error_envelope_contract():
    client = TestClient(app)

    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"

    response = client.get("/api/v1/not-found")
    assert response.status_code == 404
    payload = response.json()
    assert "error" in payload
    assert payload["error"]["code"] == "not_found"
    assert "request_id" in payload["error"]


def test_validation_error_is_normalized():
    client = TestClient(app)
    response = client.post("/api/v1/examples", json={"name": ""})
    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["code"] == "validation_error"
    assert isinstance(payload["error"]["details"], list)


def test_paginated_collection_contract():
    client = TestClient(app)
    response = client.get("/api/v1/examples?page_size=3")
    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert "page" in payload
    assert payload["page"]["has_more"] is False
    assert payload["page"]["next_cursor"] is None


def test_openapi_has_stable_operation_ids():
    schema = app.openapi()
    operation_ids = [
        operation.get("operationId")
        for path in schema["paths"].values()
        for operation in path.values()
        if isinstance(operation, dict) and "operationId" in operation
    ]
    assert len(operation_ids) == len(set(operation_ids))
    assert all(opid for opid in operation_ids)
