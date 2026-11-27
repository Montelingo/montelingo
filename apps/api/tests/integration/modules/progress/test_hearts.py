"""Integration tests for hearts: a replay earns one, up to a daily cap (ADR 0009, #272)."""

from __future__ import annotations

import asyncio
import contextlib
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.db.transaction import SessionTransactionManager
from app.modules.content.models import Chapter, Location, Region
from app.modules.progress.domain import HEARTS_PER_DAY
from app.modules.progress.models import HeartEvent, LearningProfile
from app.modules.progress.repository import SqlAlchemyProgressRepository
from app.modules.progress.service import GameProgressService, LessonProgressService
from app.modules.users.models import User

from .test_game_result_endpoint import (
    BEACH_MEMORY,
    CHAPTER_SLUGS,
    LOCATION_SLUGS,
    REGION_SLUGS,
    record,
    record_games_directly,
    seed_budva_lessons,
)
from .test_progress_endpoint import create_user, seed_chapters, seed_map, sign_in

pytestmark = pytest.mark.integration

BEACH_LESSON = "/api/v1/chapters/budva-beach/lesson"


async def hearts(session: AsyncSession, profile: LearningProfile) -> list[HeartEvent]:
    # Read the id first: expiring the profile would make it load lazily.
    profile_id = profile.id
    session.expire_all()
    result = await session.scalars(
        select(HeartEvent)
        .where(HeartEvent.learning_profile_id == profile_id)
        .order_by(HeartEvent.earned_at)
    )
    return list(result.all())


async def hearts_total(client: AsyncClient) -> int:
    response = await client.get("/api/v1/progress")
    assert response.status_code == 200, response.text
    return int(response.json()["counts"]["hearts"])


