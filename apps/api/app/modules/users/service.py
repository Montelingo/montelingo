from __future__ import annotations

from typing import Protocol
from uuid import UUID

from .domain import UserAccount


class UsersService(Protocol):
    async def create_user(self, *, email: str, password_hash: str) -> UserAccount: ...

    async def get_by_email(self, email: str) -> UserAccount | None: ...

    async def get_by_id(self, user_id: UUID) -> UserAccount | None: ...
