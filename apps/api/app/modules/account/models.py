from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AccountDeletion(Base):
    """A deleted account's random id, so a restored backup can delete it again (ADR 0008).

    The id identifies no one once the account is gone. Rows are purged 28 days
    after `deleted_at`, when no backup still holds the account.
    """

    __tablename__ = "account_deletions"

    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
