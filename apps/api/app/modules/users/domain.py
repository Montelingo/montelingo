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
