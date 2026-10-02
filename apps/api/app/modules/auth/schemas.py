from __future__ import annotations

from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.common import ApiSchema, UUIDString


class SignUpRequest(ApiSchema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SignInRequest(ApiSchema):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class CurrentUser(ApiSchema):
    id: UUIDString
    email: EmailStr
    created_at: datetime


class PasswordResetRequest(ApiSchema):
    email: EmailStr


class PasswordResetConfirm(ApiSchema):
    token: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)
