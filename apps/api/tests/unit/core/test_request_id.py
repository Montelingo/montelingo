import uuid

import pytest
from fastapi.testclient import TestClient


def test_incoming_request_id_is_echoed_in_error_body_and_header(client: TestClient) -> None:
    response = client.get("/api/v1/missing", headers={"X-Request-Id": "req-123"})
    assert response.headers["X-Request-Id"] == "req-123"
    assert response.json()["error"]["request_id"] == "req-123"


def test_unsafe_request_id_is_replaced(client: TestClient) -> None:
    response = client.get("/api/v1/health/live", headers={"X-Request-Id": "bad id!"})
    assert response.headers["X-Request-Id"] != "bad id!"
    uuid.UUID(response.headers["X-Request-Id"])


def test_request_id_is_resolved_once_per_request(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    generated: list[uuid.UUID] = []
    real_uuid4 = uuid.uuid4

    def counting_uuid4() -> uuid.UUID:
        value = real_uuid4()
        generated.append(value)
        return value

    monkeypatch.setattr("app.core.request_id.uuid.uuid4", counting_uuid4)

    response = client.get("/api/v1/missing")

    assert response.status_code == 404
    assert len(generated) == 1
    assert response.json()["error"]["request_id"] == str(generated[0])
    assert response.headers["X-Request-Id"] == str(generated[0])
