
from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Argon2PasswordHasher
from app.modules.content.models import Chapter, Location, Region, VocabularyItem
from app.modules.users.models import User

pytestmark = pytest.mark.integration


async def sign_in_test_user(
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    password = "correct horse battery staple"
    user = User(
        email=f"content-{uuid4().hex}@example.com",
        password_hash=Argon2PasswordHasher().hash(password),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(user)
    await session.flush()

    response = await client.post(
        "/api/v1/auth/sign-in",
        json={"email": user.email, "password": password},
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200


async def seed_content(session: AsyncSession) -> None:
    north = Region(slug="north", name="North", position=2)
    south = Region(slug="south", name="South", position=1)
    session.add_all([north, south])
    await session.flush()

    village = Location(
        region_id=north.id,
        slug="village",
        name="Village",
        position=2,
    )
    city = Location(
        region_id=north.id,
        slug="city",
        name="City",
        position=1,
    )
    session.add_all([village, city])
    await session.flush()

    second_chapter = Chapter(
        location_id=city.id,
        slug="chapter-two",
        title="Chapter Two",
        position=2,
    )
    first_chapter = Chapter(
        location_id=city.id,
        slug="chapter-one",
        title="Chapter One",
        position=1,
    )
    session.add_all([second_chapter, first_chapter])
    await session.flush()

    words = []
    for chapter, offset in (
        (first_chapter, 0),
        (second_chapter, 10),
    ):
        for position in range(1, 11):
            number = offset + position
            words.append(
                VocabularyItem(
                    chapter_id=chapter.id,
                    number=number,
                    text=f"Word {number}",
                    note=None,
                    position=position,
                )
            )

    session.add_all(words)
    await session.flush()


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/regions",
        "/api/v1/regions/north",
        "/api/v1/locations/city",
    ],
)
async def test_content_requires_authentication(
    integration_client: AsyncClient,
    path: str,
) -> None:
    response = await integration_client.get(path)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


async def test_regions_are_ordered_and_counted(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await seed_content(db_session)
    await sign_in_test_user(integration_client, db_session)

    response = await integration_client.get("/api/v1/regions")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, max-age=300"

    data = response.json()
    assert [item["id"] for item in data["items"]] == ["south", "north"]
    assert [item["location_count"] for item in data["items"]] == [0, 2]
    assert data["page"]["has_more"] is False
    assert data["page"]["next_cursor"] is None


async def test_region_detail_counts_and_ordering(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await seed_content(db_session)
    await sign_in_test_user(integration_client, db_session)

    response = await integration_client.get("/api/v1/regions/north")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, max-age=300"

    data = response.json()
    assert data["id"] == "north"
    assert [item["id"] for item in data["locations"]] == ["city", "village"]
    assert [item["chapter_count"] for item in data["locations"]] == [2, 0]
    assert [item["word_count"] for item in data["locations"]] == [20, 0]
    assert all(item["region_id"] == "north" for item in data["locations"])


async def test_location_detail_recording_order(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await seed_content(db_session)
    await sign_in_test_user(integration_client, db_session)

    response = await integration_client.get("/api/v1/locations/city")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, max-age=300"

    data = response.json()
    assert data["id"] == "city"
    assert data["region_id"] == "north"

    chapters = data["chapters"]
    assert [chapter["id"] for chapter in chapters] == [
        "chapter-one",
        "chapter-two",
    ]
    assert [chapter["position"] for chapter in chapters] == [1, 2]

    assert len(chapters[0]["words"]) == 10
    assert len(chapters[1]["words"]) == 10

    assert [word["number"] for word in chapters[0]["words"]] == list(range(1, 11))
    assert [word["number"] for word in chapters[1]["words"]] == list(range(11, 21))

    for chapter in chapters:
        for word in chapter["words"]:
            assert word["image_url"] is None
            assert word["audio_url"] is None
            assert word["id"]


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/regions/unknown-region",
        "/api/v1/locations/unknown-location",
    ],
)
async def test_unknown_content_returns_404(
    integration_client: AsyncClient,
    db_session: AsyncSession,
    path: str,
) -> None:
    await sign_in_test_user(integration_client, db_session)

    response = await integration_client.get(path)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "content_not_found"


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/regions/Kotor",
        "/api/v1/regions/a_b",
        "/api/v1/locations/Kotor",
        "/api/v1/locations/a_b",
    ],
)
async def test_invalid_content_slug_returns_422(
    integration_client: AsyncClient,
    db_session: AsyncSession,
    path: str,
) -> None:
    await sign_in_test_user(integration_client, db_session)

    response = await integration_client.get(path)

    assert response.status_code == 422


async def test_content_query_count_stays_constant(
    integration_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await seed_content(db_session)
    await sign_in_test_user(integration_client, db_session)

    engine = db_session.sync_session.get_bind()
    assert engine is not None

    content_tables = (
        "regions",
        "locations",
        "chapters",
        "vocabulary_items",
    )
    statements: list[str] = []

    def count_content_queries(
        conn: object,
        cursor: object,
        statement: str,
        parameters: object,
        context: object,
        executemany: bool,
    ) -> None:
        sql = statement.lower()
        if sql.lstrip().startswith("select") and any(
            table in sql for table in content_tables
        ):
            statements.append(sql)

    paths = {
        "regions": "/api/v1/regions",
        "region_detail": "/api/v1/regions/north",
        "location_detail": "/api/v1/locations/city",
    }

    async def measure_queries() -> dict[str, int]:
        counts: dict[str, int] = {}
        for name, path in paths.items():
            statements.clear()
            response = await integration_client.get(path)
            assert response.status_code == 200
            counts[name] = len(statements)
        return counts

    event.listen(engine, "before_cursor_execute", count_content_queries)

    try:
        before = await measure_queries()

        extra_region = Region(
            slug="east",
            name="East",
            position=3,
        )
        db_session.add(extra_region)
        await db_session.flush()

        extra_location = Location(
            region_id=extra_region.id,
            slug="east-town",
            name="East Town",
            position=1,
        )

        north_id = await db_session.scalar(
            select(Region.id).where(Region.slug == "north")
        )
        assert north_id is not None

        north = await db_session.get(Region, north_id)
        assert north is not None

        north_location = Location(
            region_id=north.id,
            slug="north-town",
            name="North Town",
            position=3,
        )
        db_session.add_all([extra_location, north_location])
        await db_session.flush()

        city_id = await db_session.scalar(
            select(Location.id).where(Location.slug == "city")
        )
        assert city_id is not None

        extra_chapter = Chapter(
            location_id=city_id,
            slug="chapter-three",
            title="Chapter Three",
            position=3,
        )
        db_session.add(extra_chapter)
        await db_session.flush()

        db_session.add_all(
            [
                VocabularyItem(
                    chapter_id=extra_chapter.id,
                    number=number,
                    text=f"Word {number}",
                    note=None,
                    position=number - 20,
                )
                for number in range(21, 31)
            ]
        )
        await db_session.flush()

        after = await measure_queries()

        assert before == {
            "regions": 1,
            "region_detail": 2,
            "location_detail": 2,
        }
        assert after == before

    finally:
        event.remove(
            engine,
            "before_cursor_execute",
            count_content_queries,
        )
