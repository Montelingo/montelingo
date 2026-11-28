from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import ApiSchema, UUIDString


class SignUpRequest(ApiSchema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # The grown-up confirms they are the parent or guardian and accepts the
    # privacy policy (ADR 0008). Anything but true is a 422.
    parental_consent: Literal[True]
    # The version the page showed. One that is not current is a 409.
    privacy_policy_version: str = Field(min_length=1, max_length=32)

    @field_validator("parental_consent", mode="before")
    @classmethod
    def _consent_is_exactly_true(cls, value: object) -> object:
        # Literal[True] alone would also take 1, which is not a checked box.
        if value is not True:
            raise ValueError("Parental consent must be true.")
        return value


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
