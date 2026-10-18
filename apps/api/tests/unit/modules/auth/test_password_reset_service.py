from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from app.core.errors import ApiError
from app.core.security import SecureToken
from app.infrastructure.email import EmailMessage, EmailSendError, InMemoryEmailSender
from app.modules.auth.service import AuthService
from app.modules.users.domain import UserAccount

from .test_service import FakeHasher, FakeTransactions

NOW = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)
TTL = 30 * 60


class MutableClock:
    def __init__(self, now: datetime) -> None:
        self.current = now

    def now(self) -> datetime:
        return self.current


@dataclass
class StoredToken:
    user_id: UUID
    expires_at: datetime
    used_at: datetime | None = None


class FakeResetRepository:
    """Holds reset tokens and sessions the way the SQL repository does."""

    def __init__(self, user: UserAccount | None) -> None:
        self.user = user
        self.tokens: dict[bytes, StoredToken] = {}
        self.sessions: dict[bytes, UUID] = {}
        self.password_updates: list[tuple[UUID, str, datetime | None]] = []

    async def get_user_by_email(self, email: str) -> UserAccount | None:
        return self.user if self.user and email == self.user.email else None

    async def replace_reset_token(
        self, *, user_id: UUID, token_hash: bytes, expires_at: datetime
    ) -> None:
        self.tokens = {
            h: t for h, t in self.tokens.items() if t.user_id != user_id or t.used_at is not None
        }
        self.tokens[token_hash] = StoredToken(user_id=user_id, expires_at=expires_at)

    async def consume_reset_token(self, token_hash: bytes, *, now: datetime) -> UUID | None:
        token = self.tokens.get(token_hash)
        if token is None or token.used_at is not None or token.expires_at <= now:
            return None
        token.used_at = now
        return token.user_id

    async def update_password(
        self, user_id: UUID, password_hash: str, *, password_changed_at: datetime | None = None
    ) -> None:
        self.password_updates.append((user_id, password_hash, password_changed_at))

    async def delete_user_sessions(self, user_id: UUID) -> None:
        self.sessions = {h: uid for h, uid in self.sessions.items() if uid != user_id}


def make_user() -> UserAccount:
    return UserAccount(
        id=uuid4(),
        email="user@example.com",
        password_hash="old-hash",
        password_changed_at=None,
        created_at=NOW,
        updated_at=NOW,
    )


class FailingEmailSender:
    async def send(self, message: EmailMessage) -> None:
        raise EmailSendError("example.com", ConnectionError("SMTP is down"))


def make_service(
    repository: FakeResetRepository,
    clock: MutableClock,
    email_sender: InMemoryEmailSender | FailingEmailSender | None = None,
) -> AuthService:
    return AuthService(
        repository=repository,  # type: ignore[arg-type]
        password_hasher=FakeHasher(),
        token=SecureToken,
        clock=clock,
        transaction_manager=FakeTransactions(),  # type: ignore[arg-type]
        password_reset_ttl=TTL,
        email_sender=email_sender or InMemoryEmailSender(),
        web_base_url="https://app.example/",
    )


async def test_request_for_unknown_email_stores_no_token() -> None:
    repository = FakeResetRepository(user=None)
    service = make_service(repository, MutableClock(NOW))

    assert await service.request_password_reset("nobody@example.com") is None
    assert repository.tokens == {}


async def test_request_normalizes_email_and_stores_only_the_token_hash() -> None:
    user = make_user()
    repository = FakeResetRepository(user)
    service = make_service(repository, MutableClock(NOW))

    issued = await service.request_password_reset(" User@Example.com ")

    assert issued is not None
    assert issued.email == user.email
    assert list(repository.tokens) == [SecureToken.hash(issued.token)]
    assert repository.tokens[SecureToken.hash(issued.token)].expires_at == NOW + timedelta(
        seconds=TTL
    )


async def test_new_request_replaces_the_previous_unused_token() -> None:
    repository = FakeResetRepository(make_user())
    service = make_service(repository, MutableClock(NOW))

    first = await service.request_password_reset("user@example.com")
    second = await service.request_password_reset("user@example.com")
    assert first is not None and second is not None

    with pytest.raises(ApiError) as error:
        await service.confirm_password_reset(token=first.token, new_password="new-password")
    assert error.value.stable_code == "invalid_reset_token"

    await service.confirm_password_reset(token=second.token, new_password="new-password")


