from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


@dataclass(frozen=True, slots=True)
class UserAccount:
    id: UUID
    email: str
    password_hash: str
    password_changed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: str
    password_hash: str


class UserUpdate(BaseModel):
    email: str | None = None
    password_hash: str | None = None
