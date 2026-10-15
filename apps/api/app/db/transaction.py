from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession


class TransactionManager(Protocol):
    def transaction(self) -> AbstractAsyncContextManager[AsyncSession]: ...


class SessionTransactionManager:
    """Commits on success and rolls back on error.

    Works whether or not the session already started a transaction,
    including transactions started automatically by read operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[AsyncSession]:
        try:
            yield self._session
            await self._session.commit()
        except BaseException:
            await self._session.rollback()
            raise
