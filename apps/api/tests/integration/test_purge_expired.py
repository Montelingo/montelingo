"""Integration tests for the nightly retention job, scripts/purge_expired.py (#253)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import scripts.purge_expired as purge_script
from app.modules.account.models import AccountDeletion
from app.modules.auth.models import AuthSession, PasswordResetToken
from app.modules.users.models import User

pytestmark = pytest.mark.integration

NOW = datetime(2026, 12, 1, 3, 45, tzinfo=UTC)


def _borrowed(session: AsyncSession) -> purge_script.SessionFactory:
    @asynccontextmanager
    async def borrowed_session() -> AsyncIterator[AsyncSession]:
        yield session

    return borrowed_session


async def _user(db: AsyncSession) -> User:
    user = User(email=f"purge-{uuid4().hex}@example.com", password_hash="hash")
    db.add(user)
    await db.flush()
    return user


def _session(user: User, expires_at: datetime) -> AuthSession:
    return AuthSession(
        user_id=user.id,
        token_hash=uuid4().bytes,
        expires_at=expires_at,
        last_seen_at=NOW - timedelta(days=1),
    )


def _token(user: User, expires_at: datetime, used_at: datetime | None = None) -> PasswordResetToken:
    return PasswordResetToken(
        user_id=user.id, token_hash=uuid4().bytes, expires_at=expires_at, used_at=used_at
    )


async def _left(db: AsyncSession, model: type, ids: list[UUID]) -> set[UUID]:
    column = model.user_id if model is AccountDeletion else model.id  # type: ignore[attr-defined]
    return set((await db.scalars(select(column).where(column.in_(ids)))).all())


async def test_only_expired_or_used_rows_go_and_a_second_run_deletes_nothing(
    db_session: AsyncSession, capsys: pytest.CaptureFixture[str]
) -> None:
    # Clear whatever the test database already holds, so the counts below are ours.
    await purge_script.run(_borrowed(db_session), NOW)
    capsys.readouterr()

    user = await _user(db_session)
    # Read before expire_all(): an expired attribute would be loaded lazily.
    user_id = str(user.id)
    expired_session = _session(user, NOW - timedelta(seconds=1))
    expiring_now = _session(user, NOW)
    live_session = _session(user, NOW + timedelta(days=29))
    used_token = _token(user, NOW + timedelta(minutes=20), used_at=NOW - timedelta(minutes=5))
    expired_token = _token(user, NOW - timedelta(minutes=1))
    live_token = _token(user, NOW + timedelta(minutes=20))
    old_deletion = AccountDeletion(user_id=uuid4(), deleted_at=NOW - timedelta(days=28))
    recent_deletion = AccountDeletion(user_id=uuid4(), deleted_at=NOW - timedelta(days=27))
    db_session.add_all(
        [
            expired_session,
            expiring_now,
            live_session,
            used_token,
            expired_token,
            live_token,
            old_deletion,
            recent_deletion,
        ]
    )
    await db_session.flush()
    session_ids = [expired_session.id, expiring_now.id, live_session.id]
    token_ids = [used_token.id, expired_token.id, live_token.id]
    deletion_ids = [old_deletion.user_id, recent_deletion.user_id]
    live_ids = (live_session.id, live_token.id, recent_deletion.user_id)

    assert await purge_script.run(_borrowed(db_session), NOW) == 0

    db_session.expire_all()
    assert await _left(db_session, AuthSession, session_ids) == {live_ids[0]}
    assert await _left(db_session, PasswordResetToken, token_ids) == {live_ids[1]}
    assert await _left(db_session, AccountDeletion, deletion_ids) == {live_ids[2]}
    output = capsys.readouterr().out
    assert output.splitlines() == [
        "purge: sessions=2 reset_tokens=2 account_deletions=1"
        " inactivity_warnings=0 inactive_accounts_deleted=0"
    ]
    # Counts only: nothing about whom the rows belonged to.
    assert user_id not in output and "@" not in output

    # Running it again is safe and deletes nothing more.
    assert await purge_script.run(_borrowed(db_session), NOW) == 0
    assert capsys.readouterr().out.splitlines() == [
        "purge: sessions=0 reset_tokens=0 account_deletions=0"
        " inactivity_warnings=0 inactive_accounts_deleted=0"
    ]
    assert await _left(db_session, AuthSession, session_ids) == {live_ids[0]}
    assert await _left(db_session, PasswordResetToken, token_ids) == {live_ids[1]}
