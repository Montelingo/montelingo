"""The grown-up's copy of their data (GDPR Art. 15 and 20, ADR 0008)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, tzinfo
from typing import Protocol
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Clock
from app.modules.auth.service import ResolvedSession
from app.modules.content.models import Chapter, Location
from app.modules.progress.models import (
    ChapterProgress,
    GameResult,
    HeartEvent,
    LearningProfile,
    LocationProgress,
)

from .schemas import (
    AccountExport,
    ExportAccount,
    ExportChapter,
    ExportGameResult,
    ExportHeart,
    ExportPlace,
    ExportPlayer,
)

# The file is named by the family's day, not UTC's.
EXPORT_TIME_ZONE: tzinfo = ZoneInfo("Europe/Podgorica")


def export_filename(exported_at: datetime) -> str:
    return f"montelingo-{exported_at.astimezone(EXPORT_TIME_ZONE).date().isoformat()}.json"


class AccountExportRepository(Protocol):
    async def players(self, user_id: UUID) -> list[ExportPlayer]: ...


class SqlAlchemyAccountExportRepository:
    """Every query joins through the account's own players, so another
    account's rows can never be read.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def players(self, user_id: UUID) -> list[ExportPlayer]:
        own = LearningProfile.user_id == user_id
        profiles = (
            await self.session.scalars(
                select(LearningProfile)
                .where(own)
                .order_by(LearningProfile.created_at, LearningProfile.id)
            )
        ).all()

        places: defaultdict[UUID, list[ExportPlace]] = defaultdict(list)
        for profile_id, slug, started_at, completed_at in await self.session.execute(
            select(
                LocationProgress.learning_profile_id,
                Location.slug,
                LocationProgress.started_at,
                LocationProgress.completed_at,
            )
            .join(Location, Location.id == LocationProgress.location_id)
            .join(LearningProfile, LearningProfile.id == LocationProgress.learning_profile_id)
            .where(own)
            .order_by(LocationProgress.started_at, Location.slug)
        ):
            places[profile_id].append(
                ExportPlace(location=slug, started_at=started_at, completed_at=completed_at)
            )

        chapters: defaultdict[UUID, list[ExportChapter]] = defaultdict(list)
        for profile_id, slug, lesson_completed_at in await self.session.execute(
            select(
                ChapterProgress.learning_profile_id,
                Chapter.slug,
                ChapterProgress.lesson_completed_at,
            )
            .join(Chapter, Chapter.id == ChapterProgress.chapter_id)
            .join(LearningProfile, LearningProfile.id == ChapterProgress.learning_profile_id)
            .where(own)
            .order_by(ChapterProgress.lesson_completed_at.nulls_last(), Chapter.slug)
        ):
            chapters[profile_id].append(
                ExportChapter(chapter=slug, lesson_completed_at=lesson_completed_at)
            )

        results: defaultdict[UUID, list[ExportGameResult]] = defaultdict(list)
        for profile_id, slug, game, completed_at in await self.session.execute(
            select(
                GameResult.learning_profile_id,
                Chapter.slug,
                GameResult.game,
                GameResult.completed_at,
            )
            .join(Chapter, Chapter.id == GameResult.chapter_id)
            .join(LearningProfile, LearningProfile.id == GameResult.learning_profile_id)
            .where(own)
            .order_by(GameResult.completed_at, Chapter.slug, GameResult.game)
        ):
            results[profile_id].append(
                ExportGameResult(chapter=slug, game=game, completed_at=completed_at)
            )

        hearts: defaultdict[UUID, list[ExportHeart]] = defaultdict(list)
        for profile_id, earned_at, source, slug, game in await self.session.execute(
            select(
                HeartEvent.learning_profile_id,
                HeartEvent.earned_at,
                HeartEvent.source,
                Chapter.slug,
                HeartEvent.game,
            )
            .outerjoin(Chapter, Chapter.id == HeartEvent.chapter_id)
            .join(LearningProfile, LearningProfile.id == HeartEvent.learning_profile_id)
            .where(own)
            .order_by(HeartEvent.earned_at, HeartEvent.id)
        ):
            hearts[profile_id].append(
                ExportHeart(earned_at=earned_at, source=source, chapter=slug, game=game)
            )

        return [
            ExportPlayer(
                id=str(profile.id),
                name=profile.name,
                age_band=profile.age_band,
                avatar=profile.avatar,
                created_at=profile.created_at,
                places=places[profile.id],
                chapters=chapters[profile.id],
                game_results=results[profile.id],
                hearts=hearts[profile.id],
            )
            for profile in profiles
        ]


class AccountExportService:
    def __init__(self, repository: AccountExportRepository, clock: Clock) -> None:
        self.repository = repository
        self.clock = clock

    async def export(self, session: ResolvedSession) -> AccountExport:
        user = session.user
        return AccountExport(
            exported_at=self.clock.now(),
            account=ExportAccount(
                email=user.email,
                created_at=user.created_at,
                consent_accepted_at=user.consent_accepted_at,
                privacy_policy_version=user.privacy_policy_version,
            ),
            players=await self.repository.players(user.id),
        )
