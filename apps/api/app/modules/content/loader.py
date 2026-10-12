"""Pure, database-independent loader for the recording-list content manifest."""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Never

DEFAULT_CONTENT_PATH = Path(__file__).parent / "data" / "content.json"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


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


def _fail(where: str, message: str) -> Never:
    raise ValueError(f"{where}: {message}")


def _obj(value: Any, where: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(where, "expected object")
    return value


def _list(value: Any, where: str) -> list[Any]:
    if not isinstance(value, list):
        _fail(where, "expected array")
    return value


def _string(obj: dict[str, Any], key: str, where: str) -> str:
    value = obj.get(key)
    if not isinstance(value, str):
        _fail(f"{where}.{key}", "expected non-empty string")
        raise ValueError(f"{where}.{key}: expected non-empty string")
    if not value.strip():
        _fail(f"{where}.{key}", "expected non-empty string")
    if unicodedata.normalize("NFC", value) != value:
        _fail(f"{where}.{key}", "text must be Unicode NFC")
    return value


def _slug(obj: dict[str, Any], key: str, where: str) -> str:
    value = _string(obj, key, where)
    if not SLUG_RE.fullmatch(value):
        _fail(f"{where}.{key}", f"invalid slug {value!r}")
    return value


def parse_content(data: Any) -> Content:
    """Validate arbitrary decoded JSON and return typed immutable domain objects."""
    data = _obj(data, "content")
    start = _slug(data, "starting_location", "content")
    regions: list[Region] = []
    locations: list[Location] = []
    chapters: list[Chapter] = []
    used_slugs: set[str] = set()

    def register_slug(slug: str, where: str) -> None:
        if slug in used_slugs:
            _fail(where, f"duplicate slug {slug!r}")
        used_slugs.add(slug)

    for i, raw in enumerate(_list(data.get("regions"), "regions")):
        where = f"regions[{i}]"
        item = _obj(raw, where)
        slug = _slug(item, "slug", where)
        register_slug(slug, where)
        regions.append(Region(slug=slug, name=_string(item, "name", where)))
    if len(regions) != 3:
        _fail("regions", f"expected 3 regions, got {len(regions)}")
    region_ids = {region.slug for region in regions}

    for i, raw in enumerate(_list(data.get("locations"), "locations")):
        where = f"locations[{i}]"
        item = _obj(raw, where)
        slug = _slug(item, "slug", where)
        register_slug(slug, where)
        region_slug = _slug(item, "region_slug", where)
        if region_slug not in region_ids:
            _fail(where, f"unknown region {region_slug!r}")
        starting = item.get("is_starting")
        if type(starting) is not bool:
            _fail(f"{where}.is_starting", "expected boolean")
        locations.append(Location(slug, _string(item, "name", where), region_slug, starting))
    if len(locations) != 17:
        _fail("locations", f"expected 17 locations, got {len(locations)}")
    location_ids = {loc.slug for loc in locations}
    marked = [loc.slug for loc in locations if loc.is_starting]
    if len(marked) != 1 or marked[0] != start:
        _fail(
            "starting_location",
            f"expected exactly one starting location matching {start!r}, got {marked!r}",
        )
    if start != "budva":
        _fail("starting_location", "phase 1 must start at 'budva'")

    numbers: list[int] = []
    words_by_text: dict[str, Word] = {}
    for i, raw in enumerate(_list(data.get("chapters"), "chapters")):
        where = f"chapters[{i}]"
        item = _obj(raw, where)
        slug = _slug(item, "slug", where)
        register_slug(slug, where)
        title = _string(item, "title", where)
        location_slug = _slug(item, "location_slug", where)
        if location_slug not in location_ids:
            _fail(where, f"chapter {slug!r} points to unknown location {location_slug!r}")
        chapter_words: list[Word] = []
        for j, raw_word in enumerate(_list(item.get("words"), f"{where}.words")):
            word_where = f"{where}.words[{j}]"
            word_data = _obj(raw_word, word_where)
            number = word_data.get("number")
            if type(number) is not int or not 1 <= number <= 300:
                _fail(f"{word_where}.number", f"invalid word number {number!r}")
            value = _string(word_data, "text", word_where)
            note = word_data.get("note")
            if note is not None:
                note = _string(word_data, "note", word_where)
            word = Word(number, value, note)
            prior = words_by_text.get(value.casefold())
            if prior is not None and (prior.note is None or note is None):
                _fail(
                    word_where,
                    f"repeated word {value!r} (numbers {prior.number} and {number}) without notes",
                )
            words_by_text[value.casefold()] = word
            numbers.append(number)
            chapter_words.append(word)
        if len(chapter_words) != 10:
            _fail(
                f"{where}.words",
                f"chapter {slug!r} must contain 10 words, got {len(chapter_words)}",
            )
        chapters.append(Chapter(slug, title, location_slug, tuple(chapter_words)))
    if len(chapters) != 30:
        _fail("chapters", f"expected 30 chapters, got {len(chapters)}")
    if numbers != list(range(1, 301)):
        missing = sorted(set(range(1, 301)) - set(numbers))
        repeated = sorted({n for n in numbers if numbers.count(n) > 1})
        _fail(
            "chapters.words",
            f"recording numbers must be 1..300 in order; missing={missing}, repeated={repeated}",
        )
    location_region = {loc.slug: loc.region_slug for loc in locations}
    for region in regions:
        count = sum(location_region[c.location_slug] == region.slug for c in chapters)
        if count != 10:
            _fail(f"regions[{region.slug}]", f"expected 10 chapters, got {count}")
    by_number = {word.number: word for chapter in chapters for word in chapter.words}
    for number, expected_text, expected_note in (
        (30, "zvijezda", "morska zvijezda"),
        (86, "zmaj", "igračka koja leti"),
    ):
        word = by_number[number]
        if (word.text, word.note) != (expected_text, expected_note):
            _fail(f"word[{number}]", f"expected text {expected_text!r} and note {expected_note!r}")
    return Content(start, tuple(regions), tuple(locations), tuple(chapters))


def load_content(path: str | Path = DEFAULT_CONTENT_PATH) -> Content:
    """Read UTF-8 JSON without I/O side effects beyond reading the supplied path."""
    path = Path(path)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: cannot load content: {exc}") from exc
    return parse_content(raw)
