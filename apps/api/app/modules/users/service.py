from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.domain import UserAccount
from app.modules.users.repository import SqlAlchemyUserRepository


class UsersService(Protocol):
    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
    ) -> UserAccount: ...

    async def get_by_email(
        self,
        email: str,
    ) -> UserAccount | None: ...

    async def get_by_id(
        self,
        user_id: UUID,
    ) -> UserAccount | None: ...


class DefaultUsersService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repository = SqlAlchemyUserRepository(db)

    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
    ) -> UserAccount:
        return await self.repository.create(
            email=email,
            password_hash=password_hash,
        )

    async def get_by_email(
        self,
        email: str,
    ) -> UserAccount | None:
        return await self.repository.get_by_email(email)

    async def get_by_id(
        self,
        user_id: UUID,
    ) -> UserAccount | None:
        return await self.repository.get_by_id(user_id)


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    password_hash: str,
) -> UserAccount:
    """Module-level helper used by the auth service."""
    service = DefaultUsersService(db)
    return await service.create_user(
        email=email,
        password_hash=password_hash,
    )
