from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from app.core.errors import ApiError, ErrorCode
from app.core.security import DUMMY_PASSWORD_HASH, Clock, PasswordHasher, SecureToken
from app.db.transaction import TransactionManager
from app.modules.users.domain import UserAccount

from .repository import AuthRepository

INVALID_CREDENTIALS = "Invalid email or password."


@dataclass(frozen=True, slots=True)
class SignInResult:
    user: UserAccount
    token: str


@dataclass(frozen=True, slots=True)
class ResolvedSession:
    user: UserAccount


class AuthService:
    def __init__(
        self,
        repository: AuthRepository,
        password_hasher: PasswordHasher,
        token: type[SecureToken],
        clock: Clock,
        transaction_manager: TransactionManager,
        *,
        session_ttl: int = 30 * 24 * 60 * 60,
    ) -> None:
        self.repository = repository
        self.password_hasher = password_hasher
        self.token = token
        self.clock = clock
        self.transaction_manager = transaction_manager
        self.session_ttl = session_ttl

    async def sign_up(self, *, email: str, password: str) -> UserAccount:
        normalized_email = email.strip().lower()
        async with self.transaction_manager.transaction():
            existing = await self.repository.get_user_by_email(normalized_email)
            if existing is not None:
                raise ApiError(
                    code=ErrorCode.EMAIL_TAKEN,
                    message="Email is already registered.",
                    status_code=409,
                )
            password_hash = self.password_hasher.hash(password)
            user = await self.repository.create_user(
                email=normalized_email,
                password_hash=password_hash,
            )
            return user

    async def sign_in(
        self, *, email: str, password: str, current_cookie: str | None = None
    ) -> SignInResult:
        async with self.transaction_manager.transaction():
            user = await self.repository.get_user_by_email(email.strip().lower())
            password_hash = user.password_hash if user else DUMMY_PASSWORD_HASH
            if not self.password_hasher.verify(password, password_hash) or user is None:
                raise ApiError(ErrorCode.INVALID_CREDENTIALS, INVALID_CREDENTIALS, status_code=401)
            if self.password_hasher.needs_rehash(user.password_hash):
                await self.repository.update_password(user.id, self.password_hasher.hash(password))
            now = self.clock.now()
            raw_token = self.token.generate()
            if current_cookie is not None:
                await self.repository.delete_session(self.token.hash(current_cookie))
            await self.repository.create_session(
                user_id=user.id,
                token_hash=self.token.hash(raw_token),
                expires_at=now + timedelta(seconds=self.session_ttl),
                last_seen_at=now,
            )
            return SignInResult(user=user, token=raw_token)

    async def sign_out(self, cookie: str | None) -> None:
        if cookie is None:
            return
        async with self.transaction_manager.transaction():
            await self.repository.delete_session(self.token.hash(cookie))

    async def resolve_session(self, cookie: str | None) -> ResolvedSession | None:
        if cookie is None:
            return None
        session = await self.repository.get_session(self.token.hash(cookie))
        if session is None:
            return None
        now = self.clock.now()
        if session.expires_at <= now:
            async with self.transaction_manager.transaction():
                await self.repository.delete_session(self.token.hash(cookie))
            return None
        user = await self.repository.get_user_by_id(session.user_id)
        if user is None:
            return None
        return ResolvedSession(user=user)
