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
    async_sessionmaker,
    create_async_engine,
)

from alembic import command

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db.session import get_db_session, get_engine
from app.main import create_app

TEST_DB_URL = os.getenv(
    "MONTELINGO_TEST_DATABASE_URL",
    os.getenv(
        "MONTELINGO_DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/montelingo_test",
    ),
)


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    monkeypatch.setenv("MONTELINGO_DATABASE_URL", TEST_DB_URL)
    get_settings.cache_clear()
    get_engine.cache_clear()
    yield create_app()
    get_engine.cache_clear()
    get_settings.cache_clear()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def apply_migrations() -> None:
    api_dir = Path(__file__).resolve().parents[1]
    alembic_ini_path = api_dir / "alembic.ini"

    alembic_cfg = Config(str(alembic_ini_path))
    alembic_cfg.set_main_option("script_location", str(api_dir / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DB_URL.replace("+asyncpg", ""))
    command.upgrade(alembic_cfg, "head")


@pytest_asyncio.fixture(scope="session")
async def test_engine(apply_migrations: None) -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine(TEST_DB_URL, echo=False)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.connect() as connection:
        transaction = await connection.begin()
        session_factory = async_sessionmaker(
            bind=connection, expire_on_commit=False, class_=AsyncSession
        )
        async with session_factory() as session:
            yield session
        await transaction.rollback()


@pytest_asyncio.fixture
async def integration_app(db_session: AsyncSession) -> FastAPI:
    app_instance = create_app()

    async def _get_test_db_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app_instance.dependency_overrides[get_db_session] = _get_test_db_session
    return app_instance


@pytest_asyncio.fixture
async def integration_client(
    integration_app: FastAPI,
) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=integration_app), base_url="http://test"
    ) as async_client:
        yield async_client
