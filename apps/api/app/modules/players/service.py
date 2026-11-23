from __future__ import annotations

from typing import Protocol, cast
from uuid import UUID

from app.core.errors import ApiError, ErrorCode
from app.db.transaction import TransactionManager
from app.modules.auth.service import ResolvedSession
from app.modules.progress.domain import ChildProfile
from app.modules.progress.models import LearningProfile
from app.modules.progress.repository import LearningProfileRepository
from app.modules.progress.schemas import AgeBand, Avatar

from .schemas import Player

# Enough for nearly every family. A constant, not a database constraint, so
# raising it needs no migration (ADR 0007).
MAX_PLAYERS = 4


class SessionPlayers(Protocol):
    async def set_active_learning_profile(
        self, session_id: UUID, learning_profile_id: UUID
    ) -> None: ...


class AccountLock(Protocol):
    async def lock(self, user_id: UUID) -> None: ...


class PlayersService:
    """Lists, adds and chooses the current account's players.

    Every lookup goes through the account, so a session only ever sees or
    plays as its own account's players.
    """

    def __init__(
        self,
        profiles: LearningProfileRepository,
        sessions: SessionPlayers,
        accounts: AccountLock,
        transaction_manager: TransactionManager,
    ) -> None:
        self.profiles = profiles
        self.sessions = sessions
        self.accounts = accounts
        self.transaction_manager = transaction_manager

    async def active(self, session: ResolvedSession) -> LearningProfile:
        """The player the session plays as. Progress routes answer for this player."""
        user_id = session.user.id
        if session.active_learning_profile_id is not None:
            player = await self.profiles.get_for_user(user_id, session.active_learning_profile_id)
            if player is not None:
                return player

        # The session has no player yet, or its player was removed: fall back
        # to the one chosen last, and remember it (ADR 0007).
        async with self.transaction_manager.transaction():
            player = await self.profiles.last_chosen(user_id)
            if player is None:
                raise ApiError(
                    ErrorCode.UNEXPECTED_ERROR,
                    "Learning profile is missing for the current user.",
                    status_code=500,
                )
            await self.sessions.set_active_learning_profile(session.session_id, player.id)
        return player

    async def list(self, session: ResolvedSession) -> list[Player]:
        """Every player, oldest first, with the session's own marked active."""
        active = await self.active(session)
        players = await self.profiles.list_for_user(session.user.id)
        return [_player(player, is_active=player.id == active.id) for player in players]

    async def add(self, session: ResolvedSession) -> Player:
        """Add an empty player and play as it. The setup steps then fill it in."""
        user_id = session.user.id
        async with self.transaction_manager.transaction():
            # Two adds at the same moment wait here, so both cannot pass the count.
            await self.accounts.lock(user_id)
            if len(await self.profiles.list_for_user(user_id)) >= MAX_PLAYERS:
                raise ApiError(
                    ErrorCode.PLAYERS_LIMIT,
                    f"An account can have at most {MAX_PLAYERS} players.",
                    status_code=409,
                )
            player = await self.profiles.create_for_user(user_id)
            await self._play_as(session, player)
        return _player(player, is_active=True)

    async def select(self, session: ResolvedSession, player_id: UUID) -> Player:
        async with self.transaction_manager.transaction():
            player = await self.profiles.get_for_user(session.user.id, player_id)
            if player is None:
                # The same answer for another account's player, so the two
                # cannot be told apart.
                raise ApiError(ErrorCode.PLAYER_NOT_FOUND, "Player not found.", status_code=404)
            await self._play_as(session, player)
        return _player(player, is_active=True)

    async def _play_as(self, session: ResolvedSession, player: LearningProfile) -> None:
        await self.profiles.mark_chosen(player)
        await self.sessions.set_active_learning_profile(session.session_id, player.id)


def _player(row: LearningProfile, *, is_active: bool) -> Player:
    # The table's check constraints keep the band and avatar to the known values.
    profile = ChildProfile(
        name=row.name,
        age_band=cast(AgeBand | None, row.age_band),
        avatar=cast(Avatar | None, row.avatar),
    )
    return Player(
        id=str(row.id),
        name=profile.name,
        age_band=profile.age_band,
        avatar=profile.avatar,
        is_complete=profile.is_complete,
        is_active=is_active,
    )
