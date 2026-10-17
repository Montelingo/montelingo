from __future__ import annotations

from dataclasses import dataclass


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
