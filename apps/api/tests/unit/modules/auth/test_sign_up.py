from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.core.errors import ApiError, ErrorCode
from app.modules.auth.service import AuthService
from app.modules.users.domain import UserAccount


class MockClock:
    def __init__(self, current_time: datetime) -> None:
        self.current_time = current_time

    def now(self) -> datetime:
        return self.current_time


@pytest.fixture
def clock() -> MockClock:
    return MockClock(datetime.now(UTC))


class MockAuthRepository:
    def __init__(
        self,
        existing_user: UserAccount | None = None,
    ) -> None:
        self.existing_user = existing_user
        self.created_users: list[dict] = []

    async def get_user_by_email(
        self,
        email: str,
    ) -> UserAccount | None:
        if self.existing_user and self.existing_user.email == email:
            return self.existing_user
        return None

    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
    ) -> UserAccount:
        now = datetime.now(UTC)

        user = UserAccount(
            id="123e4567-e89b-12d3-a456-426614174000",
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


class MockTransactionManager:
    def transaction(self):
        class DummyContext:
            async def __aenter__(self):
                return self

            async def __aexit__(
                self,
                exc_type,
                exc_val,
                exc_tb,
            ):
                return False

        return DummyContext()


@pytest.mark.asyncio
async def test_sign_up_success(
    password_hasher,
    clock,
    token_generator,
):
    repo = MockAuthRepository()

    service = AuthService(
        repository=repo,
        password_hasher=password_hasher,
        token=token_generator,
        clock=clock,
        transaction_manager=MockTransactionManager(),
    )

    user = await service.sign_up(
        email="Test.User@Example.com",
        password="SecurePassword123!",
    )

    assert user.email == "test.user@example.com"
    assert len(repo.created_users) == 1
    assert repo.created_users[0]["email"] == "test.user@example.com"
    assert repo.created_users[0]["password_hash"] != "SecurePassword123!"


@pytest.mark.asyncio
async def test_sign_up_duplicate_email(
    password_hasher,
    clock,
    token_generator,
):
    now = datetime.now(UTC)

    existing = UserAccount(
        id="123e4567-e89b-12d3-a456-426614174000",
        email="test@example.com",
        password_hash="hash",
        password_changed_at=None,
        created_at=now,
        updated_at=now,
    )

    repo = MockAuthRepository(existing_user=existing)

    service = AuthService(
        repository=repo,
        password_hasher=password_hasher,
        token=token_generator,
        clock=clock,
        transaction_manager=MockTransactionManager(),
    )

    with pytest.raises(ApiError) as exc_info:
        await service.sign_up(
            email="TEST@example.com",
            password="SecurePassword123!",
        )

    assert exc_info.value.code == ErrorCode.EMAIL_TAKEN
    assert exc_info.value.status_code == 409
    assert len(repo.created_users) == 0
