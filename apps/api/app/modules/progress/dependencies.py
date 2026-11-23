from __future__ import annotations

from fastapi import Depends

from app.modules.auth import get_current_session
from app.modules.auth.service import ResolvedSession
from app.modules.players.dependencies import get_players_service
from app.modules.players.service import PlayersService

from .models import LearningProfile


async def get_learning_profile(
    session: ResolvedSession = Depends(get_current_session),
    players: PlayersService = Depends(get_players_service),
) -> LearningProfile:
    """The session's active player (ADR 0007). Every progress route answers for it."""
    return await players.active(session)
