from __future__ import annotations

from datetime import datetime, timedelta, timezone
import pytest
from app.modules.auth.service import AuthService
from app.modules.users.domain import UserAccount


class InMemoryEmailSender:
    def __init__(self) -> None:
        self.sent_emails: list[dict] = []

    async def send(self, *, to: str, subject: str, text: str, html: str) -> None:
        self.sent_emails.append({"to": to, "subject": subject, "text": text, "html": html})


class MockClock:
    def __init__(self, current_time: datetime) -> None:
        self.current_time = current_time

    def now(self) -> datetime:
        return self.current_time


class MockAuthRepositoryForPasswordReset:
    def __init__(self, user: UserAccount | None = None) -> None:
        self.user = user
        self.tokens: dict[str, dict] = {}
        self.sessions: dict[str, str] = {}  # token_hash -> user_id

    async def get_user_by_email(self, email: str) -> UserAccount | None:
        if self.user and self.user.email == email:
            return self.user
        return None

    async def get_user_by_id(self, user_id: str) -> UserAccount | None:
        if self.user and self.user.id == user_id:
            return self.user
        return None

    async def invalidate_user_reset_tokens(self, user_id: str) -> None:
        for t_hash in list(self.tokens.keys()):
            if self.tokens[t_hash]["user_id"] == user_id:
                self.tokens[t_hash]["is_used"] = True

    async def create_reset_token(self, *, user_id: str, token_hash: str, expires_at) -> None:
        self.tokens[token_hash] = {"user_id": user_id, "expires_at": expires_at, "is_used": False, "id": "token-id-1"}

    async def get_valid_reset_token(self, token_hash: str):
        record = self.tokens.get(token_hash)
        if record is None:
            return None
        class TokenRecord:
            def __init__(self, data):
                self.id = data["id"]
                self.user_id = data["user_id"]
                self.expires_at = data["expires_at"]
                self.is_used = data["is_used"]
        return TokenRecord(record)

    async def mark_reset_token_used(self, token_id: str) -> None:
        for t_hash, data in self.tokens.items():
            if data["id"] == token_id:
                data["is_used"] = True

    async def update_password(self, user_id: str, password_hash: str, *, password_changed_at=None) -> None:
        if self.user and self.user.id == user_id:
            self.user = UserAccount(
                id=self.user.id,
                email=self.user.email,
                password_hash=password_hash,
                password_changed_at=password_changed_at,
                created_at=self.user.created_at,
                updated_at=self.user.updated_at,
            )

    async def delete_all_user_sessions(self, user_id: str) -> None:
        self.sessions = {th: uid for th, uid in self.sessions.items() if uid != user_id}


class MockTransactionManager:
    def transaction(self):
        class DummyContext:
            async def __aenter__(self):
                return self
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass
        return DummyContext()


@pytest.mark.asyncio
async def test_request_password_reset_unknown_email(password_hasher, token_generator):
    repo = MockAuthRepositoryForPasswordReset(user=None)
    clock = MockClock(datetime.now(timezone.utc))
    service = AuthService(
        repository=repo,
        password_hasher=password_hasher,
        token=token_generator,
        clock=clock,
        transaction_manager=MockTransactionManager(),
    )

    raw_token = await service.request_password_reset("unknown@example.com")
    assert raw_token is None
    assert len(repo.tokens) == 0


@pytest.mark.asyncio
async def test_confirm_password_reset_revokes_sessions(password_hasher, token_generator):
    now_dt = datetime.now(timezone.utc)
    user = UserAccount(
        id="user-1",
        email="test@example.com",
        password_hash="old_hash",
        password_changed_at=None,
        created_at=now_dt,
        updated_at=now_dt,
    )
    repo = MockAuthRepositoryForPasswordReset(user=user)
    repo.sessions["session_hash_123"] = "user-1"

    clock = MockClock(now_dt)
    service = AuthService(
        repository=repo,
        password_hasher=password_hasher,
        token=token_generator,
        clock=clock,
        transaction_manager=MockTransactionManager(),
    )

    raw_token = await service.request_password_reset("test@example.com")
    assert raw_token is not None
    assert len(repo.sessions) == 1

    await service.confirm_password_reset(raw_token=raw_token, new_password="NewSecurePassword123!")

    assert len(repo.sessions) == 0
    assert repo.user.password_hash != "old_hash"
