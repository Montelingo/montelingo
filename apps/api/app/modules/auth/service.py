from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.exc import IntegrityError

from app.core.errors import ApiError, ErrorCode
from app.core.security import DUMMY_PASSWORD_HASH, Clock, PasswordHasher, SecureToken
from app.db.transaction import TransactionManager
from app.modules.users.domain import UserAccount
from app.modules.users.service import UsersService

from .repository import AuthRepository

INVALID_CREDENTIALS = "Invalid email or password."
INVALID_RESET_TOKEN = "This password reset link is invalid or has expired."


@dataclass(frozen=True, slots=True)
class SignInResult:
    user: UserAccount
    token: str


@dataclass(frozen=True, slots=True)
class ResolvedSession:
    user: UserAccount


@dataclass(frozen=True, slots=True)
class PasswordResetIssued:
    email: str
    token: str


class AuthService:
    def __init__(
        self,
        repository: AuthRepository,
        password_hasher: PasswordHasher,
        token: type[SecureToken],
        clock: Clock,
        transaction_manager: TransactionManager,
        *,
        users_service: UsersService | None = None,
        session_ttl: int = 30 * 24 * 60 * 60,
        password_reset_ttl: int = 30 * 60,
    ) -> None:
        self.repository = repository
        self.password_hasher = password_hasher
        self.token = token
        self.clock = clock
        self.transaction_manager = transaction_manager
        self.users_service = users_service
        self.session_ttl = session_ttl
        self.password_reset_ttl = password_reset_ttl

    async def sign_up(self, *, email: str, password: str) -> UserAccount:
        if self.users_service is None:
            raise RuntimeError("UsersService is not configured.")

        normalized_email = email.strip().lower()

        if password == normalized_email:
            raise ApiError(
                ErrorCode.VALIDATION_ERROR, "Password must not equal email.", status_code=422
            )

        if not 8 <= len(password) <= 128:
            raise ApiError(
                ErrorCode.VALIDATION_ERROR,
                "Password must contain between 8 and 128 characters.",
                status_code=422,
            )

        password_hash = self.password_hasher.hash(password)

        try:
            async with self.transaction_manager.transaction():
                existing_user = await self.users_service.get_by_email(normalized_email)
                if existing_user is not None:
                    raise ApiError(ErrorCode.EMAIL_TAKEN, "Email already exists.", status_code=409)

                user = await self.users_service.create_user(
                    email=normalized_email,
                    password_hash=password_hash,
                )

            return user

        except IntegrityError as exc:
            original = exc.orig
            cause = getattr(original, "__cause__", None)

            sqlstate = getattr(original, "sqlstate", None)
            constraint_name = getattr(cause, "constraint_name", None)

            if sqlstate == "23505" and constraint_name == "uq_users_email_lower":
                raise ApiError(
                    ErrorCode.EMAIL_TAKEN,
                    "Email already exists.",
                    status_code=409,
                ) from exc

            raise

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

    async def request_password_reset(self, email: str) -> PasswordResetIssued | None:
        """Issues a reset token for an existing user, replacing earlier unused ones.

        Returns None for an unknown email, and the caller answers the same way.
        """
        async with self.transaction_manager.transaction():
            user = await self.repository.get_user_by_email(email.strip().lower())
            if user is None:
                return None

            raw_token = self.token.generate()
            await self.repository.replace_reset_token(
                user_id=user.id,
                token_hash=self.token.hash(raw_token),
                expires_at=self.clock.now() + timedelta(seconds=self.password_reset_ttl),
            )
            return PasswordResetIssued(email=user.email, token=raw_token)

    async def confirm_password_reset(self, *, token: str, new_password: str) -> None:
        """Consumes the token, sets the new password and revokes every session, atomically.

        Does not sign the user in.
        """
        async with self.transaction_manager.transaction():
            now = self.clock.now()
            user_id = await self.repository.consume_reset_token(self.token.hash(token), now=now)
            if user_id is None:
                raise ApiError(ErrorCode.INVALID_RESET_TOKEN, INVALID_RESET_TOKEN, status_code=400)

            await self.repository.update_password(
                user_id, self.password_hasher.hash(new_password), password_changed_at=now
            )
            await self.repository.delete_user_sessions(user_id)
