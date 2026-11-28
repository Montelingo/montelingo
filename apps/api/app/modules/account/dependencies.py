from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import PasswordHasher, SystemClock
from app.db.session import get_db_session
from app.db.transaction import SessionTransactionManager
from app.infrastructure.email import EmailSender, get_email_sender
from app.modules.auth.dependencies import get_clock, get_current_session, get_password_hasher
from app.modules.auth.rate_limit import (
    AccountPasswordRateLimit,
    RateLimiter,
    account_password_rate_limit,
    get_rate_limiter,
)
from app.modules.auth.service import ResolvedSession
from app.modules.users.repository import SqlAlchemyUserRepository

from .repository import SqlAlchemyAccountDeletionRepository
from .service import AccountService


def get_account_service(
    session: AsyncSession = Depends(get_db_session),
    password_hasher: PasswordHasher = Depends(get_password_hasher),
    clock: SystemClock = Depends(get_clock),
    email_sender: EmailSender = Depends(get_email_sender),
) -> AccountService:
    return AccountService(
        users=SqlAlchemyUserRepository(session),
        deletions=SqlAlchemyAccountDeletionRepository(session),
        password_hasher=password_hasher,
        clock=clock,
        transaction_manager=SessionTransactionManager(session),
        email_sender=email_sender,
    )


def rate_limit_account_password(
    session: ResolvedSession = Depends(get_current_session),
    settings: Settings = Depends(get_settings),
    limiter: RateLimiter = Depends(get_rate_limiter),
) -> AccountPasswordRateLimit:
    return account_password_rate_limit(session.user.email, settings, limiter)
