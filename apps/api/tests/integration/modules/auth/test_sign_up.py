from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_sign_up_integration_success(client: AsyncClient):
    response = await client.post(
        "/auth/sign-up",
        json={"email": "new.user@example.com", "password": "SecurePassword123!"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "new.user@example.com"
    assert "id" in data
    assert isinstance(data["id"], str)


@pytest.mark.anyio
async def test_sign_up_integration_duplicate_email(client: AsyncClient):
    payload = {"email": "duplicate@example.com", "password": "SecurePassword123!"}

    res1 = await client.post("/auth/sign-up", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/auth/sign-up", json=payload)
    assert res2.status_code == 409
    error_data = res2.json()
    assert error_data["error"]["code"] == "email_taken"


@pytest.mark.anyio
async def test_sign_up_integration_validation_error(client: AsyncClient):
    response = await client.post(
        "/auth/sign-up",
        json={"email": "not-an-email", "password": "short"},
    )
    assert response.status_code == 422
