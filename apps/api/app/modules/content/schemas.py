from __future__ import annotations

from typing import Annotated

from pydantic import Field
from pydantic.types import StringConstraints

from app.schemas.common import ApiSchema, UUIDString

from .domain import WordRead
from .media import word_image_url, word_image_url_512

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
    image_url: str | None = Field(
        description="The 1024 px picture, for the lesson's big card. Null when the word has none."
    )
    image_url_512: str | None = Field(
        description="The 512 px picture, for the boards and word cards. Null when image_url is."
    )
    audio_url: str | None

    @classmethod
    def from_read(cls, word: WordRead) -> Word:
        """The API word for a stored one, with its image URL if it has a picture."""

        return cls(
            id=str(word.id),
            number=word.number,
            text=word.text,
            note=word.note,
            image_url=word_image_url(word.number),
            image_url_512=word_image_url_512(word.number),
            audio_url=None,
        )


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
