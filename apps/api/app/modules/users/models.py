from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Index, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    __table_args__ = (
        Index("uq_users_email_lower", func.lower(email), unique=True),
        Index("ix_users_last_active_at", "last_active_at"),
    )
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Set at sign-up (ADR 0008). Nullable only for accounts created before #250.
    consent_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    privacy_policy_version: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    # When the account was last used (ADR 0008): sign-up, sign-in, and any
    # signed-in request, at most once a day. Inactive accounts are deleted.
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Set when the inactivity warning email was sent. Any activity clears it.
    inactivity_warning_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
