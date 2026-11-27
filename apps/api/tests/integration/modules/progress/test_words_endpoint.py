"""Integration tests for GET /words, the child's learned words by place (#232)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.media import word_image_url
from app.modules.content.models import Chapter, Location, VocabularyItem
from app.modules.progress.models import ChapterProgress, LocationProgress

from .test_progress_endpoint import create_user, seed_map, sign_in

pytestmark = pytest.mark.integration


async def seed_words(session: AsyncSession, budva: Location, kotor: Location) -> dict[str, Chapter]:
    """Budva has two chapters, Kotor one. Recording numbers are global and unique."""

    beach = Chapter(location_id=budva.id, slug="budva-beach", title="Na plaži", position=1)
    walls = Chapter(location_id=kotor.id, slug="kotor-walls", title="Zidine", position=2)
    old_town = Chapter(location_id=budva.id, slug="budva-old-town", title="Stari grad", position=3)
    session.add_all([beach, walls, old_town])
    await session.flush()

    # Positions out of insert order, so the response has to follow them.
    session.add_all(
        [
            VocabularyItem(chapter_id=beach.id, number=2, text="pijesak", position=2),
            VocabularyItem(chapter_id=beach.id, number=1, text="more", note=None, position=1),
            VocabularyItem(chapter_id=walls.id, number=11, text="zidine", position=1),
            VocabularyItem(chapter_id=old_town.id, number=21, text="crkva", position=1),
            VocabularyItem(chapter_id=old_town.id, number=22, text="toranj", position=2),
            VocabularyItem(chapter_id=old_town.id, number=23, text="trg", position=3),
        ]
    )
    await session.flush()
    return {"beach": beach, "walls": walls, "old_town": old_town}


async def see_lesson(
    session: AsyncSession, profile_id: UUID, location: Location, chapter: Chapter
) -> None:
    now = datetime.now(UTC)
    session.add(LocationProgress(learning_profile_id=profile_id, location_id=location.id))
    session.add(
        ChapterProgress(
            learning_profile_id=profile_id, chapter_id=chapter.id, lesson_completed_at=now
        )
    )
    await session.flush()


async def test_words_require_authentication(integration_client: AsyncClient) -> None:
    response = await integration_client.get("/api/v1/words")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


async def test_a_new_account_has_no_words_and_budva_is_next(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_words(db_session, budva, kotor)
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)

    response = await integration_client.get("/api/v1/words")

    assert response.status_code == 200
    assert response.json() == {
        "places": [],
        "next_place": {"id": "budva", "region_id": "coast", "name": "Budva", "word_count": 5},
    }


async def test_a_seen_lesson_lists_its_words_in_recording_order(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    chapters = await seed_words(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await see_lesson(db_session, profile.id, budva, chapters["beach"])
    await sign_in(integration_client, user)

    response = await integration_client.get("/api/v1/words")

    assert response.status_code == 200
    data = response.json()
    [place] = data["places"]
    assert {key: place[key] for key in ("id", "region_id", "name")} == {
        "id": "budva",
        "region_id": "coast",
        "name": "Budva",
    }
    assert [(word["number"], word["text"]) for word in place["words"]] == [
        (1, "more"),
        (2, "pijesak"),
    ]
    assert place["words"][0]["image_url"] == word_image_url(1)
    assert place["words"][0]["audio_url"] is None
    # The rest of Budva: the old town's three words.
    assert data["next_place"] == {
        "id": "budva",
        "region_id": "coast",
        "name": "Budva",
        "word_count": 3,
    }


async def test_the_words_add_up_to_the_progress_count(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    chapters = await seed_words(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await see_lesson(db_session, profile.id, budva, chapters["beach"])
    db_session.add(
        ChapterProgress(
            learning_profile_id=profile.id,
            chapter_id=chapters["old_town"].id,
            lesson_completed_at=datetime.now(UTC),
        )
    )
    await db_session.flush()
    await sign_in(integration_client, user)

    words = (await integration_client.get("/api/v1/words")).json()
    progress = (await integration_client.get("/api/v1/progress")).json()

    listed = [word["text"] for place in words["places"] for word in place["words"]]
    # Chapter by chapter in map order: the beach, then the old town.
    assert listed == ["more", "pijesak", "crkva", "toranj", "trg"]
    assert len(listed) == progress["counts"]["words_learned"]
    # Kotor is still locked, because Budva's games are not done.
    assert words["next_place"] is None


async def test_two_accounts_only_see_their_own_words(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    budva, kotor = await seed_map(db_session)
    chapters = await seed_words(db_session, budva, kotor)
    learner, learner_profile = await create_user(db_session)
    newcomer, _ = await create_user(db_session)
    await see_lesson(db_session, learner_profile.id, budva, chapters["beach"])

    await sign_in(integration_client, newcomer)
    response = await integration_client.get("/api/v1/words")

    assert response.status_code == 200
    assert response.json()["places"] == []
