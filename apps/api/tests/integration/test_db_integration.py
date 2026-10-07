import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.integration
async def test_readiness_probe_integration(db_session: AsyncSession):
    result = await db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1


@pytest.mark.integration
async def test_health_check_endpoint_integration(integration_client: AsyncClient):
    response = await integration_client.get("/api/v1/health")
    assert response.status_code in (200, 204)
