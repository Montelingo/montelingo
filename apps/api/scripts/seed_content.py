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
        regions: dict[str, Region] = {
            region.slug: region for region in (await session.scalars(select(Region))).all()
        }
        region_ids: dict[str, UUID] = {}
        for position, region_data in enumerate(content.regions, 1):
            region_row = regions.get(region_data.slug)
            if region_row is None:
                region_row = Region(slug=region_data.slug, name=region_data.name, position=position)
                session.add(region_row)
                await session.flush()
                counts.inserted += 1
            else:
                if (region_row.name, region_row.position) != (region_data.name, position):
                    region_row.name = region_data.name
                    region_row.position = position
                    counts.updated += 1
            region_ids[region_data.slug] = region_row.id
        counts.stale += len(set(regions) - {region_data.slug for region_data in content.regions})

        locations: dict[str, Location] = {
            location.slug: location for location in (await session.scalars(select(Location))).all()
        }
        for location in locations.values():
            if location.is_start and location.slug != content.starting_location:
                location.is_start = False
                counts.updated += 1
        await session.flush()
        location_ids: dict[str, UUID] = {}
        for position, location_data in enumerate(content.locations, 1):
            location_row = locations.get(location_data.slug)
            values = (
                region_ids[location_data.region_slug],
                location_data.name,
                position,
                location_data.is_starting,
            )
            if location_row is None:
                location_row = Location(
                    slug=location_data.slug,
                    region_id=values[0],
                    name=values[1],
                    position=values[2],
                    is_start=values[3],
                )
                session.add(location_row)
                await session.flush()
                counts.inserted += 1
            else:
                if (
                    location_row.region_id,
                    location_row.name,
                    location_row.position,
                    location_row.is_start,
                ) != values:
                    (
                        location_row.region_id,
                        location_row.name,
                        location_row.position,
                        location_row.is_start,
                    ) = values
                    counts.updated += 1
            location_ids[location_data.slug] = location_row.id
        counts.stale += len(
            set(locations) - {location_data.slug for location_data in content.locations}
        )

        chapters: dict[str, Chapter] = {
            chapter.slug: chapter for chapter in (await session.scalars(select(Chapter))).all()
        }
        chapter_ids: dict[str, UUID] = {}
        for position, chapter_data in enumerate(content.chapters, 1):
            chapter_row = chapters.get(chapter_data.slug)
            chapter_values = (
                location_ids[chapter_data.location_slug],
                chapter_data.title,
                position,
            )
            if chapter_row is None:
                chapter_row = Chapter(
                    slug=chapter_data.slug,
                    location_id=chapter_values[0],
                    title=chapter_values[1],
                    position=chapter_values[2],
                )
                session.add(chapter_row)
                await session.flush()
                counts.inserted += 1
            else:
                if (
                    chapter_row.location_id,
                    chapter_row.title,
                    chapter_row.position,
                ) != chapter_values:
                    chapter_row.location_id, chapter_row.title, chapter_row.position = (
                        chapter_values
                    )
                    counts.updated += 1
            chapter_ids[chapter_data.slug] = chapter_row.id
        counts.stale += len(
            set(chapters) - {chapter_data.slug for chapter_data in content.chapters}
        )

        words: dict[int, VocabularyItem] = {
            word.number: word for word in (await session.scalars(select(VocabularyItem))).all()
        }
        file_numbers: set[int] = set()
        for chapter_data in content.chapters:
            for position, word_data in enumerate(chapter_data.words, 1):
                file_numbers.add(word_data.number)
                word_row = words.get(word_data.number)
                word_values = (
                    chapter_ids[chapter_data.slug],
                    word_data.text,
                    word_data.note,
                    position,
                )
                if word_row is None:
                    session.add(
                        VocabularyItem(
                            number=word_data.number,
                            chapter_id=word_values[0],
                            text=word_values[1],
                            note=word_values[2],
                            position=word_values[3],
                        )
                    )
                    counts.inserted += 1
                else:
                    if (
                        word_row.chapter_id,
                        word_row.text,
                        word_row.note,
                        word_row.position,
                    ) != word_values:
                        word_row.chapter_id, word_row.text, word_row.note, word_row.position = (
                            word_values
                        )
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
