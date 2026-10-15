from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.security import Argon2PasswordHasher, PasswordHasher, SecureToken, SystemClock
from app.db.session import get_db_session
from app.db.transaction import SessionTransactionManager
from app.modules.users.domain import UserAccount
from app.modules.users.repository import SqlAlchemyUserRepository
from app.modules.users.service import DefaultUsersService

from .repository import SqlAlchemyAuthRepository
from .schemas import CurrentUser
from .service import AuthService


@lru_cache
def get_password_hasher() -> PasswordHasher:
    return Argon2PasswordHasher()


@lru_cache
def get_clock() -> SystemClock:
    return SystemClock()


def get_auth_service(
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    password_hasher: PasswordHasher = Depends(get_password_hasher),
    clock: SystemClock = Depends(get_clock),
) -> AuthService:
    users_repository = SqlAlchemyUserRepository(session)

    return AuthService(
        repository=SqlAlchemyAuthRepository(session, users=users_repository),
        password_hasher=password_hasher,
        token=SecureToken,
        clock=clock,
        transaction_manager=SessionTransactionManager(session),
        users_service=DefaultUsersService(users_repository),
        session_ttl=settings.session_ttl,
    )


def _current_user(account: UserAccount) -> CurrentUser:
    return CurrentUser(id=str(account.id), email=account.email, created_at=account.created_at)


async def get_optional_user(
    request: Request,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> CurrentUser | None:
    cookie = request.cookies.get(settings.session_cookie_name)
    resolved = await service.resolve_session(cookie)
    return _current_user(resolved.user) if resolved is not None else None


async def get_current_user(
    request: Request,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    user = await get_optional_user(request, service, settings)
    if user is None:
        raise ApiError(
            ErrorCode.AUTHENTICATION_ERROR,
            "Authentication required.",
            status_code=401,
        )
    return user
