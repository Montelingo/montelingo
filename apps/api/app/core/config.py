from functools import lru_cache
from typing import Literal

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

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_security: Literal["none", "starttls", "tls"] = "starttls"
    smtp_from: str | None = None

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            if v.startswith("["):
                import json
                try:
                    res = json.loads(v)
                    if isinstance(res, list):
                        return [str(i) for i in res]
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(i) for i in v]
        raise ValueError(v)

    @property
    def cookie_secure(self) -> bool:
        return self.env == "production"

    def validate_smtp_for_production(self) -> None:
        if self.env == "production":
            if not self.smtp_host:
                raise ValueError("SMTP email configuration required in production")
            if self.smtp_username and not self.smtp_password:
                raise ValueError(
                    "MONTELINGO_SMTP_PASSWORD must be provided "
                    "when smtp_username is set"
                )

    def __repr__(self) -> str:
        return f"Settings(env={self.env!r}, database_url='***', smtp_password='***')"


@lru_cache
def get_settings() -> Settings:
    return Settings()
