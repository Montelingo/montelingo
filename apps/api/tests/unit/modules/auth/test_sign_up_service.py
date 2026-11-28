from __future__ import annotations

import threading
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.core.errors import ApiError
from app.core.security import SecureToken
from app.modules.auth.service import AuthService
from app.modules.progress.models import LearningProfile
from app.modules.users.domain import UserAccount
from app.modules.users.privacy import PRIVACY_POLICY_VERSION

from .test_service import FakeClock, FakeHasher, FakeRepository, FakeTransactions

NOW = datetime(2026, 10, 11, tzinfo=UTC)


class FakeUsersService:
    def __init__(self, existing: UserAccount | None = None) -> None:
        self.existing = existing
        self.created_email: str | None = None
        self.created_hash: str | None = None
        self.created_consent_at: datetime | None = None
        self.created_policy_version: str | None = None

    async def get_by_email(self, email: str) -> UserAccount | None:
        return self.existing

    async def get_by_id(self, user_id: object) -> UserAccount | None:
        return self.existing

    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
        consent_accepted_at: datetime,
        privacy_policy_version: str,
    ) -> UserAccount:
        self.created_email = email
        self.created_hash = password_hash
        self.created_consent_at = consent_accepted_at
        self.created_policy_version = privacy_policy_version
        return UserAccount(
            id=uuid4(),
            email=email,
            password_hash=password_hash,
            password_changed_at=None,
            created_at=NOW,
            updated_at=NOW,
            consent_accepted_at=consent_accepted_at,
            privacy_policy_version=privacy_policy_version,
        )


class FakeLearningProfileRepository:
    def __init__(self) -> None:
        self.created_user_id: UUID | None = None

    async def create_for_user(self, user_id: UUID) -> LearningProfile:
        self.created_user_id = user_id
        return LearningProfile(user_id=user_id)


def make_sign_up_service(
    users: FakeUsersService,
    hasher: FakeHasher | None = None,
    profiles: FakeLearningProfileRepository | None = None,
) -> tuple[AuthService, FakeHasher]:
    password_hasher = hasher or FakeHasher()
    profile_repository = profiles or FakeLearningProfileRepository()
    service = AuthService(
        repository=FakeRepository(),
        password_hasher=password_hasher,
        token=SecureToken,
        clock=FakeClock(),
        transaction_manager=FakeTransactions(),
        users_service=users,
        learning_profile_repository=profile_repository,
    )
    return service, password_hasher


@pytest.mark.asyncio
async def test_sign_up_hashes_off_the_event_loop() -> None:
    service, hasher = make_sign_up_service(FakeUsersService())

    await service.sign_up(
        email="user@example.com",
        password="password123",
        privacy_policy_version=PRIVACY_POLICY_VERSION,
    )

    assert hasher.threads
    assert threading.get_ident() not in hasher.threads


@pytest.mark.asyncio
async def test_sign_up_success() -> None:
    users = FakeUsersService()
    profiles = FakeLearningProfileRepository()
    service, hasher = make_sign_up_service(users, profiles=profiles)

    user = await service.sign_up(
        email="user@example.com",
        password="password123",
        privacy_policy_version=PRIVACY_POLICY_VERSION,
    )

    assert user.email == "user@example.com"
    assert users.created_email == "user@example.com"
    assert users.created_hash == "new-hash"
    assert hasher.hashed_passwords == ["password123"]
    assert profiles.created_user_id == user.id


@pytest.mark.asyncio
async def test_sign_up_normalizes_email() -> None:
    users = FakeUsersService()
    service, _ = make_sign_up_service(users)

    user = await service.sign_up(
        email="  USER@Example.COM  ",
        password="password123",
        privacy_policy_version=PRIVACY_POLICY_VERSION,
    )

    assert user.email == "user@example.com"
    assert users.created_email == "user@example.com"


@pytest.mark.asyncio
async def test_sign_up_duplicate_email_returns_409() -> None:
    existing = UserAccount(
        id=uuid4(),
        email="user@example.com",
        password_hash="existing-hash",
        password_changed_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    users = FakeUsersService(existing=existing)
    service, _ = make_sign_up_service(users)

    with pytest.raises(ApiError) as error:
        await service.sign_up(
            email="user@example.com",
            password="password123",
            privacy_policy_version=PRIVACY_POLICY_VERSION,
        )

    assert error.value.status_code == 409
    assert error.value.stable_code == "email_taken"
    assert users.created_email is None


@pytest.mark.asyncio
@pytest.mark.parametrize("password", ["short", "x" * 129])
async def test_sign_up_rejects_invalid_password_length(password: str) -> None:
    users = FakeUsersService()
    service, _ = make_sign_up_service(users)

    with pytest.raises(ApiError) as error:
        await service.sign_up(
            email="user@example.com",
            password=password,
            privacy_policy_version=PRIVACY_POLICY_VERSION,
        )

    assert error.value.status_code == 422
    assert error.value.stable_code == "validation_error"
    assert users.created_email is None


@pytest.mark.asyncio
async def test_sign_up_rejects_password_equal_to_email() -> None:
    users = FakeUsersService()
    service, _ = make_sign_up_service(users)

    with pytest.raises(ApiError) as error:
        await service.sign_up(
            email="USER@example.com",
            password="user@example.com",
            privacy_policy_version=PRIVACY_POLICY_VERSION,
        )

    assert error.value.status_code == 422
    assert error.value.stable_code == "validation_error"
    assert users.created_email is None


@pytest.mark.asyncio
async def test_sign_up_records_consent_with_the_server_clock() -> None:
    users = FakeUsersService()
    service, _ = make_sign_up_service(users)

    user = await service.sign_up(
        email="user@example.com",
        password="password123",
        privacy_policy_version=PRIVACY_POLICY_VERSION,
    )

    # FakeClock is the server's clock: the time is never taken from the request.
    assert users.created_consent_at == NOW
    assert users.created_policy_version == PRIVACY_POLICY_VERSION
    assert user.consent_accepted_at == NOW
    assert user.privacy_policy_version == PRIVACY_POLICY_VERSION


@pytest.mark.asyncio
@pytest.mark.parametrize("version", ["2020-01-01", "2999-12-31", "", "2026-12-1"])
async def test_sign_up_with_an_outdated_policy_version_returns_409(version: str) -> None:
    users = FakeUsersService()
    service, hasher = make_sign_up_service(users)

    with pytest.raises(ApiError) as error:
        await service.sign_up(
            email="user@example.com", password="password123", privacy_policy_version=version
        )

    assert error.value.status_code == 409
    assert error.value.stable_code == "privacy_policy_outdated"
    assert users.created_email is None
    # Checked before the password is hashed, so a stale page costs no Argon2 run.
    assert hasher.hashed_passwords == []
