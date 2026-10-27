from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class Region:
    slug: str
    name: str


@dataclass(frozen=True, slots=True)
class Location:
    slug: str
    name: str
    region_slug: str
    is_starting: bool


@dataclass(frozen=True, slots=True)
class Word:
    number: int
    text: str
    note: str | None = None


@dataclass(frozen=True, slots=True)
class Chapter:
    slug: str
    title: str
    location_slug: str
    words: tuple[Word, ...]


@dataclass(frozen=True, slots=True)
class Content:
    starting_location: str
    regions: tuple[Region, ...]
    locations: tuple[Location, ...]
    chapters: tuple[Chapter, ...]


# Read-side domain objects. The public content/loader contract above is unchanged.
@dataclass(frozen=True, slots=True)
class RegionSummaryRead:
    slug: str
    name: str
    location_count: int


@dataclass(frozen=True, slots=True)
class RegionRecord:
    id: UUID
    slug: str
    name: str


@dataclass(frozen=True, slots=True)
class LocationSummaryRead:
    slug: str
    name: str
    region_slug: str
    chapter_count: int
    word_count: int


@dataclass(frozen=True, slots=True)
class RegionDetailRead:
    slug: str
    name: str
    locations: tuple[LocationSummaryRead, ...]


@dataclass(frozen=True, slots=True)
class LocationRecord:
    id: UUID
    slug: str
    name: str
    region_slug: str


@dataclass(frozen=True, slots=True)
class WordRead:
    id: UUID
    number: int
    text: str
    note: str | None


@dataclass(frozen=True, slots=True)
class ChapterRead:
    slug: str
    title: str
    position: int
    words: tuple[WordRead, ...]


@dataclass(frozen=True, slots=True)
class LocationDetailRead:
    slug: str
    name: str
    region_slug: str
    chapters: tuple[ChapterRead, ...]
