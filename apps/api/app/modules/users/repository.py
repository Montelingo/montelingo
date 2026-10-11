from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .domain import UserAccount
from .models import User


class UserRepository(Protocol):
    async def create(self, *, email: str, password_hash: str) -> UserAccount: ...

    async def get_by_email(self, email: str) -> UserAccount | None: ...

    async def get_by_id(self, user_id: UUID) -> UserAccount | None: ...


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _to_domain(user: User) -> UserAccount:
        return UserAccount(
            id=user.id,
            email=user.email,
            password_hash=user.password_hash,
            password_changed_at=user.password_changed_at,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    async def create(self, *, email: str, password_hash: str) -> UserAccount:
        db_user = User(email=email, password_hash=password_hash)
        self.session.add(db_user)
        await self.session.flush()
        await self.session.refresh(db_user)
        return self._to_domain(db_user)

    async def get_by_email(self, email: str) -> UserAccount | None:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        db_user = result.scalar_one_or_none()
        return self._to_domain(db_user) if db_user else None

    async def get_by_id(self, user_id: UUID) -> UserAccount | None:
        db_user = await self.session.get(User, user_id)
        return self._to_domain(db_user) if db_user else None
