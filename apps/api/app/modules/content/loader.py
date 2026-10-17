from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Never

from app.modules.content.domain import Chapter, Content, Location, Region, Word

DEFAULT_CONTENT_PATH = Path(__file__).parent / "data" / "content.json"
SLUG_RE = re.compile(r"^[a-z][a-z0-9-]*$")


def _fail(where: str, message: str) -> Never:
    raise ValueError(f"{where}: {message}")


def _obj(value: Any, where: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(where, "expected object")
    return value


def _check_keys(obj: dict[str, Any], allowed: set[str], where: str) -> None:
    unknown = set(obj) - allowed
    if unknown:
        _fail(where, f"unknown keys: {sorted(unknown)!r}")


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}

    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key {key!r}")
        result[key] = value

    return result


def _list(value: Any, where: str) -> list[Any]:
    if not isinstance(value, list):
        _fail(where, "expected array")
    return value


def _string(obj: dict[str, Any], key: str, where: str) -> str:
    value = obj.get(key)

    if not isinstance(value, str) or not value.strip():
        _fail(f"{where}.{key}", "expected non-empty string")

    if value != value.strip():
        _fail(f"{where}.{key}", "leading or trailing whitespace is not allowed")

    if unicodedata.normalize("NFC", value) != value:
        _fail(f"{where}.{key}", "text must be Unicode NFC")

    return value


def _slug(obj: dict[str, Any], key: str, where: str) -> str:
    value = _string(obj, key, where)
    if not SLUG_RE.fullmatch(value):
        _fail(f"{where}.{key}", f"invalid slug {value!r}")
    return value


def _register_slug(slug: str, used_slugs: set[str], where: str) -> None:
    if slug in used_slugs:
        _fail(where, f"duplicate slug {slug!r}")
    used_slugs.add(slug)


def _parse_regions(
    data: dict[str, Any],
    used_slugs: set[str],
) -> tuple[Region, ...]:
    regions: list[Region] = []

    for index, raw in enumerate(_list(data.get("regions"), "regions")):
        where = f"regions[{index}]"
        item = _obj(raw, where)
        _check_keys(item, {"slug", "name"}, where)
        slug = _slug(item, "slug", where)
        _register_slug(slug, used_slugs, where)

        regions.append(
            Region(
                slug=slug,
                name=_string(item, "name", where),
            )
        )

    return tuple(regions)


def _parse_locations(
    data: dict[str, Any],
    region_slugs: set[str],
    used_slugs: set[str],
) -> tuple[Location, ...]:
    locations: list[Location] = []

    for index, raw in enumerate(_list(data.get("locations"), "locations")):
        where = f"locations[{index}]"
        item = _obj(raw, where)
        _check_keys(item, {"slug", "name", "region_slug", "is_starting"}, where)
        slug = _slug(item, "slug", where)
        _register_slug(slug, used_slugs, where)

        region_slug = _slug(item, "region_slug", where)
        if region_slug not in region_slugs:
            _fail(where, f"unknown region {region_slug!r}")

        is_starting = item.get("is_starting")
        if not isinstance(is_starting, bool):
            _fail(f"{where}.is_starting", "expected boolean")

        locations.append(
            Location(
                slug=slug,
                name=_string(item, "name", where),
                region_slug=region_slug,
                is_starting=is_starting,
            )
        )

    return tuple(locations)


def _parse_word(
    raw: Any,
    where: str,
    used_numbers: set[int],
    words_by_text: dict[str, list[Word]],
) -> Word:
    item = _obj(raw, where)
    _check_keys(item, {"number", "text", "note"}, where)

    number = item.get("number")

    if type(number) is not int or number < 1:
        _fail(f"{where}.number", f"invalid word number {number!r}")

    if number in used_numbers:
        _fail(f"{where}.number", f"duplicate recording number {number}")

    word_text = _string(item, "text", where)

    note = None
    if "note" in item and item["note"] is not None:
        note = _string(item, "note", where)

    previous_words = words_by_text.get(word_text.casefold(), [])

    for previous in previous_words:
        if previous.note is None or note is None:
            _fail(
                where,
                f"repeated word {word_text!r} "
                f"(numbers {previous.number} and {number}) without notes",
            )

        if previous.note.casefold() == note.casefold():
            _fail(
                where,
                f"repeated word {word_text!r} "
                f"(numbers {previous.number} and {number}) with identical notes",
            )

    word = Word(number=number, text=word_text, note=note)
    used_numbers.add(number)
    words_by_text.setdefault(word_text.casefold(), []).append(word)
    return word


def _parse_chapters(
    data: dict[str, Any],
    location_slugs: set[str],
    used_slugs: set[str],
) -> tuple[Chapter, ...]:
    chapters: list[Chapter] = []
    used_numbers: set[int] = set()
    words_by_text: dict[str, list[Word]] = {}

    for index, raw in enumerate(_list(data.get("chapters"), "chapters")):
        where = f"chapters[{index}]"
        item = _obj(raw, where)
        _check_keys(item, {"slug", "title", "location_slug", "words"}, where)
        slug = _slug(item, "slug", where)
        _register_slug(slug, used_slugs, where)

        title = _string(item, "title", where)
        location_slug = _slug(item, "location_slug", where)
        if location_slug not in location_slugs:
            _fail(
                where,
                f"chapter {slug!r} points to unknown location {location_slug!r}",
            )

        words = tuple(
            _parse_word(
                raw_word,
                f"{where}.words[{word_index}]",
                used_numbers,
                words_by_text,
            )
            for word_index, raw_word in enumerate(_list(item.get("words"), f"{where}.words"))
        )

        chapters.append(
            Chapter(
                slug=slug,
                title=title,
                location_slug=location_slug,
                words=words,
            )
        )

    return tuple(chapters)


def parse_content(data: Any) -> Content:
    """Validate decoded JSON and return typed immutable domain objects."""
    content_data = _obj(data, "content")

    _check_keys(
        content_data,
        {"starting_location", "regions", "locations", "chapters"},
        "content",
    )

    starting_location_slug = _slug(
        content_data,
        "starting_location",
        "content",
    )

    used_slugs: set[str] = set()

    regions = _parse_regions(content_data, used_slugs)
    region_slugs = {region.slug for region in regions}

    locations = _parse_locations(
        content_data,
        region_slugs,
        used_slugs,
    )
    location_slugs = {location.slug for location in locations}

    starting_locations = [location.slug for location in locations if location.is_starting]
    if len(starting_locations) != 1 or starting_locations[0] != starting_location_slug:
        _fail(
            "starting_location",
            "expected exactly one starting location matching "
            f"{starting_location_slug!r}, got {starting_locations!r}",
        )

    chapters = _parse_chapters(
        content_data,
        location_slugs,
        used_slugs,
    )

    return Content(
        starting_location=starting_location_slug,
        regions=regions,
        locations=locations,
        chapters=chapters,
    )


def load_content(path: str | Path = DEFAULT_CONTENT_PATH) -> Content:
    """Read a UTF-8 JSON file and validate its content."""
    path = Path(path)

    try:
        raw = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
        )
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: cannot load content: {exc}") from exc

    return parse_content(raw)
