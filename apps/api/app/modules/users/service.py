from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from .domain import UserAccount
from .repository import UserRepository


class UsersService(Protocol):
    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
        consent_accepted_at: datetime,
        privacy_policy_version: str,
    ) -> UserAccount: ...

    async def get_by_email(self, email: str) -> UserAccount | None: ...

    async def get_by_id(self, user_id: UUID) -> UserAccount | None: ...


class DefaultUsersService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository

    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
        consent_accepted_at: datetime,
        privacy_policy_version: str,
    ) -> UserAccount:
        return await self.repository.create(
            email=email,
            password_hash=password_hash,
            consent_accepted_at=consent_accepted_at,
            privacy_policy_version=privacy_policy_version,
        )

    async def get_by_email(self, email: str) -> UserAccount | None:
        return await self.repository.get_by_email(email)

    async def get_by_id(self, user_id: UUID) -> UserAccount | None:
        return await self.repository.get_by_id(user_id)
