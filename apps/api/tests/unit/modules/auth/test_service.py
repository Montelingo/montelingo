from __future__ import annotations

import threading
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.errors import ApiError
from app.core.security import DUMMY_PASSWORD_HASH, SecureToken
from app.modules.auth.service import AuthService
from app.modules.users.domain import UserAccount

NOW = datetime(2026, 10, 11, tzinfo=UTC)


class FakeHasher:
    def __init__(self, *, valid: bool = True, rehash: bool = False) -> None:
        self.valid = valid
        self.rehash = rehash
        self.verified_hashes: list[str] = []
        self.hashed_passwords: list[str] = []
        # The thread each hash or verify ran on: Argon2 is slow, so the service
        # must run it off the event loop.
        self.threads: list[int] = []

    def hash(self, password: str) -> str:
        self.threads.append(threading.get_ident())
        self.hashed_passwords.append(password)
        return "new-hash"

    def verify(self, password: str, password_hash: str) -> bool:
        self.threads.append(threading.get_ident())
        self.verified_hashes.append(password_hash)
        return self.valid

    def needs_rehash(self, password_hash: str) -> bool:
        return self.rehash


class FakeClock:
    def now(self) -> datetime:
        return NOW


class FakeTransaction:
    def __init__(self, owner: FakeTransactions) -> None:
        self.owner = owner

    async def __aenter__(self) -> None:
        self.owner.open += 1

    async def __aexit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.owner.open -= 1


class FakeTransactions:
    def __init__(self) -> None:
        # How many transactions are open: each holds a pooled connection.
        self.open = 0

    def transaction(self) -> FakeTransaction:
        return FakeTransaction(self)


class FakeRepository:
    def __init__(self, user: UserAccount | None = None) -> None:
        self.user = user
        self.session: object | None = None
        self.deleted: list[bytes] = []
        self.updated_password: tuple[object, str] | None = None
        self.created: dict[str, object] | None = None

    async def get_user_by_email(self, email: str) -> UserAccount | None:
        return self.user if self.user and email == self.user.email else None

    async def get_user_by_id(self, user_id: object) -> UserAccount | None:
        return self.user if self.user and user_id == self.user.id else None

    async def update_password(self, user_id: object, password_hash: str) -> None:
        self.updated_password = (user_id, password_hash)

    async def get_session(self, token_hash: bytes) -> object | None:
        return self.session

    async def create_session(self, **kwargs: object) -> None:
        self.created = kwargs

    async def delete_session(self, token_hash: bytes) -> None:
        self.deleted.append(token_hash)


def make_user(password_hash: str = "password-hash") -> UserAccount:
    user_id = uuid4()
    return UserAccount(
        id=user_id,
        email="user@example.com",
        password_hash=password_hash,
        password_changed_at=None,
        created_at=NOW,
        updated_at=NOW,
    )


def make_service(repository: FakeRepository, hasher: FakeHasher) -> AuthService:
    return AuthService(
        repository=repository,
        password_hasher=hasher,
        token=SecureToken,
        clock=FakeClock(),
        transaction_manager=FakeTransactions(),
        session_ttl=3600,
    )


@pytest.mark.asyncio
async def test_sign_in_success_normalizes_email_and_creates_hashed_session() -> None:
    user = make_user()
    repository = FakeRepository(user)
    service = make_service(repository, FakeHasher())

    result = await service.sign_in(email=" User@Example.com ", password="secret")

    assert result.user == user
    assert result.token
    assert repository.created is not None
    assert repository.created["user_id"] == user.id
    assert repository.created["token_hash"] == SecureToken.hash(result.token)
    assert repository.created["expires_at"] == NOW + timedelta(seconds=3600)


@pytest.mark.asyncio
async def test_sign_in_wrong_password_raises_invalid_credentials() -> None:
    user = make_user()
    service = make_service(FakeRepository(user), FakeHasher(valid=False))

    with pytest.raises(ApiError) as error:
        await service.sign_in(email=user.email, password="wrong")

    assert error.value.stable_code == "invalid_credentials"
    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_sign_in_unknown_email_verifies_against_dummy_hash() -> None:
    hasher = FakeHasher(valid=False)
    service = make_service(FakeRepository(), hasher)

    with pytest.raises(ApiError):
        await service.sign_in(email="unknown@example.com", password="wrong")

    assert hasher.verified_hashes == [DUMMY_PASSWORD_HASH]


@pytest.mark.asyncio
async def test_sign_in_rehashes_password() -> None:
    user = make_user("old-hash")
    repository = FakeRepository(user)
    service = make_service(repository, FakeHasher(rehash=True))

    await service.sign_in(email=user.email, password="secret")

    assert repository.updated_password == (user.id, "new-hash")


@pytest.mark.asyncio
async def test_expired_session_is_deleted_and_rejected() -> None:
    user = make_user()
    repository = FakeRepository(user)
    repository.session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        expires_at=NOW - timedelta(seconds=1),
    )
    service = make_service(repository, FakeHasher())

    result = await service.resolve_session("expired-token")

    assert result is None
    assert repository.deleted == [SecureToken.hash("expired-token")]


@pytest.mark.asyncio
async def test_sign_in_verifies_and_rehashes_off_the_event_loop() -> None:
    user = make_user()
    hasher = FakeHasher(rehash=True)
    service = make_service(FakeRepository(user), hasher)

    await service.sign_in(email=user.email, password="secret")

    assert len(hasher.threads) == 2
    assert threading.get_ident() not in hasher.threads


@pytest.mark.asyncio
async def test_failed_sign_in_verifies_off_the_event_loop() -> None:
    hasher = FakeHasher(valid=False)
    service = make_service(FakeRepository(), hasher)

    with pytest.raises(ApiError):
        await service.sign_in(email="nobody@example.com", password="secret")

    assert hasher.threads
    assert threading.get_ident() not in hasher.threads


@pytest.mark.asyncio
async def test_sign_in_hashes_with_no_transaction_open() -> None:
    # A transaction holds a pooled connection: waiting for Argon2 with one open
    # would let a burst of sign-ins drain the pool.
    user = make_user()
    transactions = FakeTransactions()
    open_while_hashing: list[int] = []

    class WatchingHasher(FakeHasher):
        def hash(self, password: str) -> str:
            open_while_hashing.append(transactions.open)
            return super().hash(password)

        def verify(self, password: str, password_hash: str) -> bool:
            open_while_hashing.append(transactions.open)
            return super().verify(password, password_hash)

    service = AuthService(
        repository=FakeRepository(user),
        password_hasher=WatchingHasher(rehash=True),
        token=SecureToken,
        clock=FakeClock(),
        transaction_manager=transactions,
        session_ttl=3600,
    )

    result = await service.sign_in(email=user.email, password="secret")

    assert result.user == user
    assert open_while_hashing == [0, 0]