async def test_a_new_player_has_no_hearts(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, _profile, _budva = await seed_budva_lessons(db_session)
    await sign_in(integration_client, user)

    assert await hearts_total(integration_client) == 0


async def test_a_replayed_game_earns_a_heart_and_the_first_time_does_not(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, _budva = await seed_budva_lessons(db_session)
    await sign_in(integration_client, user)

    first = await record(integration_client, BEACH_MEMORY)
    assert first["heart_earned"] is False
    assert await hearts(db_session, profile) == []

    replay = await record(integration_client, BEACH_MEMORY)

    assert replay["heart_earned"] is True
    [heart] = await hearts(db_session, profile)
    beach = await db_session.scalar(select(Chapter).where(Chapter.slug == "budva-beach"))
    assert beach is not None
    assert (heart.source, heart.chapter_id, heart.game) == ("game", beach.id, "memory")
    assert await hearts_total(integration_client) == 1


async def test_a_lesson_seen_again_earns_a_heart(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    # `seed_budva_lessons` has already seen both lessons.
    user, profile, _budva = await seed_budva_lessons(db_session)
    await sign_in(integration_client, user)

    body = await record(integration_client, BEACH_LESSON)

    assert body["heart_earned"] is True
    [heart] = await hearts(db_session, profile)
    assert (heart.source, heart.game) == ("lesson", None)
    assert heart.chapter_id is not None


async def test_a_lesson_seen_the_first_time_earns_no_heart(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)

    first = await record(integration_client, BEACH_LESSON)
    again = await record(integration_client, BEACH_LESSON)

    assert (first["heart_earned"], again["heart_earned"]) == (False, True)
    assert len(await hearts(db_session, profile)) == 1


async def test_the_sixth_replay_in_a_day_earns_no_heart_and_changes_nothing(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, _budva = await seed_budva_lessons(db_session)
    await sign_in(integration_client, user)
    first = await record(integration_client, BEACH_MEMORY)

    earned = [
        (await record(integration_client, BEACH_MEMORY))["heart_earned"]
        for _ in range(HEARTS_PER_DAY)
    ]
    # Lessons and games share the cap.
    past_cap = await record(integration_client, BEACH_LESSON)
    past_cap_game = await record(integration_client, BEACH_MEMORY)

    assert earned == [True] * HEARTS_PER_DAY
    assert past_cap["heart_earned"] is False
    assert past_cap_game == {**first, "heart_earned": False}
    assert len(await hearts(db_session, profile)) == HEARTS_PER_DAY
    assert await hearts_total(integration_client) == HEARTS_PER_DAY


async def test_the_cap_starts_again_the_next_day_in_podgorica(db_session: AsyncSession) -> None:
    _user, profile, _budva = await seed_budva_lessons(db_session)
    await record_games_directly(db_session, profile, ("budva-beach",))
    repository = SqlAlchemyProgressRepository(db_session)
    transactions = SessionTransactionManager(db_session)
    # 23:30 in Podgorica on 3 December, then 00:10 on the 4th (UTC+1 in winter).
    now = datetime(2026, 12, 3, 22, 30, tzinfo=UTC)

    def clock() -> datetime:
        return now

    games = GameProgressService(repository, transactions, clock=clock)
    lessons = LessonProgressService(repository, transactions, clock=clock)

    late = [
        (await games.complete_game(profile.id, "budva-beach", "memory")).heart_earned
        for _ in range(HEARTS_PER_DAY + 1)
    ]
    now += timedelta(minutes=40)
    after_midnight = await lessons.complete_lesson(profile.id, "budva-beach")

    assert late == [True] * HEARTS_PER_DAY + [False]
    assert after_midnight.heart_earned is True
    assert len(await hearts(db_session, profile)) == HEARTS_PER_DAY + 1


async def test_another_players_hearts_do_not_count_toward_the_cap(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, _budva = await seed_budva_lessons(db_session)
    other = LearningProfile(user_id=user.id)
    db_session.add(other)
    # Both players share a `created_at`, so mark which one sign-in makes active.
    profile.last_selected_at = datetime.now(UTC)
    await db_session.flush()
    db_session.add_all(
        HeartEvent(
            learning_profile_id=other.id,
            earned_at=datetime.now(UTC),
            source="practice",
            game="memory",
        )
        for _ in range(HEARTS_PER_DAY)
    )
    await db_session.flush()
    await sign_in(integration_client, user)

    body = await record(integration_client, BEACH_LESSON)

    assert body["heart_earned"] is True
    assert len(await hearts(db_session, profile)) == 1


@pytest.mark.parametrize(
    ("source", "with_chapter", "game"),
    [
        ("lesson", True, "memory"),
        ("lesson", False, None),
        ("game", True, None),
        ("game", False, "match"),
        ("practice", True, "memory"),
        ("practice", False, None),
        ("replay", False, "memory"),
        ("practice", False, "puzzle"),
    ],
)
async def test_a_heart_must_name_what_it_was_earned_for(
    db_session: AsyncSession, source: str, with_chapter: bool, game: str | None
) -> None:
    _user, profile, _budva = await seed_budva_lessons(db_session)
    chapter = await db_session.scalar(select(Chapter).where(Chapter.slug == "budva-beach"))
    assert chapter is not None

    with pytest.raises(IntegrityError):
        async with db_session.begin_nested():
            db_session.add(
                HeartEvent(
                    learning_profile_id=profile.id,
                    earned_at=datetime.now(UTC),
                    source=source,  # type: ignore[arg-type]
                    chapter_id=chapter.id if with_chapter else None,
                    game=game,  # type: ignore[arg-type]
                )
            )


class CountsAtOnce(SqlAlchemyProgressRepository):
    """After counting the day's hearts, waits up to a second for the other call to count.

    That makes both calls count before either adds its heart, unless the
    player's row lock makes the second call wait for the first to commit.
    Then the first gives up waiting and goes on.
    """

    def __init__(self, session: AsyncSession, counted: asyncio.Event, other: asyncio.Event):
        super().__init__(session)
        self.counted = counted
        self.other = other

    async def count_hearts(self, learning_profile_id: UUID, since: datetime | None = None) -> int:
        count = await super().count_hearts(learning_profile_id, since)
        if since is not None:
            self.counted.set()
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self.other.wait(), timeout=1)
        return count


async def test_two_replays_at_once_cannot_both_pass_the_cap(test_engine: AsyncEngine) -> None:
    # Two requests need two connections, so this test commits its rows and
    # deletes them at the end instead of using the rolled-back `db_session`.
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    user: User | None = None
    try:
        async with session_factory() as session:
            user, profile, _budva = await seed_budva_lessons(session)
            await record_games_directly(session, profile, ("budva-beach",))
            # One heart short of the cap.
            session.add_all(
                HeartEvent(
                    learning_profile_id=profile.id,
                    earned_at=datetime.now(UTC),
                    source="practice",
                    game="memory",
                )
                for _ in range(HEARTS_PER_DAY - 1)
            )
            await session.commit()

        first_counted, second_counted = asyncio.Event(), asyncio.Event()
        async with session_factory() as first, session_factory() as second:
            results = await asyncio.gather(
                GameProgressService(
                    CountsAtOnce(first, first_counted, second_counted),
                    SessionTransactionManager(first),
                ).complete_game(profile.id, "budva-beach", "memory"),
                GameProgressService(
                    CountsAtOnce(second, second_counted, first_counted),
                    SessionTransactionManager(second),
                ).complete_game(profile.id, "budva-beach", "memory"),
            )

        assert sorted(result.heart_earned for result in results) == [False, True]
        async with session_factory() as session:
            assert len(await hearts(session, profile)) == HEARTS_PER_DAY
    finally:
        async with session_factory() as session:
            if user is not None:
                # Deleting the user deletes its learning profile, progress and hearts.
                await session.execute(delete(User).where(User.id == user.id))
            await session.execute(delete(Chapter).where(Chapter.slug.in_(CHAPTER_SLUGS)))
            await session.execute(delete(Location).where(Location.slug.in_(LOCATION_SLUGS)))
            await session.execute(delete(Region).where(Region.slug.in_(REGION_SLUGS)))
            await session.commit()
