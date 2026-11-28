from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.core.errors import ApiError, ErrorCode
from app.core.security import Clock, PasswordHasher, in_hash_thread
from app.db.transaction import TransactionManager
from app.infrastructure.email import EmailSender, EmailSendError
from app.modules.auth.service import ResolvedSession
from app.modules.users.repository import UserRepository

from .repository import AccountDeletionRepository
from .templates import account_deleted_email

INVALID_PASSWORD = "The password is not correct."


@dataclass(frozen=True, slots=True)
class DeletedAccount:
    user_id: UUID
    email: str


class AccountService:
    def __init__(
        self,
        *,
        users: UserRepository,
        deletions: AccountDeletionRepository,
        password_hasher: PasswordHasher,
        clock: Clock,
        transaction_manager: TransactionManager,
        email_sender: EmailSender,
    ) -> None:
        self.users = users
        self.deletions = deletions
        self.password_hasher = password_hasher
        self.clock = clock
        self.transaction_manager = transaction_manager
        self.email_sender = email_sender

    async def delete_account(self, session: ResolvedSession, password: str) -> DeletedAccount:
        """Deletes the account, and by cascade every player and all progress (ADR 0008).

        Immediate and permanent. A wrong password is a 403, not a 401, so the
        web does not take it for a signed-out session.
        """
        user = session.user
        # Before the transaction: a connection is not held while Argon2 runs.
        verified = await in_hash_thread(self.password_hasher.verify, password, user.password_hash)
        if not verified:
            raise ApiError(ErrorCode.INVALID_PASSWORD, INVALID_PASSWORD, status_code=403)

        deleted = await self.delete_user(user.id, user.email)
        # A second request for the same account finds nothing left to delete.
        if deleted is None:
            raise ApiError(
                ErrorCode.AUTHENTICATION_ERROR, "Authentication required.", status_code=401
            )
        return deleted

    async def delete_user(
        self,
        user_id: UUID,
        email: str,
        *,
        inactive_before: datetime | None = None,
        warned_before: datetime | None = None,
    ) -> DeletedAccount | None:
        """The one deletion path, for self-service and for inactive accounts (ADR 0008):
        the users row goes, the cascade takes the rest, and the id is recorded for
        restores. None if there was nothing to delete, or the account was used again.
        """
        async with self.transaction_manager.transaction():
            if not await self.users.delete(
                user_id, inactive_before=inactive_before, warned_before=warned_before
            ):
                return None
            await self.deletions.record(user_id, deleted_at=self.clock.now())
        return DeletedAccount(user_id=user_id, email=email)

    async def send_deleted_email(self, deleted: DeletedAccount) -> None:
        """Sent after the commit. A delivery failure is logged by the sender, by
        recipient domain only, and the deletion stands.
        """
        try:
            await self.email_sender.send(account_deleted_email(to=deleted.email))
        except EmailSendError:
            pass
