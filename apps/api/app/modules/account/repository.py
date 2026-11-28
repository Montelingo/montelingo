from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .models import AccountDeletion


class AccountDeletionRepository(Protocol):
    async def record(self, user_id: UUID, *, deleted_at: datetime) -> None: ...


class SqlAlchemyAccountDeletionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record(self, user_id: UUID, *, deleted_at: datetime) -> None:
        self.session.add(AccountDeletion(user_id=user_id, deleted_at=deleted_at))
        await self.session.flush()
