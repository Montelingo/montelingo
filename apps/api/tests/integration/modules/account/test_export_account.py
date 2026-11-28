"""Integration tests for GET /account/export (ADR 0008, #252)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.auth.models import AuthSession, PasswordResetToken
from app.modules.content.models import Chapter, Location
from app.modules.progress.models import (
    ChapterProgress,
    GameResult,
    HeartEvent,
    LearningProfile,
    LocationProgress,
)
from app.modules.users.models import User
from tests.integration.modules.progress.test_progress_endpoint import (
    create_user,
    seed_chapters,
    seed_map,
    sign_in,
)

pytestmark = pytest.mark.integration

EXPORT = "/api/v1/account/export"
T0 = datetime(2026, 11, 20, 9, 0, tzinfo=UTC)


def at(minutes: int) -> datetime:
    return T0 + timedelta(minutes=minutes)


def iso(moment: datetime) -> str:
    return moment.isoformat().replace("+00:00", "Z")


async def add_progress(
    db: AsyncSession, profile: LearningProfile, place: Location, chapter: Chapter
) -> None:
    db.add_all(
        [
            LocationProgress(
                learning_profile_id=profile.id, location_id=place.id, started_at=at(0)
            ),
            ChapterProgress(
                learning_profile_id=profile.id, chapter_id=chapter.id, lesson_completed_at=at(1)
            ),
            GameResult(
                learning_profile_id=profile.id,
                chapter_id=chapter.id,
                game="memory",
                completed_at=at(2),
            ),
            HeartEvent(
                learning_profile_id=profile.id,
                earned_at=at(3),
                source="lesson",
                chapter_id=chapter.id,
            ),
            HeartEvent(
                learning_profile_id=profile.id, earned_at=at(4), source="practice", game="spell"
            ),
        ]
    )
    await db.flush()


async def test_the_export_holds_the_account_its_players_and_their_progress_only(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, first = await create_user(db_session)
    first.name, first.age_band, first.avatar, first.created_at = "Mia", "5-6", "fox", at(-10)
    second = LearningProfile(user_id=user.id, name="Luka", age_band="7", avatar="owl")
    second.created_at = at(-5)
    db_session.add(second)
    await db_session.flush()
    await add_progress(db_session, first, budva, beach)
    # Another family, with its own progress in another place.
    other, other_profile = await create_user(db_session)
    other_profile.name = "Ana"
    await add_progress(db_session, other_profile, kotor, beach)
    db_session.add(
        PasswordResetToken(user_id=user.id, token_hash=b"reset-token-hash", expires_at=at(60))
    )
    await db_session.flush()
    await sign_in(integration_client, user)
    cookie = integration_client.cookies[get_settings().session_cookie_name]
    session_hash = await db_session.scalar(
        select(AuthSession.token_hash).where(AuthSession.user_id == user.id)
    )
    password_hash = await db_session.scalar(select(User.password_hash).where(User.id == user.id))

    response = await integration_client.get(EXPORT)

    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-disposition"].startswith('attachment; filename="montelingo-')
    body = response.json()
    assert body["format_version"] == 1
    assert body["account"]["email"] == user.email
    assert set(body["account"]) == {
        "email",
        "created_at",
        "consent_accepted_at",
        "privacy_policy_version",
    }
    assert [player["name"] for player in body["players"]] == ["Mia", "Luka"]
    mia, luka = body["players"]
    assert mia["id"] == str(first.id)
    assert (mia["age_band"], mia["avatar"]) == ("5-6", "fox")
    assert mia["places"] == [{"location": "budva", "started_at": iso(at(0)), "completed_at": None}]
    assert mia["chapters"] == [{"chapter": "budva-beach", "lesson_completed_at": iso(at(1))}]
    assert mia["game_results"] == [
        {"chapter": "budva-beach", "game": "memory", "completed_at": iso(at(2))}
    ]
    assert mia["hearts"] == [
        {"earned_at": iso(at(3)), "source": "lesson", "chapter": "budva-beach", "game": None},
        {"earned_at": iso(at(4)), "source": "practice", "chapter": None, "game": "spell"},
    ]
    # A player with no progress yet.
    assert (luka["places"], luka["chapters"], luka["game_results"], luka["hearts"]) == (
        [],
        [],
        [],
        [],
    )

    text = response.text
    # Nothing from the other account.
    assert other.email not in text
    assert str(other_profile.id) not in text
    assert "kotor" not in text and "Ana" not in text
    # No secrets: the password hash, the session, the reset token.
    assert password_hash is not None and password_hash not in text
    assert cookie not in text
    assert session_hash is not None and session_hash.hex() not in text
    assert "reset-token-hash" not in text
    assert "password" not in text and "token" not in text


async def test_the_other_account_sees_only_its_own_data(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    beach, _ = await seed_chapters(db_session, budva, kotor)
    user, profile = await create_user(db_session)
    await add_progress(db_session, profile, budva, beach)
    other, other_profile = await create_user(db_session)
    await sign_in(integration_client, other)

    response = await integration_client.get(EXPORT)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["account"]["email"] == other.email
    assert [player["id"] for player in body["players"]] == [str(other_profile.id)]
    assert body["players"][0]["places"] == []
    assert user.email not in response.text
    assert str(profile.id) not in response.text


async def test_without_a_session_it_is_401(integration_client: AsyncClient) -> None:
    response = await integration_client.get(EXPORT)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"
