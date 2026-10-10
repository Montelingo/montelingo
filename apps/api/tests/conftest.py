import os
import sys
from collections.abc import AsyncGenerator, Iterator
from pathlib import Path

import pytest
import pytest_asyncio
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    create_async_engine,
)

from alembic import command

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db.session import get_db_session, get_engine, get_session_factory
from app.main import create_app

API_DIR = Path(__file__).resolve().parents[1]
UNREACHABLE_DB_URL = "postgresql+asyncpg://postgres:postgres@127.0.0.1:1/montelingo"
TEST_DB_URL = os.getenv(
    "MONTELINGO_TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/montelingo_test",
)


def _clear_db_caches() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    """A fresh app pointed at an unreachable database.

    Unit and contract tests never touch PostgreSQL. Test modules that need
    extra, test-only routes override this fixture and include them on the
    returned app. Integration tests use `integration_app` instead.
    """
    monkeypatch.setenv("MONTELINGO_DATABASE_URL", UNREACHABLE_DB_URL)
    _clear_db_caches()
    yield create_app()
    _clear_db_caches()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # raise_server_exceptions=False lets tests assert on the 500 error envelope.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def apply_migrations() -> Iterator[None]:
    # alembic/env.py reads the URL from Settings, so point Settings at the test DB.
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("MONTELINGO_DATABASE_URL", TEST_DB_URL)
        _clear_db_caches()
        alembic_cfg = Config(str(API_DIR / "alembic.ini"))
        alembic_cfg.set_main_option("script_location", str(API_DIR / "alembic"))
        command.upgrade(alembic_cfg, "head")
    _clear_db_caches()
    yield


@pytest_asyncio.fixture(scope="session")
async def test_engine(apply_migrations: None) -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine(TEST_DB_URL)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """A session inside a transaction that is rolled back after the test.

    `create_savepoint` turns commits made by the code under test into
    savepoints, so they never escape the outer transaction.
    """
    async with test_engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest.fixture
def integration_app(db_session: AsyncSession) -> FastAPI:
    app_instance = create_app()

    async def _get_test_db_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app_instance.dependency_overrides[get_db_session] = _get_test_db_session
    return app_instance


@pytest_asyncio.fixture
async def integration_client(integration_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=integration_app), base_url="http://test"
    ) as async_client:
        yield async_client
