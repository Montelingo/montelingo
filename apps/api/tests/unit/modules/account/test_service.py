from __future__ import annotations

import threading
from datetime import datetime
from uuid import UUID, uuid4

import pytest

from app.core.errors import ApiError
from app.infrastructure.email import EmailMessage, EmailSendError, InMemoryEmailSender
from app.modules.account.service import AccountService, DeletedAccount
from app.modules.account.templates import ACCOUNT_DELETED_SUBJECT
from app.modules.auth.service import ResolvedSession
from app.modules.users.domain import UserAccount
from tests.unit.modules.auth.test_service import NOW, FakeClock, FakeHasher, FakeTransactions


class FakeUsers:
    def __init__(self, transactions: FakeTransactions, *, exists: bool = True) -> None:
        self.transactions = transactions
        self.exists = exists
        self.deleted: list[UUID] = []
        self.open_transactions: list[int] = []

    async def delete(
        self,
        user_id: UUID,
        *,
        inactive_before: datetime | None = None,
        warned_before: datetime | None = None,
    ) -> bool:
        self.open_transactions.append(self.transactions.open)
        if not self.exists:
            return False
        self.deleted.append(user_id)
        return True


class FakeDeletions:
    def __init__(self) -> None:
        self.recorded: list[tuple[UUID, datetime]] = []

    async def record(self, user_id: UUID, *, deleted_at: datetime) -> None:
        self.recorded.append((user_id, deleted_at))


class FailingEmailSender:
    async def send(self, message: EmailMessage) -> None:
        raise EmailSendError("example.com", ConnectionError("SMTP is down"))


def make_session() -> ResolvedSession:
    user = UserAccount(
        id=uuid4(),
        email="family@example.com",
        password_hash="stored-hash",
        password_changed_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    return ResolvedSession(user=user, session_id=uuid4())


def make_service(
    *,
    valid: bool = True,
    exists: bool = True,
    email_sender: InMemoryEmailSender | FailingEmailSender | None = None,
) -> tuple[AccountService, FakeUsers, FakeDeletions, FakeHasher, FakeTransactions]:
    transactions = FakeTransactions()
    users = FakeUsers(transactions, exists=exists)
    deletions = FakeDeletions()
    hasher = FakeHasher(valid=valid)
    service = AccountService(
        users=users,  # type: ignore[arg-type]
        deletions=deletions,
        password_hasher=hasher,
        clock=FakeClock(),
        transaction_manager=transactions,  # type: ignore[arg-type]
        email_sender=email_sender or InMemoryEmailSender(),
    )
    return service, users, deletions, hasher, transactions


async def test_deleting_removes_the_user_and_records_the_deletion() -> None:
    service, users, deletions, hasher, _ = make_service()
    session = make_session()

    deleted = await service.delete_account(session, "password123")

    assert deleted == DeletedAccount(user_id=session.user.id, email="family@example.com")
    assert users.deleted == [session.user.id]
    assert deletions.recorded == [(session.user.id, NOW)]
    assert hasher.verified_hashes == ["stored-hash"]
    # The row is deleted inside a transaction, and only after the password check.
    assert users.open_transactions == [1]


async def test_the_password_is_checked_off_the_event_loop_and_outside_a_transaction() -> None:
    service, _, _, hasher, transactions = make_service()

    await service.delete_account(make_session(), "password123")

    assert hasher.threads
    assert threading.get_ident() not in hasher.threads
    assert transactions.open == 0


async def test_a_wrong_password_is_403_and_deletes_nothing() -> None:
    service, users, deletions, _, _ = make_service(valid=False)

    with pytest.raises(ApiError) as error:
        await service.delete_account(make_session(), "wrong-password")

    assert error.value.status_code == 403
    assert error.value.stable_code == "invalid_password"
    assert users.open_transactions == []
    assert deletions.recorded == []


async def test_an_account_already_deleted_is_401_and_records_nothing() -> None:
    service, _, deletions, _, _ = make_service(exists=False)

    with pytest.raises(ApiError) as error:
        await service.delete_account(make_session(), "password123")

    assert error.value.status_code == 401
    assert deletions.recorded == []


async def test_the_confirmation_email_goes_to_the_address_and_names_no_child() -> None:
    sender = InMemoryEmailSender()
    service, *_ = make_service(email_sender=sender)

    await service.send_deleted_email(DeletedAccount(user_id=uuid4(), email="family@example.com"))

    [message] = sender.messages
    assert message.to == "family@example.com"
    assert message.subject == ACCOUNT_DELETED_SUBJECT == "Tvoj Montelingo nalog je obrisan"
    assert "28 dana" in message.text_body
    assert message.html_body is not None and "28 dana" in message.html_body


async def test_a_failed_confirmation_email_does_not_raise() -> None:
    service, *_ = make_service(email_sender=FailingEmailSender())

    await service.send_deleted_email(DeletedAccount(user_id=uuid4(), email="family@example.com"))
