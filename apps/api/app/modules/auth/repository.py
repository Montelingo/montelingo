from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.domain import UserAccount
from app.modules.users.repository import (
    SqlAlchemyUserRepository,
    UserRepository,
)

from .models import AuthSession, PasswordResetToken


class AuthRepository(Protocol):
    async def get_user_by_email(
        self,
        email: str,
    ) -> UserAccount | None: ...

    async def get_user_by_id(
        self,
        user_id: UUID,
    ) -> UserAccount | None: ...

    async def update_password(
        self,
        user_id: UUID,
        password_hash: str,
        *,
        password_changed_at: datetime | None = None,
    ) -> None: ...

    async def get_session(
        self,
        token_hash: bytes,
    ) -> AuthSession | None: ...

    async def create_session(
        self,
        *,
        user_id: UUID,
        token_hash: bytes,
        expires_at: datetime,
        last_seen_at: datetime,
    ) -> None: ...

    async def delete_session(
        self,
        token_hash: bytes,
    ) -> None: ...

    async def invalidate_user_reset_tokens(
        self,
        user_id: UUID,
    ) -> None: ...

    async def create_reset_token(
        self,
        user_id: UUID,
        token_hash: bytes,
        expires_at: datetime,
    ) -> None: ...

    async def get_valid_reset_token(
        self,
        token_hash: bytes,
    ) -> PasswordResetToken | None: ...

    async def mark_reset_token_used(
        self,
        token_id: UUID,
    ) -> None: ...

    async def delete_all_user_sessions(
        self,
        user_id: UUID,
    ) -> None: ...


class SqlAlchemyAuthRepository:
    def __init__(
        self,
        session: AsyncSession,
        users: UserRepository | None = None,
    ) -> None:
        self.session = session
        self.users = users if users is not None else SqlAlchemyUserRepository(session)

    async def get_user_by_email(
        self,
        email: str,
    ) -> UserAccount | None:
        return await self.users.get_by_email(email)

    async def get_user_by_id(
        self,
        user_id: UUID,
    ) -> UserAccount | None:
        return await self.users.get_by_id(user_id)

    async def update_password(
        self,
        user_id: UUID,
        password_hash: str,
        *,
        password_changed_at: datetime | None = None,
    ) -> None:
        await self.users.update_password(
            user_id,
            password_hash,
            password_changed_at=password_changed_at,
        )

    async def get_session(
        self,
        token_hash: bytes,
    ) -> AuthSession | None:
        return await self.session.scalar(
            select(AuthSession).where(AuthSession.token_hash == token_hash)
        )

    async def create_session(
        self,
        *,
        user_id: UUID,
        token_hash: bytes,
        expires_at: datetime,
        last_seen_at: datetime,
    ) -> None:
        self.session.add(
            AuthSession(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=expires_at,
                last_seen_at=last_seen_at,
            )
        )

    async def delete_session(
        self,
        token_hash: bytes,
    ) -> None:
        await self.session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))

    async def invalidate_user_reset_tokens(
        self,
        user_id: UUID,
    ) -> None:
        stmt = (
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=datetime.now(timezone.utc))
        )

        await self.session.execute(stmt)

    async def create_reset_token(
        self,
        user_id: UUID,
        token_hash: bytes,
        expires_at: datetime,
    ) -> None:
        self.session.add(
            PasswordResetToken(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=expires_at,
                created_at=datetime.now(timezone.utc),
            )
        )

    async def get_valid_reset_token(
        self,
        token_hash: bytes,
    ) -> PasswordResetToken | None:
        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
        )

        return await self.session.scalar(stmt)

    async def mark_reset_token_used(
        self,
        token_id: UUID,
    ) -> None:
        stmt = (
            update(PasswordResetToken)
            .where(PasswordResetToken.id == token_id)
            .values(used_at=datetime.now(timezone.utc))
        )

        await self.session.execute(stmt)

    async def delete_all_user_sessions(
        self,
        user_id: UUID,
    ) -> None:
        stmt = delete(AuthSession).where(AuthSession.user_id == user_id)

        await self.session.execute(stmt)
