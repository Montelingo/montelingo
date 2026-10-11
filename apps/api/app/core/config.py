from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MONTELINGO_", case_sensitive=False)

    env: str = Field(default="development")
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/montelingo"
    )

    session_cookie_name: str = Field(default="montelingo_session")
    session_ttl: int = Field(default=30 * 24 * 60 * 60)
    session_refresh_threshold: int = Field(default=15 * 24 * 60 * 60)
    password_reset_ttl: int = Field(default=30 * 60)
    web_base_url: str = Field(default="http://localhost:3000")
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    trusted_proxies: list[str] = Field(default_factory=list)
    rate_limiter_max_keys: int = Field(default=10_000, gt=0)

    sign_in_email_limit: int = 5
    sign_in_ip_limit: int = 30
    sign_in_window: int = 15 * 60
    sign_in_account_limit: int = 20
    sign_in_account_window: int = 60 * 60
    sign_up_ip_limit: int = 10
    sign_up_window: int = 60 * 60
    password_reset_email_limit: int = 3
    password_reset_ip_limit: int = 10
    password_reset_window: int = 60 * 60

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_security: Literal["none", "starttls", "tls"] = "starttls"
    smtp_from: str | None = None

    @field_validator("allowed_origins", "trusted_proxies", mode="before")
    @classmethod
    def parse_string_list(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            if v.startswith("["):
                import json

                try:
                    res = json.loads(v)
                    if isinstance(res, list):
                        values = [str(i) for i in res]
                    else:
                        values = []
                except Exception:
                    values = [i.strip() for i in v.split(",") if i.strip()]
            else:
                values = [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            values = [str(i) for i in v]
        else:
            raise ValueError(v)
        return values

    @field_validator("allowed_origins")
    @classmethod
    def normalize_allowed_origins(cls, values: list[str]) -> list[str]:
        return [cls._normalize_origin(value) for value in values]

    @staticmethod
    def _normalize_origin(value: str) -> str:
        parsed = urlsplit(value.strip())
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".casefold()
        return value.strip().rstrip("/").casefold()

    @property
    def cookie_secure(self) -> bool:
        return self.env == "production"

    def validate_smtp_for_production(self) -> None:
        if self.env == "production":
            if not self.smtp_host:
                raise ValueError("SMTP email configuration required in production")
            if self.smtp_username and not self.smtp_password:
                raise ValueError(
                    "MONTELINGO_SMTP_PASSWORD must be provided when smtp_username is set"
                )

    def __repr__(self) -> str:
        return f"Settings(env={self.env!r}, database_url='***', smtp_password='***')"


@lru_cache
def get_settings() -> Settings:
    return Settings()
