from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MONTELINGO_", case_sensitive=False)

    env: str = Field(default="development")
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = False
    smtp_from: str | None = None

    def validate_smtp_for_production(self) -> None:
        if self.env.lower() not in {"production", "prod"}:
            return
        missing = [
            name
            for name, value in (
                ("MONTELINGO_SMTP_HOST", self.smtp_host),
                ("MONTELINGO_SMTP_FROM", self.smtp_from),
            )
            if not value
        ]
        if (self.smtp_username is None) != (self.smtp_password is None):
            missing.append("MONTELINGO_SMTP_USERNAME and MONTELINGO_SMTP_PASSWORD")
        if missing:
            raise ValueError(
                "SMTP email configuration is required in production; missing " + ", ".join(missing)
            )

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/montelingo"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
