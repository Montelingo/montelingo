from __future__ import annotations

from typing import Annotated

from pydantic import Field
from pydantic.types import StringConstraints

from app.schemas.common import ApiSchema, UUIDString

# Content is identified by its slug, which the API exposes as `id` (ADR 0005).
Slug = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9-]*$")]


class RegionSummary(ApiSchema):
    id: Slug
    name: str
    location_count: int = Field(ge=0)


class LocationSummary(ApiSchema):
    id: Slug
    name: str
    region_id: Slug
    chapter_count: int = Field(ge=0)
    word_count: int = Field(ge=0)


class RegionDetail(ApiSchema):
    id: Slug
    name: str
    locations: list[LocationSummary]


class Word(ApiSchema):
    id: UUIDString
    number: int = Field(ge=1, description="Recording number (1-300), also the audio file name.")
    text: str
    note: str | None
    # Always null in phase 1. Media storage arrives in phase 2 (ADR 0005).
    image_url: str | None
    audio_url: str | None


class Chapter(ApiSchema):
    id: Slug
    title: str
    position: int = Field(ge=1, description="Recording order (1-30).")
    words: list[Word]


class LocationDetail(ApiSchema):
    id: Slug
    name: str
    region_id: Slug
    chapters: list[Chapter]
