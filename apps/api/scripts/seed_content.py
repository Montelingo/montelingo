"""Synchronize the checked-in content data into PostgreSQL."""

from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

from app.core.config import get_settings  # noqa: E402
from app.modules.content.domain import Content  # noqa: E402
from app.modules.content.loader import load_content  # noqa: E402
from app.modules.content.models import Chapter, Location, Region, VocabularyItem  # noqa: E402


@dataclass
class SeedCounts:
    inserted: int = 0
    updated: int = 0
    stale: int = 0


async def seed_content(session: AsyncSession, content: Content) -> SeedCounts:
    counts = SeedCounts()
    transaction = session.begin_nested() if session.in_transaction() else session.begin()
    async with transaction:
        regions = {row.slug: row for row in (await session.scalars(select(Region))).all()}
        region_ids: dict[str, UUID] = {}
        for position, item in enumerate(content.regions, 1):
            row = regions.get(item.slug)
            if row is None:
                row = Region(slug=item.slug, name=item.name, position=position)
                session.add(row)
                await session.flush()
                counts.inserted += 1
            else:
                if (row.name, row.position) != (item.name, position):
                    row.name = item.name
                    row.position = position
                    counts.updated += 1
            region_ids[item.slug] = row.id
        counts.stale += len(set(regions) - {item.slug for item in content.regions})

        locations = {row.slug: row for row in (await session.scalars(select(Location))).all()}
        for row in locations.values():
            row.is_start = False
        location_ids: dict[str, UUID] = {}
        for position, item in enumerate(content.locations, 1):
            row = locations.get(item.slug)
            values = (region_ids[item.region_slug], item.name, position, item.is_starting)
            if row is None:
                row = Location(
                    slug=item.slug,
                    region_id=values[0],
                    name=values[1],
                    position=values[2],
                    is_start=values[3],
                )
                session.add(row)
                await session.flush()
                counts.inserted += 1
            else:
                if (row.region_id, row.name, row.position, row.is_start) != values:
                    row.region_id, row.name, row.position, row.is_start = values
                    counts.updated += 1
            location_ids[item.slug] = row.id
        counts.stale += len(set(locations) - {item.slug for item in content.locations})

        chapters = {row.slug: row for row in (await session.scalars(select(Chapter))).all()}
        chapter_ids: dict[str, UUID] = {}
        for position, item in enumerate(content.chapters, 1):
            row = chapters.get(item.slug)
            chapter_values = (location_ids[item.location_slug], item.title, position)
            if row is None:
                row = Chapter(
                    slug=item.slug,
                    location_id=chapter_values[0],
                    title=chapter_values[1],
                    position=chapter_values[2],
                )
                session.add(row)
                await session.flush()
                counts.inserted += 1
            else:
                if (row.location_id, row.title, row.position) != chapter_values:
                    row.location_id, row.title, row.position = chapter_values
                    counts.updated += 1
            chapter_ids[item.slug] = row.id
        counts.stale += len(set(chapters) - {item.slug for item in content.chapters})

        words = {row.number: row for row in (await session.scalars(select(VocabularyItem))).all()}
        file_numbers: set[int] = set()
        for chapter in content.chapters:
            for position, item in enumerate(chapter.words, 1):
                file_numbers.add(item.number)
                row = words.get(item.number)
                word_values = (chapter_ids[chapter.slug], item.text, item.note, position)
                if row is None:
                    session.add(
                        VocabularyItem(
                            number=item.number,
                            chapter_id=word_values[0],
                            text=word_values[1],
                            note=word_values[2],
                            position=word_values[3],
                        )
                    )
                    counts.inserted += 1
                else:
                    if (row.chapter_id, row.text, row.note, row.position) != word_values:
                        row.chapter_id, row.text, row.note, row.position = word_values
                        counts.updated += 1
        counts.stale += len(set(words) - file_numbers)
    return counts


async def run() -> int:
    content = load_content()
    engine = create_async_engine(get_settings().database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            counts = await seed_content(session, content)
    finally:
        await engine.dispose()

    print(f"seed: inserted={counts.inserted} updated={counts.updated} stale={counts.stale}")
    return 1 if counts.stale else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
