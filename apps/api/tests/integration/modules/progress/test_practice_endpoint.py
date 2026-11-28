"""Integration tests for POST /practice/{game_id}/result (ADR 0009, #273)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import Chapter, Location, VocabularyItem
from app.modules.progress.domain import HEARTS_PER_DAY
from app.modules.progress.models import HeartEvent, LearningProfile
from app.modules.users.models import User

from .test_game_result_endpoint import BEACH_MEMORY, record, seed_budva_lessons
from .test_hearts import hearts
from .test_progress_endpoint import ORIGIN, create_user, seed_chapters, seed_map, sign_in

pytestmark = pytest.mark.integration

PRACTICE_MEMORY = "/api/v1/practice/memory/result"
PRACTICE_MATCH = "/api/v1/practice/match/result"
PRACTICE_SPELL = "/api/v1/practice/spell/result"


async def seed_learner(session: AsyncSession) -> tuple[User, LearningProfile, Location]:
    """Both of Budva's lessons seen, and Na plaži has a word, so there is one to practise."""

    user, profile, budva = await seed_budva_lessons(session)
    beach = await session.scalar(select(Chapter).where(Chapter.slug == "budva-beach"))
    assert beach is not None
    session.add(VocabularyItem(chapter_id=beach.id, number=1, text="more", position=1))
    await session.flush()
    return user, profile, budva


async def test_requires_a_session(integration_client: AsyncClient) -> None:
    response = await integration_client.post(PRACTICE_MEMORY, headers={"Origin": ORIGIN})

    assert response.status_code == 401


async def test_needs_a_trusted_origin(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, _profile, _budva = await seed_learner(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(
        PRACTICE_MEMORY, headers={"Origin": "https://evil.example"}
    )

    assert response.status_code == 403


async def test_a_practice_game_earns_a_heart(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, _budva = await seed_learner(db_session)
    await sign_in(integration_client, user)
    before = (await integration_client.get("/api/v1/progress")).json()

    body = await record(integration_client, PRACTICE_MATCH)

    assert body == {"heart_earned": True}
    [heart] = await hearts(db_session, profile)
    assert (heart.source, heart.chapter_id, heart.game) == ("practice", None, "match")
    after = (await integration_client.get("/api/v1/progress")).json()
    # Practice changes no lock, sticker, star or word count, only the hearts.
    assert after["counts"] == {**before["counts"], "hearts": 1}
    assert {key: after[key] for key in ("regions", "locations", "chapters")} == {
        key: before[key] for key in ("regions", "locations", "chapters")
    }


async def test_practice_shares_the_daily_cap_with_replays(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, _budva = await seed_learner(db_session)
    await sign_in(integration_client, user)
    await record(integration_client, BEACH_MEMORY)
    replays = [
        (await record(integration_client, BEACH_MEMORY))["heart_earned"]
        for _ in range(HEARTS_PER_DAY - 1)
    ]

    last = await record(integration_client, PRACTICE_MEMORY)
    past_cap = await record(integration_client, PRACTICE_MEMORY)

    assert replays == [True] * (HEARTS_PER_DAY - 1)
    assert (last, past_cap) == ({"heart_earned": True}, {"heart_earned": False})
    assert len(await hearts(db_session, profile)) == HEARTS_PER_DAY


async def test_another_players_hearts_do_not_count_toward_the_cap(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, _budva = await seed_learner(db_session)
    other_user, other = await create_user(db_session)
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
    assert other_user.id != user.id
    await sign_in(integration_client, user)

    assert await record(integration_client, PRACTICE_MEMORY) == {"heart_earned": True}
    assert len(await hearts(db_session, profile)) == 1


async def test_unknown_game_is_404(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, _profile, _budva = await seed_learner(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(
        "/api/v1/practice/puzzle/result", headers={"Origin": ORIGIN}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "content_not_found"


async def test_lessons_without_words_leave_nothing_to_practise(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    # Both lessons are seen, but their chapters have no words yet.
    user, profile, _budva = await seed_budva_lessons(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(PRACTICE_MEMORY, headers={"Origin": ORIGIN})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "no_learned_words"
    assert await hearts(db_session, profile) == []


async def test_without_learned_words_is_409_and_records_nothing(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(PRACTICE_MEMORY, headers={"Origin": ORIGIN})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "no_learned_words"
    assert await hearts(db_session, profile) == []


async def test_spell_is_practice_and_earns_a_heart_without_touching_chapters(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    # Sastavi riječi is played only from the Riječi tab (#294).
    user, profile, _budva = await seed_learner(db_session)
    await sign_in(integration_client, user)
    before = (await integration_client.get("/api/v1/progress")).json()

    body = await record(integration_client, PRACTICE_SPELL)

    assert body == {"heart_earned": True}
    [heart] = await hearts(db_session, profile)
    assert (heart.source, heart.chapter_id, heart.game) == ("practice", None, "spell")
    after = (await integration_client.get("/api/v1/progress")).json()
    assert after["counts"] == {**before["counts"], "hearts": 1}
    assert {key: after[key] for key in ("regions", "locations", "chapters")} == {
        key: before[key] for key in ("regions", "locations", "chapters")
    }
    # No chapter lists it, and a place still gives 3 stars at most.
    assert all(
        [game["id"] for game in chapter["games"]] == ["memory", "match"]
        for chapter in after["chapters"]
    )


async def test_spell_shares_the_daily_cap(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, _budva = await seed_learner(db_session)
    await sign_in(integration_client, user)

    earned = [
        (await record(integration_client, PRACTICE_SPELL))["heart_earned"]
        for _ in range(HEARTS_PER_DAY + 1)
    ]

    assert earned == [True] * HEARTS_PER_DAY + [False]
    assert len(await hearts(db_session, profile)) == HEARTS_PER_DAY


async def test_spell_is_not_a_chapter_game(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile, _budva = await seed_learner(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.post(
        "/api/v1/chapters/budva-beach/games/spell/result", headers={"Origin": ORIGIN}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "content_not_found"
    assert await hearts(db_session, profile) == []