async def test_confirm_sets_password_and_revokes_every_session() -> None:
    user = make_user()
    other_user_id = uuid4()
    repository = FakeResetRepository(user)
    repository.sessions = {b"a": user.id, b"b": user.id, b"c": other_user_id}
    service = make_service(repository, MutableClock(NOW))
    issued = await service.request_password_reset(user.email)
    assert issued is not None

    await service.confirm_password_reset(token=issued.token, new_password="new-password")

    assert repository.password_updates == [(user.id, "new-hash", NOW)]
    assert repository.sessions == {b"c": other_user_id}


async def test_used_token_is_rejected() -> None:
    repository = FakeResetRepository(make_user())
    service = make_service(repository, MutableClock(NOW))
    issued = await service.request_password_reset("user@example.com")
    assert issued is not None
    await service.confirm_password_reset(token=issued.token, new_password="new-password")

    with pytest.raises(ApiError) as error:
        await service.confirm_password_reset(token=issued.token, new_password="other-password")

    assert error.value.stable_code == "invalid_reset_token"
    assert error.value.status_code == 400
    assert len(repository.password_updates) == 1


async def test_expired_token_is_rejected() -> None:
    repository = FakeResetRepository(make_user())
    clock = MutableClock(NOW)
    service = make_service(repository, clock)
    issued = await service.request_password_reset("user@example.com")
    assert issued is not None

    clock.current = NOW + timedelta(seconds=TTL)

    with pytest.raises(ApiError) as error:
        await service.confirm_password_reset(token=issued.token, new_password="new-password")

    assert error.value.stable_code == "invalid_reset_token"
    assert repository.password_updates == []


async def test_wrong_token_is_rejected() -> None:
    repository = FakeResetRepository(make_user())
    service = make_service(repository, MutableClock(NOW))
    await service.request_password_reset("user@example.com")

    with pytest.raises(ApiError) as error:
        await service.confirm_password_reset(token="not-a-real-token", new_password="new-password")

    assert error.value.stable_code == "invalid_reset_token"
    assert repository.password_updates == []


async def test_reset_email_links_to_the_web_reset_page_and_states_the_expiry() -> None:
    sender = InMemoryEmailSender()
    service = make_service(FakeResetRepository(make_user()), MutableClock(NOW), sender)
    issued = await service.request_password_reset("user@example.com")
    assert issued is not None

    await service.send_password_reset_email(issued)

    [message] = sender.messages
    assert message.to == "user@example.com"
    assert f"https://app.example/reset-password?token={issued.token}" in message.text_body
    assert "30 minutes" in message.text_body
    assert message.html_body is not None
    assert f"https://app.example/reset-password?token={issued.token}" in message.html_body


async def test_unknown_email_sends_nothing() -> None:
    sender = InMemoryEmailSender()
    service = make_service(FakeResetRepository(user=None), MutableClock(NOW), sender)

    assert await service.request_password_reset("nobody@example.com") is None
    assert sender.messages == []


async def test_reset_email_delivery_failure_is_not_raised() -> None:
    service = make_service(
        FakeResetRepository(make_user()), MutableClock(NOW), FailingEmailSender()
    )
    issued = await service.request_password_reset("user@example.com")
    assert issued is not None

    await service.send_password_reset_email(issued)


@pytest.mark.parametrize(
    ("ttl", "copy"), [(30 * 60, "30 minutes"), (90, "2 minutes"), (45, "1 minute ")]
)
async def test_reset_email_rounds_the_expiry_up_to_whole_minutes(ttl: int, copy: str) -> None:
    sender = InMemoryEmailSender()
    service = make_service(FakeResetRepository(make_user()), MutableClock(NOW), sender)
    service.password_reset_ttl = ttl
    issued = await service.request_password_reset("user@example.com")
    assert issued is not None

    await service.send_password_reset_email(issued)

    assert copy in sender.messages[0].text_body
