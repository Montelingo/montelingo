from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .domain import UserAccount
from .models import User


class UserRepository(Protocol):
    async def create(
        self,
        *,
        email: str,
        password_hash: str,
        consent_accepted_at: datetime,
        privacy_policy_version: str,
    ) -> UserAccount: ...

    async def get_by_email(self, email: str) -> UserAccount | None: ...

    async def get_by_id(self, user_id: UUID) -> UserAccount | None: ...

    async def update_password(
        self, user_id: UUID, password_hash: str, *, password_changed_at: datetime | None = None
    ) -> None: ...

    async def lock(self, user_id: UUID) -> None: ...

    async def delete(
        self,
        user_id: UUID,
        *,
        inactive_before: datetime | None = None,
        warned_before: datetime | None = None,
    ) -> bool: ...

    async def record_activity(
        self, user_id: UUID, *, now: datetime, stale_before: datetime
    ) -> None: ...

    async def inactive(
        self, *, inactive_before: datetime, warned: bool, warned_before: datetime | None = None
    ) -> list[UserAccount]: ...

    async def mark_warned(
        self, user_id: UUID, *, at: datetime, inactive_before: datetime
    ) -> bool: ...


def _account(user: User) -> UserAccount:
    return UserAccount(
        id=user.id,
        email=user.email,
        password_hash=user.password_hash,
        password_changed_at=user.password_changed_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
        consent_accepted_at=user.consent_accepted_at,
        privacy_policy_version=user.privacy_policy_version,
        last_active_at=user.last_active_at,
        inactivity_warning_sent_at=user.inactivity_warning_sent_at,
    )


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        email: str,
        password_hash: str,
        consent_accepted_at: datetime,
        privacy_policy_version: str,
    ) -> UserAccount:
        user = User(
            email=email,
            password_hash=password_hash,
            consent_accepted_at=consent_accepted_at,
            privacy_policy_version=privacy_policy_version,
        )

        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)

        return _account(user)

    async def get_by_email(self, email: str) -> UserAccount | None:
        user = await self.session.scalar(select(User).where(func.lower(User.email) == email))
        return _account(user) if user else None

    async def get_by_id(self, user_id: UUID) -> UserAccount | None:
        user = await self.session.get(User, user_id)
        return _account(user) if user else None

    async def update_password(
        self, user_id: UUID, password_hash: str, *, password_changed_at: datetime | None = None
    ) -> None:
        values: dict[str, str | datetime] = {"password_hash": password_hash}
        if password_changed_at is not None:
            values["password_changed_at"] = password_changed_at
        await self.session.execute(update(User).where(User.id == user_id).values(**values))

    async def lock(self, user_id: UUID) -> None:
        """Lock the account's row until the transaction ends."""
        await self.session.execute(select(User.id).where(User.id == user_id).with_for_update())

    async def delete(
        self,
        user_id: UUID,
        *,
        inactive_before: datetime | None = None,
        warned_before: datetime | None = None,
    ) -> bool:
        """Deletes the account. The foreign keys cascade to every row that holds its
        data: sessions, reset tokens, players and all their progress. False if it
        was already gone.

        With `inactive_before` and `warned_before`, only while the account is still
        inactive and was warned in time, checked in the same statement, so a
        sign-in at that moment keeps it (ADR 0008).
        """
        statement = delete(User).where(User.id == user_id)
        if inactive_before is not None:
            statement = statement.where(User.last_active_at <= inactive_before)
        if warned_before is not None:
            statement = statement.where(User.inactivity_warning_sent_at <= warned_before)
        deleted = await self.session.scalar(statement.returning(User.id))
        return deleted is not None

    async def record_activity(
        self, user_id: UUID, *, now: datetime, stale_before: datetime
    ) -> None:
        """Moves `last_active_at` to now and clears the warning, unless it moved after
        `stale_before` and no warning is pending: at most one write a day.
        """
        await self.session.execute(
            update(User)
            .where(
                User.id == user_id,
                or_(
                    User.last_active_at <= stale_before,
                    User.inactivity_warning_sent_at.is_not(None),
                ),
            )
            .values(last_active_at=now, inactivity_warning_sent_at=None)
            .execution_options(synchronize_session=False)
        )

    async def inactive(
        self, *, inactive_before: datetime, warned: bool, warned_before: datetime | None = None
    ) -> list[UserAccount]:
        """Accounts unused since `inactive_before`: not yet warned, or (with `warned`)
        warned no later than `warned_before`.
        """
        statement = select(User).where(User.last_active_at <= inactive_before)
        if not warned:
            statement = statement.where(User.inactivity_warning_sent_at.is_(None))
        else:
            statement = statement.where(User.inactivity_warning_sent_at.is_not(None))
            if warned_before is not None:
                statement = statement.where(User.inactivity_warning_sent_at <= warned_before)
        users = await self.session.scalars(statement.order_by(User.last_active_at, User.id))
        return [_account(user) for user in users]

    async def mark_warned(self, user_id: UUID, *, at: datetime, inactive_before: datetime) -> bool:
        """Records the sent warning, unless the account was used or warned meanwhile."""
        warned = await self.session.scalar(
            update(User)
            .where(
                User.id == user_id,
                User.last_active_at <= inactive_before,
                User.inactivity_warning_sent_at.is_(None),
            )
            .values(inactivity_warning_sent_at=at)
            .returning(User.id)
            .execution_options(synchronize_session=False)
        )
        return warned is not None
