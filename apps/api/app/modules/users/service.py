from __future__ import annotations

from uuid import UUID

from .domain import UserAccount
from .repository import UserRepository


class UsersService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository

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

    async def get_by_email(self, email: str) -> UserAccount | None:
        return await self.repository.get_by_email(email)

    async def get_by_id(self, user_id: UUID) -> UserAccount | None:
        return await self.repository.get_by_id(user_id)
