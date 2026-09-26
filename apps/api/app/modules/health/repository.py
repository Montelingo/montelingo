from __future__ import annotations

from typing import Protocol

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class DatabaseProbe(Protocol):
    async def ping(self) -> None: ...


class SqlAlchemyDatabaseProbe:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ping(self) -> None:
        await self.session.execute(text("SELECT 1"))
