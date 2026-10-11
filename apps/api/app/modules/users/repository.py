from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .domain import UserAccount
from .models import User


class UserRepository(Protocol):
    async def create(self, *, email: str, password_hash: str) -> UserAccount: ...

    async def get_by_email(self, email: str) -> UserAccount | None: ...

    async def get_by_id(self, user_id: UUID) -> UserAccount | None: ...
    async def update_password(self, user_id: UUID, password_hash: str) -> None: ...


def _account(user: User) -> UserAccount:
    return UserAccount(
        id=user.id,
        email=user.email,
        password_hash=user.password_hash,
        password_changed_at=user.password_changed_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, *, email: str, password_hash: str) -> UserAccount:
        raise NotImplementedError

    async def get_by_email(self, email: str) -> UserAccount | None:
        user = await self.session.scalar(select(User).where(func.lower(User.email) == email))
        return _account(user) if user else None

    async def get_by_id(self, user_id: UUID) -> UserAccount | None:
        user = await self.session.get(User, user_id)
        return _account(user) if user else None

    async def update_password(self, user_id: UUID, password_hash: str) -> None:
        await self.session.execute(
            update(User).where(User.id == user_id).values(password_hash=password_hash)
        )
