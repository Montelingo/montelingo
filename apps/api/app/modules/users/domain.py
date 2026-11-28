from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class UserAccount:
    id: UUID
    email: str
    password_hash: str
    password_changed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # When the grown-up gave consent at sign-up, and to which policy version
    # (ADR 0008). None only for accounts created before #250.
    consent_accepted_at: datetime | None = None
    privacy_policy_version: str | None = None
    # ADR 0008's inactivity clock. None only where a test builds an account by hand.
    last_active_at: datetime | None = None
    inactivity_warning_sent_at: datetime | None = None
