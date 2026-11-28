from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.modules.progress.schemas import GameId, HeartSource, PracticeGameId
from app.schemas.common import ApiSchema, UUIDString


class AccountDeleteRequest(ApiSchema):
    # Typed again: a child may be holding a signed-in tablet (ADR 0008).
    password: str = Field(min_length=1, max_length=128)


# The data export (ADR 0008): the account, every player and all their
# progress. Places and chapters are named by their content slug, so the file
# makes sense outside our database. Never the password hash, sessions or
# reset tokens.


class ExportAccount(ApiSchema):
    email: str
    created_at: datetime
    consent_accepted_at: datetime | None
    privacy_policy_version: str | None


class ExportPlace(ApiSchema):
    location: str
    started_at: datetime
    completed_at: datetime | None


class ExportChapter(ApiSchema):
    chapter: str
    lesson_completed_at: datetime | None


class ExportGameResult(ApiSchema):
    chapter: str
    game: GameId
    completed_at: datetime


class ExportHeart(ApiSchema):
    earned_at: datetime
    source: HeartSource
    # Null for a practice heart, which belongs to no chapter.
    chapter: str | None
    game: PracticeGameId | None


class ExportPlayer(ApiSchema):
    id: UUIDString
    name: str | None
    age_band: str | None
    avatar: str | None
    created_at: datetime
    places: list[ExportPlace]
    chapters: list[ExportChapter]
    game_results: list[ExportGameResult]
    hearts: list[ExportHeart]


class AccountExport(ApiSchema):
    # Lets the shape grow without breaking anyone who reads older files.
    format_version: Literal[1] = 1
    exported_at: datetime
    account: ExportAccount
    players: list[ExportPlayer]
