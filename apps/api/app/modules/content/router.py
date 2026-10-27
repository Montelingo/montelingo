from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.db.session import get_db_session
from app.modules.auth import get_current_user
from app.schemas.common import PageInfo, PaginatedResponse

from . import domain
from .repository import SqlAlchemyContentRepository
from .schemas import Chapter as ChapterSchema
from .schemas import (
    LocationDetail,
    LocationSummary,
    RegionDetail,
    RegionSummary,
    Slug,
)
from .schemas import (
    Word as WordSchema,
)
from .service import ContentService

CACHE_CONTROL = "private, max-age=300"


def set_content_cache(response: Response) -> None:
    response.headers["Cache-Control"] = CACHE_CONTROL


router = APIRouter(
    dependencies=[Depends(get_current_user), Depends(set_content_cache)]
)


def get_content_service(
    session: AsyncSession = Depends(get_db_session),
) -> ContentService:
    return ContentService(repository=SqlAlchemyContentRepository(session))


def _region_summary(item: domain.RegionSummaryRead) -> RegionSummary:
    return RegionSummary(
        id=item.slug,
        name=item.name,
        location_count=item.location_count,
    )


def _location_summary(item: domain.LocationSummaryRead) -> LocationSummary:
    return LocationSummary(
        id=item.slug,
        name=item.name,
        region_id=item.region_slug,
        chapter_count=item.chapter_count,
        word_count=item.word_count,
    )


def _chapter(item: domain.ChapterRead) -> ChapterSchema:
    return ChapterSchema(
        id=item.slug,
        title=item.title,
        position=item.position,
        words=[
            WordSchema(
                id=str(word.id),
                number=word.number,
                text=word.text,
                note=word.note,
                image_url=None,
                audio_url=None,
            )
            for word in item.words
        ],
    )


@router.get(
    "/regions",
    operation_id="content_list_regions",
    response_model=PaginatedResponse[RegionSummary],
    responses=error_responses(401),
)
async def list_regions(
    service: ContentService = Depends(get_content_service),
) -> PaginatedResponse[RegionSummary]:
    items = await service.list_regions()
    return PaginatedResponse[RegionSummary](
        items=[_region_summary(item) for item in items],
        page=PageInfo(next_cursor=None, has_more=False),
    )


@router.get(
    "/regions/{region_id}",
    operation_id="content_get_region",
    response_model=RegionDetail,
    responses=error_responses(401, 404, 422),
)
async def get_region(
    region_id: Slug,
    service: ContentService = Depends(get_content_service),
) -> RegionDetail:
    result = await service.get_region(region_id)
    return RegionDetail(
        id=result.slug,
        name=result.name,
        locations=[_location_summary(item) for item in result.locations],
    )


@router.get(
    "/locations/{location_id}",
    operation_id="content_get_location",
    response_model=LocationDetail,
    responses=error_responses(401, 404, 422),
)
async def get_location(
    location_id: Slug,
    service: ContentService = Depends(get_content_service),
) -> LocationDetail:
    result = await service.get_location(location_id)
    return LocationDetail(
        id=result.slug,
        name=result.name,
        region_id=result.region_slug,
        chapters=[_chapter(item) for item in result.chapters],
    )
