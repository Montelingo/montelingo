"""Integration tests for inactive accounts: the activity clock, the warning and the
deletion (ADR 0008, #254). The defaults: warned after 700 days, deleted after 730.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

import scripts.purge_expired as purge_script
from app.infrastructure.email import EmailMessage, EmailSendError, InMemoryEmailSender
from app.modules.account.models import AccountDeletion
from app.modules.account.templates import ACCOUNT_DELETED_SUBJECT, INACTIVITY_WARNING_SUBJECT
from app.modules.progress.models import LearningProfile
from app.modules.users.models import User
from tests.integration.modules.progress.test_progress_endpoint import create_user, sign_in

pytestmark = pytest.mark.integration

NOW = datetime(2026, 12, 1, 3, 45, tzinfo=UTC)


class FailingEmailSender:
    async def send(self, message: EmailMessage) -> None:
        raise EmailSendError("example.com", ConnectionError("SMTP is down"))


async def set_clock(
    db: AsyncSession, user_id: UUID, last_active_at: datetime, warned_at: datetime | None = None
) -> None:
    """With an UPDATE, as the app does: an ORM flush would expire the row's
    updated_at, and the app, sharing this session, would then load it lazily.
    """
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(last_active_at=last_active_at, inactivity_warning_sent_at=warned_at)
    )
    db.expire_all()


async def account(
    db: AsyncSession, *, inactive_days: int, warned_days_ago: int | None = None
) -> tuple[UUID, str]:
    user, _ = await create_user(db)
    user_id, email = user.id, user.email
    warned_at = None if warned_days_ago is None else NOW - timedelta(days=warned_days_ago)
    await set_clock(db, user_id, NOW - timedelta(days=inactive_days), warned_at)
    return user_id, email


async def fresh(db: AsyncSession, user_id: UUID) -> User | None:
    db.expire_all()
    return await db.get(User, user_id)


async def test_an_account_inactive_for_700_days_is_warned_once(db_session: AsyncSession) -> None:
    user_id, email = await account(db_session, inactive_days=700)
    active_id, _ = await account(db_session, inactive_days=600)
    sender = InMemoryEmailSender()

    counts = await purge_script.handle_inactive(db_session, NOW, sender)

    assert (counts.warned, counts.deleted) == (1, 0)
    [message] = sender.messages
    assert message.to == email
    assert message.subject == INACTIVITY_WARNING_SUBJECT
    # 700 days ago + 730 = 30 days from now: 31 Dec 2026, in Podgorica.
    assert "obrisani nakon 31. 12. 2026." in message.text_body
    assert "http://localhost:3000/sign-in" in message.text_body
    user = await fresh(db_session, user_id)
    assert user is not None and user.inactivity_warning_sent_at == NOW
    still_active = await fresh(db_session, active_id)
    assert still_active is not None and still_active.inactivity_warning_sent_at is None

    # The next night sends nothing more.
    again = InMemoryEmailSender()
    counts = await purge_script.handle_inactive(db_session, NOW + timedelta(days=1), again)
    assert (counts.warned, counts.deleted) == (0, 0)
    assert again.messages == []


async def test_a_failed_warning_is_not_recorded_so_it_is_tried_again(
    db_session: AsyncSession,
) -> None:
    user_id, _ = await account(db_session, inactive_days=800)

    counts = await purge_script.handle_inactive(db_session, NOW, FailingEmailSender())

    assert (counts.warned, counts.deleted) == (0, 0)
    user = await fresh(db_session, user_id)
    assert user is not None and user.inactivity_warning_sent_at is None


async def test_no_account_is_deleted_without_a_warning(db_session: AsyncSession) -> None:
    user_id, _ = await account(db_session, inactive_days=900)
    sender = InMemoryEmailSender()

    counts = await purge_script.handle_inactive(db_session, NOW, sender)

    # Past the deletion point, but never warned: it is warned tonight, and kept.
    assert (counts.warned, counts.deleted) == (1, 0)
    assert [message.subject for message in sender.messages] == [INACTIVITY_WARNING_SUBJECT]
    # It can go 30 days after the warning, not before.
    assert "obrisani nakon 31. 12. 2026." in sender.messages[0].text_body
    assert await fresh(db_session, user_id) is not None


async def test_an_account_is_deleted_30_days_after_its_warning(db_session: AsyncSession) -> None:
    user_id, email = await account(db_session, inactive_days=731, warned_days_ago=30)
    profile = LearningProfile(user_id=user_id, name="Mia")
    db_session.add(profile)
    await db_session.flush()
    profile_id = profile.id
    too_soon_id, _ = await account(db_session, inactive_days=731, warned_days_ago=29)
    sender = InMemoryEmailSender()

    counts = await purge_script.handle_inactive(db_session, NOW, sender)

    assert (counts.warned, counts.deleted) == (0, 1)
    assert await fresh(db_session, user_id) is None
    assert await db_session.get(LearningProfile, profile_id) is None
    # The same path as self-service: recorded for restores, and confirmed by email.
    deletion = await db_session.get(AccountDeletion, user_id)
    assert deletion is not None and deletion.deleted_at == NOW
    assert [(m.to, m.subject) for m in sender.messages] == [(email, ACCOUNT_DELETED_SUBJECT)]
    assert await fresh(db_session, too_soon_id) is not None


async def test_signing_in_after_the_warning_keeps_the_account(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    now = datetime.now(UTC)
    user, _ = await create_user(db_session)
    user_id = user.id
    await sign_in(integration_client, user)
    await set_clock(db_session, user_id, now - timedelta(days=800), now - timedelta(days=31))
    signed_in = await fresh(db_session, user_id)
    assert signed_in is not None and signed_in.inactivity_warning_sent_at is not None

    await sign_in(integration_client, signed_in)

    signed_in = await fresh(db_session, user_id)
    assert signed_in is not None
    assert signed_in.inactivity_warning_sent_at is None
    assert signed_in.last_active_at >= now - timedelta(minutes=1)
    counts = await purge_script.handle_inactive(db_session, now, InMemoryEmailSender())
    assert (counts.warned, counts.deleted) == (0, 0)
    assert await fresh(db_session, user_id) is not None


async def test_using_the_app_moves_the_clock_at_most_once_a_day(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    now = datetime.now(UTC)
    user, _ = await create_user(db_session)
    user_id = user.id
    await sign_in(integration_client, user)

    # Used an hour ago: a request writes nothing.
    hour_ago = now - timedelta(hours=1)
    await set_clock(db_session, user_id, hour_ago)
    assert (await integration_client.get("/api/v1/auth/me")).status_code == 200
    unchanged = await fresh(db_session, user_id)
    assert unchanged is not None and unchanged.last_active_at == hour_ago

    # Unused for 702 days, and warned: the next request moves the clock and clears it.
    await set_clock(db_session, user_id, now - timedelta(days=702), now - timedelta(days=2))
    assert (await integration_client.get("/api/v1/auth/me")).status_code == 200
    moved = await fresh(db_session, user_id)
    assert moved is not None
    assert moved.last_active_at >= now - timedelta(minutes=1)
    assert moved.inactivity_warning_sent_at is None
