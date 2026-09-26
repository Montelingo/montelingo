import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db.session import get_engine
from app.main import create_app


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    """A fresh app pointed at an unreachable database.

    Test modules that need extra, test-only routes override this fixture and
    include them on the returned app.
    """
    monkeypatch.setenv(
        "MONTELINGO_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@127.0.0.1:1/montelingo"
    )
    get_settings.cache_clear()
    get_engine.cache_clear()
    yield create_app()
    get_engine.cache_clear()
    get_settings.cache_clear()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # raise_server_exceptions=False lets tests assert on the 500 error envelope.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
