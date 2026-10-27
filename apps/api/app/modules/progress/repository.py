"""Progress persistence, always scoped by learning_profile_id. Arrives with #64 and #66."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.domain import (
    Content,
)
from app.modules.content.domain import (
    Location as ContentLocation,
)
from app.modules.content.domain import (
    Region as ContentRegion,
)
from app.modules.content.models import Location, Region

from .domain import LocationProgressRecord
from .models import LocationProgress


class ProgressRepository(Protocol):
    async def read_map(
        self,
        learning_profile_id: UUID,
    ) -> tuple[Content, list[LocationProgressRecord]]: ...


class SqlAlchemyProgressRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def read_map(
        self,
        learning_profile_id: UUID,
    ) -> tuple[Content, list[LocationProgressRecord]]:
        region_result = await self.session.execute(
            select(Region.slug, Region.name).order_by(Region.position)
        )

        regions = tuple(ContentRegion(slug=slug, name=name) for slug, name in region_result.all())

        location_result = await self.session.execute(
            select(
                Location.slug,
                Location.name,
                Region.slug.label("region_slug"),
                Location.is_start,
            )
            .join(Region, Region.id == Location.region_id)
            .order_by(Region.position, Location.position)
        )

        locations = tuple(
            ContentLocation(
                slug=slug,
                name=name,
                region_slug=region_slug,
                is_starting=is_start,
            )
            for slug, name, region_slug, is_start in location_result.all()
        )

        progress_result = await self.session.execute(
            select(
                Location.slug,
                LocationProgress.started_at,
                LocationProgress.completed_at,
            )
            .join(
                Location,
                Location.id == LocationProgress.location_id,
            )
            .where(LocationProgress.learning_profile_id == learning_profile_id)
        )

        progress = [
            LocationProgressRecord(
                location_slug=slug,
                started_at=started_at,
                completed_at=completed_at,
            )
            for slug, started_at, completed_at in progress_result.all()
        ]

        starting_location = next(
            (location.slug for location in locations if location.is_starting),
            "",
        )

        content = Content(
            starting_location=starting_location,
            regions=regions,
            locations=locations,
            chapters=(),
        )

        return content, progress
