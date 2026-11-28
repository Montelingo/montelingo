"""Integration tests for POST /account/delete (ADR 0008, #251)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.account.models import AccountDeletion
from app.modules.auth.models import AuthSession, PasswordResetToken
from app.modules.progress.models import (
    ChapterProgress,
    GameResult,
    HeartEvent,
    LearningProfile,
    LocationProgress,
)
from app.modules.users.models import User
from tests.integration.modules.progress.test_progress_endpoint import (
    ORIGIN,
    PASSWORD,
    create_user,
    seed_chapters,
    seed_map,
    sign_in,
)

pytestmark = pytest.mark.integration

DELETE = "/api/v1/account/delete"


async def add_family_data(db: AsyncSession, user: User, first: LearningProfile) -> list[UUID]:
    """A second player, progress, game results and hearts for both, and a reset token."""
    budva, kotor = await seed_map(db)
    beach, _ = await seed_chapters(db, budva, kotor)
    second = LearningProfile(user_id=user.id, name="Luka", age_band="7", avatar="owl")
    db.add(second)
    await db.flush()
    now = datetime.now(UTC)
    for profile in (first, second):
        db.add_all(
            [
                LocationProgress(learning_profile_id=profile.id, location_id=budva.id),
                ChapterProgress(
                    learning_profile_id=profile.id, chapter_id=beach.id, lesson_completed_at=now
                ),
                GameResult(
                    learning_profile_id=profile.id,
                    chapter_id=beach.id,
                    game="memory",
                    completed_at=now,
                ),
                HeartEvent(
                    learning_profile_id=profile.id,
                    earned_at=now,
                    source="lesson",
                    chapter_id=beach.id,
                ),
            ]
        )
    db.add(
        PasswordResetToken(
            user_id=user.id, token_hash=b"reset-" + user.id.bytes, expires_at=now + timedelta(1)
        )
    )
    await db.flush()
    return [first.id, second.id]


async def rows_left(db: AsyncSession, user_id: UUID, profile_ids: list[UUID]) -> dict[str, int]:
    async def count(model: type, column: object, values: list[UUID]) -> int:
        result = await db.scalar(
            select(func.count()).select_from(model).where(column.in_(values))  # type: ignore[attr-defined]
        )
        return int(result or 0)

    return {
        "users": await count(User, User.id, [user_id]),
        "auth_sessions": await count(AuthSession, AuthSession.user_id, [user_id]),
        "password_reset_tokens": await count(
            PasswordResetToken, PasswordResetToken.user_id, [user_id]
        ),
        "learning_profiles": await count(LearningProfile, LearningProfile.user_id, [user_id]),
        "location_progress": await count(
            LocationProgress, LocationProgress.learning_profile_id, profile_ids
        ),
        "chapter_progress": await count(
            ChapterProgress, ChapterProgress.learning_profile_id, profile_ids
        ),
        "game_results": await count(GameResult, GameResult.learning_profile_id, profile_ids),
        "heart_events": await count(HeartEvent, HeartEvent.learning_profile_id, profile_ids),
    }


async def test_deleting_the_account_leaves_no_row_for_it_in_any_table(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile = await create_user(db_session)
    profile_ids = await add_family_data(db_session, user, profile)
    # Another family's data must stay.
    other, other_profile = await create_user(db_session)
    # Read before expire_all(): an expired attribute would be loaded lazily.
    user_id, email, other_id, other_profile_id = user.id, user.email, other.id, other_profile.id
    await sign_in(integration_client, user)
    cookie_name = get_settings().session_cookie_name
    old_cookie = integration_client.cookies[cookie_name]
    assert all(await rows_left(db_session, user_id, profile_ids))

    response = await integration_client.post(
        DELETE, json={"password": PASSWORD}, headers={"Origin": ORIGIN}
    )

    assert response.status_code == 204, response.text
    assert f"{cookie_name}=" in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    db_session.expire_all()
    assert await rows_left(db_session, user_id, profile_ids) == {
        "users": 0,
        "auth_sessions": 0,
        "password_reset_tokens": 0,
        "learning_profiles": 0,
        "location_progress": 0,
        "chapter_progress": 0,
        "game_results": 0,
        "heart_events": 0,
    }
    deletion = await db_session.get(AccountDeletion, user_id)
    assert deletion is not None
    assert abs(deletion.deleted_at - datetime.now(UTC)) < timedelta(minutes=1)
    assert (await rows_left(db_session, other_id, [other_profile_id]))["learning_profiles"] == 1

    # The old cookie no longer signs anyone in.
    integration_client.cookies.set(cookie_name, old_cookie)
    me = await integration_client.get("/api/v1/auth/me")
    assert me.status_code == 401
    # Nor does the password.
    again = await integration_client.post(
        "/api/v1/auth/sign-in",
        json={"email": email, "password": PASSWORD},
        headers={"Origin": ORIGIN},
    )
    assert again.status_code == 401


async def test_a_wrong_password_deletes_nothing(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, _ = await create_user(db_session)
    user_id = user.id
    await sign_in(integration_client, user)

    response = await integration_client.post(
        DELETE, json={"password": "not the password"}, headers={"Origin": ORIGIN}
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "invalid_password"
    db_session.expire_all()
    assert await db_session.get(User, user_id) is not None
    assert await db_session.get(AccountDeletion, user_id) is None
    assert (await integration_client.get("/api/v1/auth/me")).status_code == 200


async def test_it_needs_a_session_and_a_trusted_origin(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    no_session = await integration_client.post(
        DELETE, json={"password": PASSWORD}, headers={"Origin": ORIGIN}
    )
    assert no_session.status_code == 401

    user, _ = await create_user(db_session)
    user_id = user.id
    await sign_in(integration_client, user)
    foreign = await integration_client.post(
        DELETE, json={"password": PASSWORD}, headers={"Origin": "https://foreign.example"}
    )
    assert foreign.status_code == 403
    assert foreign.json()["error"]["code"] == "authorization_error"
    db_session.expire_all()
    assert await db_session.get(User, user_id) is not None
