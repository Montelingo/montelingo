from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.progress.models import ChapterProgress, GameResult, LearningProfile
from app.modules.users.models import User
from tests.integration.schema_helpers import add_chapter, expect_violation

pytestmark = pytest.mark.integration


async def add_profile(db: AsyncSession) -> LearningProfile:
    user = User(email=f"{uuid4().hex}@example.com", password_hash="hash")
    db.add(user)
    await db.flush()
    profile = LearningProfile(user_id=user.id)
    db.add(profile)
    await db.flush()
    return profile


async def test_a_second_result_for_the_same_game_is_rejected(db_session: AsyncSession) -> None:
    chapter = await add_chapter(db_session)
    profile = await add_profile(db_session)
    db_session.add(GameResult(learning_profile_id=profile.id, chapter_id=chapter.id, game="memory"))
    await db_session.flush()

    db_session.add(GameResult(learning_profile_id=profile.id, chapter_id=chapter.id, game="memory"))
    await expect_violation(db_session, "uq_game_results_learning_profile_id_chapter_id_game")


async def test_each_game_of_a_chapter_has_its_own_result(db_session: AsyncSession) -> None:
    chapter = await add_chapter(db_session)
    profile = await add_profile(db_session)
    db_session.add_all(
        [
            GameResult(learning_profile_id=profile.id, chapter_id=chapter.id, game="memory"),
            GameResult(learning_profile_id=profile.id, chapter_id=chapter.id, game="match"),
        ]
    )
    await db_session.flush()

    count = select(func.count()).where(GameResult.learning_profile_id == profile.id)
    assert await db_session.scalar(count) == 2


async def test_an_unknown_game_is_rejected(db_session: AsyncSession) -> None:
    chapter = await add_chapter(db_session)
    profile = await add_profile(db_session)

    db_session.add(GameResult(learning_profile_id=profile.id, chapter_id=chapter.id, game="quiz"))
    await expect_violation(db_session, "ck_game_results_game")


async def test_a_chapter_has_one_progress_row_per_profile(db_session: AsyncSession) -> None:
    chapter = await add_chapter(db_session)
    profile = await add_profile(db_session)
    db_session.add(ChapterProgress(learning_profile_id=profile.id, chapter_id=chapter.id))
    await db_session.flush()
    db_session.expunge_all()

    db_session.add(ChapterProgress(learning_profile_id=profile.id, chapter_id=chapter.id))
    await expect_violation(db_session, "pk_chapter_progress")


async def test_deleting_an_account_removes_its_chapter_progress_and_results(
    db_session: AsyncSession,
) -> None:
    chapter = await add_chapter(db_session)
    profile = await add_profile(db_session)
    db_session.add(ChapterProgress(learning_profile_id=profile.id, chapter_id=chapter.id))
    db_session.add(GameResult(learning_profile_id=profile.id, chapter_id=chapter.id, game="match"))
    await db_session.flush()
    profile_id = profile.id

    await db_session.delete(await db_session.get_one(User, profile.user_id))
    await db_session.flush()
    db_session.expunge_all()

    progress = select(func.count()).where(ChapterProgress.learning_profile_id == profile_id)
    results = select(func.count()).where(GameResult.learning_profile_id == profile_id)
    assert await db_session.scalar(progress) == 0
    assert await db_session.scalar(results) == 0
