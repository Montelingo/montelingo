from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .domain import UserAccount


class UserRepository(Protocol):
    async def create(self, *, email: str, password_hash: str) -> UserAccount: ...

    async def get_by_email(self, email: str) -> UserAccount | None: ...

    async def get_by_id(self, user_id: UUID) -> UserAccount | None: ...


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, *, email: str, password_hash: str) -> UserAccount:
        raise NotImplementedError

    async def get_by_email(self, email: str) -> UserAccount | None:
        raise NotImplementedError

    async def get_by_id(self, user_id: UUID) -> UserAccount | None:
        raise NotImplementedError
