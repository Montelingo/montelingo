from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MONTELINGO_", case_sensitive=False)

    env: Literal["development", "test", "production"] = Field(default="development")
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/montelingo"
    )

    session_cookie_name: str = Field(default="montelingo_session")
    session_ttl: int = Field(default=30 * 24 * 60 * 60)
    session_refresh_threshold: int = Field(default=15 * 24 * 60 * 60)
    password_reset_ttl: int = Field(default=30 * 60)
    web_base_url: str = Field(default="http://localhost:3000")
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    @property
    def cookie_secure(self) -> bool:
        return self.env != "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
