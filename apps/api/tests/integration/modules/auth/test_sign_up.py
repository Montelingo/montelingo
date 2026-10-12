from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sign_up_integration_success(
    integration_client: AsyncClient,
) -> None:
    email = f"new-user-{uuid4().hex}@example.com"

    response = await integration_client.post(
        "/api/v1/auth/sign-up",
        json={
            "email": email,
            "password": "SecurePassword123!",
        },
    )

    assert response.status_code == 201
    data = response.json()

    assert data["email"] == email
    assert "id" in data
    assert isinstance(data["id"], str)


@pytest.mark.asyncio
async def test_sign_up_integration_duplicate_email(
    integration_client: AsyncClient,
) -> None:
    email = f"duplicate-{uuid4().hex}@example.com"

    payload = {
        "email": email,
        "password": "SecurePassword123!",
    }

    first_response = await integration_client.post(
        "/api/v1/auth/sign-up",
        json=payload,
    )

    assert first_response.status_code == 201

    second_response = await integration_client.post(
        "/api/v1/auth/sign-up",
        json=payload,
    )

    assert second_response.status_code == 409
    assert second_response.json()["error"]["code"] == "email_taken"


@pytest.mark.asyncio
async def test_sign_up_integration_validation_error(
    integration_client: AsyncClient,
) -> None:
    response = await integration_client.post(
        "/api/v1/auth/sign-up",
        json={
            "email": "not-an-email",
            "password": "short",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
