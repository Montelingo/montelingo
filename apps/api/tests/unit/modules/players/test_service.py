from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.core.errors import ApiError
from app.modules.auth.service import ResolvedSession
from app.modules.players.service import MAX_PLAYERS, PlayersService
from app.modules.progress.models import LearningProfile
from app.modules.users.domain import UserAccount

NOW = datetime(2026, 11, 22, tzinfo=UTC)


class FakeProfiles:
    def __init__(self, user_id: UUID, count: int) -> None:
        self.rows = [LearningProfile(id=uuid4(), user_id=user_id) for _ in range(count)]
        self.chosen: list[UUID] = []

    async def create_for_user(self, user_id: UUID) -> LearningProfile:
        row = LearningProfile(id=uuid4(), user_id=user_id)
        self.rows.append(row)
        return row

    async def get_for_user(self, user_id: UUID, profile_id: UUID) -> LearningProfile | None:
        return next((r for r in self.rows if r.id == profile_id and r.user_id == user_id), None)

    async def list_for_user(self, user_id: UUID) -> list[LearningProfile]:
        return [row for row in self.rows if row.user_id == user_id]

    async def last_chosen(self, user_id: UUID) -> LearningProfile | None:
        rows = await self.list_for_user(user_id)
        return rows[-1] if rows else None

    async def mark_chosen(self, profile: LearningProfile) -> None:
        self.chosen.append(profile.id)


class FakeSessions:
    def __init__(self) -> None:
        self.active: dict[UUID, UUID] = {}

    async def set_active_learning_profile(
        self, session_id: UUID, learning_profile_id: UUID
    ) -> None:
        self.active[session_id] = learning_profile_id


class FakeAccounts:
    def __init__(self) -> None:
        self.locked: list[UUID] = []

    async def lock(self, user_id: UUID) -> None:
        self.locked.append(user_id)


class FakeTransactionManager:
    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[None]:
        yield None


def make(
    count: int, active: UUID | None = None
) -> tuple[PlayersService, FakeProfiles, FakeSessions, ResolvedSession]:
    user = UserAccount(
        id=uuid4(),
        email="family@example.com",
        password_hash="hash",
        password_changed_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    profiles = FakeProfiles(user.id, count)
    sessions = FakeSessions()
    service = PlayersService(
        profiles=profiles,
        sessions=sessions,
        accounts=FakeAccounts(),
        transaction_manager=FakeTransactionManager(),  # type: ignore[arg-type]
    )
    return service, profiles, sessions, ResolvedSession(user, uuid4(), active)


async def test_a_session_without_a_player_plays_as_the_last_chosen_and_stores_it() -> None:
    service, profiles, sessions, session = make(count=2)

    player = await service.active(session)

    assert player is profiles.rows[-1]
    assert sessions.active == {session.session_id: player.id}


async def test_a_session_whose_player_is_gone_falls_back() -> None:
    service, profiles, sessions, session = make(count=1, active=uuid4())

    player = await service.active(session)

    assert player is profiles.rows[0]
    assert sessions.active == {session.session_id: player.id}


async def test_a_session_keeps_its_player() -> None:
    service, profiles, sessions, session = make(count=2)
    first = profiles.rows[0]

    assert await service.active(replace(session, active_learning_profile_id=first.id)) is first
    assert sessions.active == {}


async def test_an_account_without_a_player_is_a_500() -> None:
    service, _, _, session = make(count=0)

    with pytest.raises(ApiError) as error:
        await service.active(session)

    assert error.value.status_code == 500


async def test_adding_a_player_makes_it_active() -> None:
    service, profiles, sessions, session = make(count=1)

    player = await service.add(session)

    assert player.is_active and not player.is_complete
    assert sessions.active == {session.session_id: profiles.rows[-1].id}
    assert profiles.chosen == [profiles.rows[-1].id]


async def test_an_account_cannot_have_more_than_the_limit() -> None:
    service, profiles, sessions, session = make(count=MAX_PLAYERS)

    with pytest.raises(ApiError) as error:
        await service.add(session)

    assert (error.value.status_code, error.value.stable_code) == (409, "players_limit")
    assert len(profiles.rows) == MAX_PLAYERS
    assert sessions.active == {}


async def test_choosing_an_unknown_player_is_a_404() -> None:
    service, _, sessions, session = make(count=1)

    with pytest.raises(ApiError) as error:
        await service.select(session, uuid4())

    assert (error.value.status_code, error.value.stable_code) == (404, "player_not_found")
    assert sessions.active == {}
