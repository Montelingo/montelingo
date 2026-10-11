
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.core.errors import ApiError, ErrorCode
from app.modules.auth.service import AuthService
from app.modules.users.domain import UserAccount
from app.modules.users.service import UsersService


class MockClock:
    def __init__(self, current_time: datetime) -> None:
        self.current_time = current_time

    def now(self) -> datetime:
        return self.current_time


@pytest.fixture
def clock() -> MockClock:
    return MockClock(datetime.now(UTC))


class MockUserRepository:
    def __init__(
        self,
        existing_user: UserAccount | None = None,
    ) -> None:
        self.existing_user = existing_user
        self.created_users: list[dict[str, str]] = []

    async def create(
        self,
        *,
        email: str,
        password_hash: str,
    ) -> UserAccount:
        now = datetime.now(UTC)

        user = UserAccount(
            id=uuid4(),
            email=email,
            password_hash=password_hash,
            password_changed_at=None,
            created_at=now,
            updated_at=now,
        )

        self.created_users.append(
            {
                "email": email,
                "password_hash": password_hash,
            }
        )

        return user

    async def get_by_email(
        self,
        email: str,
    ) -> UserAccount | None:
        if (
            self.existing_user is not None
            and self.existing_user.email == email
        ):
            return self.existing_user

        return None

    async def get_by_id(
        self,
        user_id: UUID,
    ) -> UserAccount | None:
        if (
            self.existing_user is not None
            and self.existing_user.id == user_id
        ):
            return self.existing_user

        return None


class MockTransactionManager:
    @asynccontextmanager
    async def transaction(self) -> Any:
        yield


@pytest.mark.asyncio
async def test_sign_up_success(
    password_hasher: Any,
    clock: MockClock,
    token_generator: Any,
) -> None:
    users_repository = MockUserRepository()
    users_service = UsersService(users_repository)

    service = AuthService(
        repository=users_repository,
        password_hasher=password_hasher,
        token=token_generator,
        clock=clock,
        transaction_manager=MockTransactionManager(),
        users_service=users_service,
    )

    user = await service.sign_up(
        email="Test.User@Example.com",
        password="SecurePassword123!",
    )

    assert user.email == "test.user@example.com"
    assert len(users_repository.created_users) == 1

    created = users_repository.created_users[0]

    assert created["email"] == "test.user@example.com"
    assert created["password_hash"] != "SecurePassword123!"
    assert password_hasher.verify(
        "SecurePassword123!",
        created["password_hash"],
    )


@pytest.mark.asyncio
async def test_sign_up_duplicate_email(
    password_hasher: Any,
    clock: MockClock,
    token_generator: Any,
) -> None:
    now = datetime.now(UTC)

    existing = UserAccount(
        id=uuid4(),
        email="test@example.com",
        password_hash="hash",
        password_changed_at=None,
        created_at=now,
        updated_at=now,
    )

    users_repository = MockUserRepository(existing_user=existing)
    users_service = UsersService(users_repository)

    service = AuthService(
        repository=users_repository,
        password_hasher=password_hasher,
        token=token_generator,
        clock=clock,
        transaction_manager=MockTransactionManager(),
        users_service=users_service,
    )

    with pytest.raises(ApiError) as exc_info:
        await service.sign_up(
            email="TEST@example.com",
            password="SecurePassword123!",
        )

    assert exc_info.value.code == ErrorCode.EMAIL_TAKEN
    assert exc_info.value.status_code == 409
    assert users_repository.created_users == []
