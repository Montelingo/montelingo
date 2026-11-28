"""Delete what we no longer need: the nightly retention job (ADR 0008, #253).

- auth_sessions that have expired. They can never be used again.
- password_reset_tokens that are used or expired.
- account_deletions older than 28 days, when no backup still holds the account.

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
from app.modules.account.models import AccountDeletion  # noqa: E402
from app.modules.auth.models import AuthSession, PasswordResetToken  # noqa: E402

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


SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]


async def run(session_factory: SessionFactory | None = None, now: datetime | None = None) -> int:
    if session_factory is None:
        engine = create_async_engine(get_settings().database_url)
        try:
            return await run(async_sessionmaker(engine, expire_on_commit=False), now)
        finally:
            await engine.dispose()

    async with session_factory() as session:
        counts = await purge(session, now or datetime.now(UTC))

    print(
        f"purge: sessions={counts.sessions} reset_tokens={counts.reset_tokens}"
        f" account_deletions={counts.account_deletions}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
