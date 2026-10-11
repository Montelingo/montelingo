from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.domain import UserAccount
from app.modules.users.models import User

from .models import AuthSession


class AuthRepository(Protocol):
    async def get_user_by_email(self, email: str) -> UserAccount | None: ...
    async def get_user_by_id(self, user_id: UUID) -> UserAccount | None: ...
    async def update_password(self, user_id: UUID, password_hash: str) -> None: ...
    async def get_session(self, token_hash: bytes) -> AuthSession | None: ...
    async def create_session(
        self, *, user_id: UUID, token_hash: bytes, expires_at: datetime, last_seen_at: datetime
    ) -> None: ...
    async def refresh_session(
        self, session_id: UUID, *, expires_at: datetime, last_seen_at: datetime
    ) -> None: ...
    async def delete_session(self, token_hash: bytes) -> None: ...


def _account(user: User) -> UserAccount:
    return UserAccount(
        id=user.id,
        email=user.email,
        password_hash=user.password_hash,
        password_changed_at=user.password_changed_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


class SqlAlchemyAuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user_by_email(self, email: str) -> UserAccount | None:
        user = await self.session.scalar(select(User).where(func.lower(User.email) == email))
        return _account(user) if user else None

    async def get_user_by_id(self, user_id: UUID) -> UserAccount | None:
        user = await self.session.get(User, user_id)
        return _account(user) if user else None

    async def update_password(self, user_id: UUID, password_hash: str) -> None:
        await self.session.execute(
            update(User).where(User.id == user_id).values(password_hash=password_hash)
        )

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

    async def refresh_session(
        self, session_id: UUID, *, expires_at: datetime, last_seen_at: datetime
    ) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.id == session_id)
            .values(expires_at=expires_at, last_seen_at=last_seen_at)
        )

    async def delete_session(self, token_hash: bytes) -> None:
        await self.session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))
