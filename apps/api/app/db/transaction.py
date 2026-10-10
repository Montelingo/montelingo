from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession


class TransactionManager(Protocol):
    def transaction(self) -> AbstractAsyncContextManager[AsyncSession]: ...


class SessionTransactionManager:
    """Commits on success and rolls back on error.

    Works whether or not the session already started a transaction (any read
    autobegins one), so a service can read first and then write.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[AsyncSession]:
        try:
            yield self._session
        except BaseException:
            await self._session.rollback()
            raise
        await self._session.commit()
