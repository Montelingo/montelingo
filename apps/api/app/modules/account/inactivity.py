"""Inactive accounts: warned first, then deleted (ADR 0008, #254).

An account is warned once it has been unused for `warning_days`, and deleted
only when it has been unused for `delete_days` *and* the warning went out at
least `delete_days - warning_days` days earlier. A warning that could not be
sent is not recorded, so a failed email delays the deletion and never skips
the warning. Any activity restarts the clock and clears the warning.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, tzinfo
from zoneinfo import ZoneInfo

from app.core.security import Clock
from app.db.transaction import TransactionManager
from app.infrastructure.email import EmailSender, EmailSendError
from app.modules.users.domain import UserAccount
from app.modules.users.repository import UserRepository

from .service import AccountService
from .templates import inactivity_warning_email

# The deletion date in the email is the family's day, not UTC's.
LOCAL_TIME_ZONE: tzinfo = ZoneInfo("Europe/Podgorica")


@dataclass(frozen=True)
class InactivityCounts:
    warned: int
    deleted: int


class InactiveAccounts:
    def __init__(
        self,
        *,
        users: UserRepository,
        accounts: AccountService,
        transaction_manager: TransactionManager,
        email_sender: EmailSender,
        clock: Clock,
        warning_days: int,
        delete_days: int,
        web_base_url: str,
    ) -> None:
        self.users = users
        self.accounts = accounts
        self.transaction_manager = transaction_manager
        self.email_sender = email_sender
        self.clock = clock
        self.warn_after = timedelta(days=warning_days)
        self.delete_after = timedelta(days=delete_days)
        # How long a warned family has to sign in.
        self.notice = self.delete_after - self.warn_after
        self.sign_in_link = f"{web_base_url.rstrip('/')}/sign-in"

    async def run(self) -> InactivityCounts:
        now = self.clock.now()
        # Deleting first: an account warned tonight can never be deleted tonight.
        deleted = await self._delete(now)
        warned = await self._warn(now)
        return InactivityCounts(warned=warned, deleted=deleted)

    def deletion_date(self, user: UserAccount, warned_at: datetime) -> str:
        """The first day the account can be deleted, as the email says it."""
        last_active = user.last_active_at or user.created_at
        due = max(last_active + self.delete_after, warned_at + self.notice)
        local = due.astimezone(LOCAL_TIME_ZONE).date()
        return f"{local.day}. {local.month}. {local.year}."

    async def _warn(self, now: datetime) -> int:
        inactive_before = now - self.warn_after
        warned = 0
        for user in await self.users.inactive(inactive_before=inactive_before, warned=False):
            message = inactivity_warning_email(
                to=user.email,
                deletion_date=self.deletion_date(user, now),
                sign_in_link=self.sign_in_link,
            )
            try:
                await self.email_sender.send(message)
            except EmailSendError:
                # Not recorded, so tomorrow's run tries again. The sender logs it.
                continue
            async with self.transaction_manager.transaction():
                if await self.users.mark_warned(user.id, at=now, inactive_before=inactive_before):
                    warned += 1
        return warned

    async def _delete(self, now: datetime) -> int:
        inactive_before = now - self.delete_after
        warned_before = now - self.notice
        deleted = 0
        for user in await self.users.inactive(
            inactive_before=inactive_before, warned=True, warned_before=warned_before
        ):
            # The same path as self-service, rechecked in the DELETE itself.
            account = await self.accounts.delete_user(
                user.id,
                user.email,
                inactive_before=inactive_before,
                warned_before=warned_before,
            )
            if account is not None:
                deleted += 1
                await self.accounts.send_deleted_email(account)
        return deleted
