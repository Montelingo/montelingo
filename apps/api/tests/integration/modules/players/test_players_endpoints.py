"""Integration tests for /players and the active player (ADR 0007, #182)."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import AuthSession
from app.modules.players.service import MAX_PLAYERS
from tests.integration.modules.progress.test_progress_endpoint import (
    ORIGIN,
    create_user,
    seed_chapters,
    seed_map,
    sign_in,
    states,
)

pytestmark = pytest.mark.integration

MIA = {"name": "Mia", "age_band": "5-6", "avatar": "fox"}
LUKA = {"name": "Luka", "age_band": "7", "avatar": "owl"}


async def post(client: AsyncClient, path: str, status: int = 200) -> dict:
    response = await client.post(path, headers={"Origin": ORIGIN})
    assert response.status_code == status, response.text
    data: dict = response.json()
    return data


async def players(client: AsyncClient) -> list[dict]:
    response = await client.get("/api/v1/players")
    assert response.status_code == 200, response.text
    data: list[dict] = response.json()
    return data


async def put_profile(client: AsyncClient, body: dict[str, str]) -> None:
    response = await client.put("/api/v1/profile", json=body, headers={"Origin": ORIGIN})
    assert response.status_code == 200, response.text


def new_client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_the_routes_require_a_session_and_a_trusted_origin(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    player_path = f"/api/v1/players/{uuid4()}/select"
    assert (await integration_client.get("/api/v1/players")).status_code == 401
    assert (await integration_client.post("/api/v1/players")).status_code == 401
    assert (await integration_client.post(player_path)).status_code == 401

    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)
    assert (await integration_client.post("/api/v1/players")).status_code == 403
    assert (await integration_client.post(player_path)).status_code == 403


async def test_an_existing_account_has_its_one_child_as_the_active_player(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)

    assert await players(integration_client) == [
        {
            "id": str(profile.id),
            "name": None,
            "age_band": None,
            "avatar": None,
            "is_complete": False,
            "is_active": True,
        }
    ]


async def test_adding_a_player_starts_an_empty_profile_and_plays_as_it(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, first = await create_user(db_session)
    await sign_in(integration_client, user)
    await put_profile(integration_client, MIA)

    added = await post(integration_client, "/api/v1/players", status=201)

    assert added["is_active"] and not added["is_complete"]
    assert (await integration_client.get("/api/v1/profile")).json()["name"] is None
    # The setup steps write to the new player through PUT /profile.
    await put_profile(integration_client, LUKA)
    listed = await players(integration_client)
    assert [(p["id"], p["name"], p["is_active"]) for p in listed] == [
        (str(first.id), "Mia", False),
        (added["id"], "Luka", True),
    ]

    chosen = await post(integration_client, f"/api/v1/players/{first.id}/select")

    assert (chosen["id"], chosen["name"], chosen["is_active"]) == (str(first.id), "Mia", True)
    assert (await integration_client.get("/api/v1/profile")).json()["name"] == "Mia"
    # Oldest first, whoever is active.
    assert [p["id"] for p in await players(integration_client)] == [str(first.id), added["id"]]


async def test_an_account_has_at_most_four_players(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, _ = await create_user(db_session)
    await sign_in(integration_client, user)
    for _ in range(MAX_PLAYERS - 1):
        await post(integration_client, "/api/v1/players", status=201)

    error = await post(integration_client, "/api/v1/players", status=409)

    assert error["error"]["code"] == "players_limit"
    assert len(await players(integration_client)) == MAX_PLAYERS


async def test_another_accounts_player_cannot_be_chosen(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, own = await create_user(db_session)
    _, other = await create_user(db_session)
    await sign_in(integration_client, user)

    for player_id in (other.id, uuid4()):
        error = await post(integration_client, f"/api/v1/players/{player_id}/select", status=404)
        assert error["error"]["code"] == "player_not_found"
    malformed = await post(integration_client, "/api/v1/players/not-a-uuid/select", status=422)
    assert malformed["error"]["code"] == "validation_error"

    assert [(p["id"], p["is_active"]) for p in await players(integration_client)] == [
        (str(own.id), True)
    ]


async def test_one_players_progress_never_shows_for_another(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    budva, kotor = await seed_map(db_session)
    await seed_chapters(db_session, budva, kotor)
    user, first = await create_user(db_session)
    await sign_in(integration_client, user)

    async def lessons() -> dict[str, str]:
        progress = (await integration_client.get("/api/v1/progress")).json()
        return {chapter["id"]: chapter["lesson"] for chapter in progress["chapters"]}

    await post(integration_client, "/api/v1/chapters/budva-beach/lesson")
    second = await post(integration_client, "/api/v1/players", status=201)

    # The second player starts from nothing.
    progress = (await integration_client.get("/api/v1/progress")).json()
    assert states(progress, "locations")["budva"] == "available"
    assert await lessons() == {"budva-beach": "todo", "budva-old-town": "todo"}

    await post(integration_client, "/api/v1/chapters/budva-old-town/lesson")
    assert await lessons() == {"budva-beach": "todo", "budva-old-town": "done"}

    # And the first player's progress is untouched by the second's.
    await post(integration_client, f"/api/v1/players/{first.id}/select")
    assert await lessons() == {"budva-beach": "done", "budva-old-town": "todo"}

    await post(integration_client, f"/api/v1/players/{second['id']}/select")
    assert await lessons() == {"budva-beach": "todo", "budva-old-town": "done"}


async def test_each_session_plays_as_its_own_player(
    integration_app: FastAPI, db_session: AsyncSession
) -> None:
    user, first = await create_user(db_session)

    async with new_client(integration_app) as tablet, new_client(integration_app) as phone:
        await sign_in(tablet, user)
        await sign_in(phone, user)
        second = await post(tablet, "/api/v1/players", status=201)

        # Choosing on one device never changes another.
        assert [p["is_active"] for p in await players(tablet)] == [False, True]
        assert [p["is_active"] for p in await players(phone)] == [True, False]

    # A new session starts with the player chosen last.
    async with new_client(integration_app) as laptop:
        await sign_in(laptop, user)
        assert [p["id"] for p in await players(laptop) if p["is_active"]] == [second["id"]]

        await post(laptop, f"/api/v1/players/{first.id}/select")

    async with new_client(integration_app) as later:
        await sign_in(later, user)
        assert [p["id"] for p in await players(later) if p["is_active"]] == [str(first.id)]


async def test_a_session_without_a_player_gets_the_last_chosen_and_keeps_it(
    integration_client: AsyncClient, db_session: AsyncSession
) -> None:
    user, profile = await create_user(db_session)
    await sign_in(integration_client, user)
    # Like a session whose player was removed (ON DELETE SET NULL).
    await db_session.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user.id)
        .values(active_learning_profile_id=None)
    )

    assert [p["is_active"] for p in await players(integration_client)] == [True]

    stored = await db_session.scalar(
        select(AuthSession.active_learning_profile_id).where(AuthSession.user_id == user.id)
    )
    assert stored == profile.id
