from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.responses import error_responses
from app.modules.auth import get_current_session, require_trusted_origin
from app.modules.auth.service import ResolvedSession

from .dependencies import get_players_service
from .schemas import Player
from .service import PlayersService

router = APIRouter()


@router.get(
    "",
    operation_id="players_list",
    response_model=list[Player],
    responses=error_responses(401, 500),
)
async def list_players(
    session: ResolvedSession = Depends(get_current_session),
    service: PlayersService = Depends(get_players_service),
) -> list[Player]:
    return await service.list(session)


@router.post(
    "",
    operation_id="players_add",
    status_code=201,
    response_model=Player,
    responses=error_responses(401, 403, 409, 500),
)
async def add_player(
    # The session is checked before the Origin, so a request without one is a 401.
    session: ResolvedSession = Depends(get_current_session),
    _trusted_origin: None = Depends(require_trusted_origin),
    service: PlayersService = Depends(get_players_service),
) -> Player:
    return await service.add(session)


@router.post(
    "/{player_id}/select",
    operation_id="players_select",
    response_model=Player,
    responses=error_responses(401, 403, 404, 422, 500),
)
async def select_player(
    player_id: UUID,
    session: ResolvedSession = Depends(get_current_session),
    _trusted_origin: None = Depends(require_trusted_origin),
    service: PlayersService = Depends(get_players_service),
) -> Player:
    return await service.select(session, player_id)
