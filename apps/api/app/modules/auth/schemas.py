from __future__ import annotations

from datetime import datetime

from pydantic import EmailStr, Field, model_validator

from app.schemas.common import ApiSchema, UUIDString


class SignUpRequest(ApiSchema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_password_not_equal_to_email(self) -> SignUpRequest:
        self.email = self.email.strip().lower()
        if self.password == self.email:
            raise ValueError("Password cannot be identical to the email address.")
        return self


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
