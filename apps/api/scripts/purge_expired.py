"""Delete what we no longer need: the nightly retention job (ADR 0008, #253).

- auth_sessions that have expired. They can never be used again.
- password_reset_tokens that are used or expired.
- account_deletions older than 28 days, when no backup still holds the account.
- inactive accounts (#254): it warns them by email, and later deletes them
  through the same path as self-service deletion (app/modules/account/inactivity.py).

It prints how many rows it deleted, and nothing about whom they belonged to.
Running it again deletes nothing more. On the server, deploy/purge.sh runs it
every night.
"""

from __future__ import annotations

import asyncio
import sys
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from sqlalchemy import Delete, delete, or_
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

from app.core.config import get_settings  # noqa: E402
from app.core.security import Argon2PasswordHasher  # noqa: E402
from app.db.transaction import SessionTransactionManager  # noqa: E402
from app.infrastructure.email import EmailSender, create_email_sender  # noqa: E402
from app.modules.account.inactivity import InactiveAccounts, InactivityCounts  # noqa: E402
from app.modules.account.models import AccountDeletion  # noqa: E402
from app.modules.account.repository import SqlAlchemyAccountDeletionRepository  # noqa: E402
from app.modules.account.service import AccountService  # noqa: E402
from app.modules.auth.models import AuthSession, PasswordResetToken  # noqa: E402
from app.modules.users.repository import SqlAlchemyUserRepository  # noqa: E402

# Matches the backups: no dump outlives 28 days (ADR 0008, deploy/backup.sh).
ACCOUNT_DELETIONS_KEPT = timedelta(days=28)


@dataclass(frozen=True)
class PurgeCounts:
    sessions: int
    reset_tokens: int
    account_deletions: int


async def _delete(session: AsyncSession, statement: Delete) -> int:
    """Runs a DELETE and answers how many rows it removed."""
    result = cast(CursorResult[Any], await session.execute(statement))
    return result.rowcount


async def purge(session: AsyncSession, now: datetime) -> PurgeCounts:
    """Deletes the expired rows in one transaction."""
    transaction = session.begin_nested() if session.in_transaction() else session.begin()
    async with transaction:
        sessions = await _delete(session, delete(AuthSession).where(AuthSession.expires_at <= now))
        reset_tokens = await _delete(
            session,
            delete(PasswordResetToken).where(
                or_(PasswordResetToken.used_at.is_not(None), PasswordResetToken.expires_at <= now)
            ),
        )
        account_deletions = await _delete(
            session,
            delete(AccountDeletion).where(
                AccountDeletion.deleted_at <= now - ACCOUNT_DELETIONS_KEPT
            ),
        )
    return PurgeCounts(sessions, reset_tokens, account_deletions)


class _FixedClock:
    """One instant for the whole run, so every step agrees on what "now" is."""

    def __init__(self, now: datetime) -> None:
        self._now = now

    def now(self) -> datetime:
        return self._now


async def handle_inactive(
    session: AsyncSession, now: datetime, email_sender: EmailSender
) -> InactivityCounts:
    settings = get_settings()
    users = SqlAlchemyUserRepository(session)
    transactions = SessionTransactionManager(session)
    clock = _FixedClock(now)
    accounts = AccountService(
        users=users,
        deletions=SqlAlchemyAccountDeletionRepository(session),
        password_hasher=Argon2PasswordHasher(),
        clock=clock,
        transaction_manager=transactions,
        email_sender=email_sender,
    )
    return await InactiveAccounts(
        users=users,
        accounts=accounts,
        transaction_manager=transactions,
        email_sender=email_sender,
        clock=clock,
        warning_days=settings.inactive_warning_days,
        delete_days=settings.inactive_delete_days,
        web_base_url=settings.web_base_url,
    ).run()


SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]


async def run(
    session_factory: SessionFactory | None = None,
    now: datetime | None = None,
    email_sender: EmailSender | None = None,
) -> int:
    if session_factory is None:
        engine = create_async_engine(get_settings().database_url)
        try:
            return await run(async_sessionmaker(engine, expire_on_commit=False), now, email_sender)
        finally:
            await engine.dispose()

    moment = now or datetime.now(UTC)
    sender = email_sender or create_email_sender(get_settings())
    async with session_factory() as session:
        counts = await purge(session, moment)
        inactive = await handle_inactive(session, moment, sender)

    print(
        f"purge: sessions={counts.sessions} reset_tokens={counts.reset_tokens}"
        f" account_deletions={counts.account_deletions}"
        f" inactivity_warnings={inactive.warned} inactive_accounts_deleted={inactive.deleted}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
