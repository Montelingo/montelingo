from typing import AsyncGenerator, Protocol
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession


class TransactionManager(Protocol):
    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[AsyncSession, None]:
        ...


class SessionTransactionManager:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[AsyncSession, None]:
        async with self._session.begin():
            yield self._session
