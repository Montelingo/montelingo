from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.domain import UserAccount
from app.modules.users.repository import SqlAlchemyUserRepository, UserRepository

from .models import AuthSession


class AuthRepository(Protocol):
    async def get_user_by_email(self, email: str) -> UserAccount | None: ...
    async def get_user_by_id(self, user_id: UUID) -> UserAccount | None: ...
    async def update_password(self, user_id: UUID, password_hash: str) -> None: ...
    async def get_session(self, token_hash: bytes) -> AuthSession | None: ...
    async def create_session(
        self, *, user_id: UUID, token_hash: bytes, expires_at: datetime, last_seen_at: datetime
    ) -> None: ...
    async def delete_session(self, token_hash: bytes) -> None: ...


class SqlAlchemyAuthRepository:
    def __init__(
        self, session: AsyncSession, users: UserRepository | None = None
    ) -> None:
        self.session = session
        self.users = users or SqlAlchemyUserRepository(session)

    async def get_user_by_email(self, email: str) -> UserAccount | None:
        return await self.users.get_by_email(email)

    async def get_user_by_id(self, user_id: UUID) -> UserAccount | None:
        return await self.users.get_by_id(user_id)

    async def update_password(self, user_id: UUID, password_hash: str) -> None:
        await self.users.update_password(user_id, password_hash)

    async def get_session(self, token_hash: bytes) -> AuthSession | None:
        return await self.session.scalar(
            select(AuthSession).where(AuthSession.token_hash == token_hash)
        )

    async def create_session(
        self, *, user_id: UUID, token_hash: bytes, expires_at: datetime, last_seen_at: datetime
    ) -> None:
        self.session.add(
            AuthSession(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=expires_at,
                last_seen_at=last_seen_at,
            )
        )

    async def delete_session(self, token_hash: bytes) -> None:
        await self.session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))
