from __future__ import annotations

import copy
import json
import re
import unicodedata
from collections import Counter
from collections.abc import Callable
from typing import Any

import pytest

from app.modules.content.loader import (
    DEFAULT_CONTENT_PATH,
    SLUG_RE,
    load_content,
    parse_content,
)

ContentData = dict[str, Any]
ContentEdit = Callable[[ContentData], None]


def make_content_data() -> ContentData:
    """Return an independent copy of the source JSON data."""
    return json.loads(DEFAULT_CONTENT_PATH.read_text(encoding="utf-8"))


def test_source_manifest_counts_numbers_chapters_regions() -> None:
    content = load_content()

    assert len(content.regions) == 3
    assert len(content.locations) == 17
    assert len(content.chapters) == 30

    numbers = [word.number for chapter in content.chapters for word in chapter.words]
    assert numbers == list(range(1, 301))
    assert all(len(chapter.words) == 10 for chapter in content.chapters)

    location_regions = {location.slug: location.region_slug for location in content.locations}
    assert Counter(location_regions[chapter.location_slug] for chapter in content.chapters) == {
        "coast": 10,
        "central": 10,
        "north": 10,
    }


def test_slug_references_and_start() -> None:
    content = load_content()

    slugs = [
        item.slug
        for item in (
            *content.regions,
            *content.locations,
            *content.chapters,
        )
    ]

    assert len(slugs) == len(set(slugs))
    assert all(SLUG_RE.fullmatch(slug) for slug in slugs)

    location_slugs = {location.slug for location in content.locations}
    assert all(chapter.location_slug in location_slugs for chapter in content.chapters)

    assert content.starting_location == "budva"
    assert [location.slug for location in content.locations if location.is_starting] == ["budva"]


def test_slug_pattern_matches_database_contract() -> None:
    """Slug validation must match the contract from Issue #58."""
    assert SLUG_RE.pattern == r"^[a-z][a-z0-9-]*$"
    assert SLUG_RE.fullmatch("budva")
    assert SLUG_RE.fullmatch("herceg-novi")
    assert SLUG_RE.fullmatch("1bad") is None
    assert SLUG_RE.fullmatch("Bad-Slug") is None


def test_words_nfc_unique_and_notes() -> None:
    content = load_content()
    words = [word for chapter in content.chapters for word in chapter.words]

    assert len(words) == 300

    assert all(
        unicodedata.is_normalized("NFC", text)
        for word in words
        for text in (word.text, *([word.note] if word.note else []))
    )

    by_number = {word.number: word for word in words}

    assert by_number[30].text == "zvijezda"
    assert by_number[30].note == "morska zvijezda"
    assert by_number[86].text == "zmaj"
    assert by_number[86].note == "igračka koja leti"

    # Repeated word text is valid only when both entries carry notes.
    by_text: dict[str, list[str | None]] = {}
    for word in words:
        by_text.setdefault(word.text.casefold(), []).append(word.note)

    assert all(
        len(notes) == 1 or all(note is not None for note in notes) for notes in by_text.values()
    )


def test_loader_accepts_moved_starting_location() -> None:
    content_data = make_content_data()

    old_start = next(location for location in content_data["locations"] if location["is_starting"])
    new_start = next(
        location for location in content_data["locations"] if location["slug"] == "kotor"
    )

    old_start["is_starting"] = False
    new_start["is_starting"] = True
    content_data["starting_location"] = "kotor"

    content = parse_content(content_data)

    assert content.starting_location == "kotor"
    assert [location.slug for location in content.locations if location.is_starting] == ["kotor"]


def test_loader_accepts_removed_chapter() -> None:
    content_data = make_content_data()
    removed = content_data["chapters"].pop()

    content = parse_content(content_data)

    assert len(content.chapters) == 29
    assert removed["slug"] not in {chapter.slug for chapter in content.chapters}


def test_loader_accepts_changed_word_text_and_note() -> None:
    content_data = make_content_data()

    word = content_data["chapters"][2]["words"][-1]
    assert word["number"] == 30

    word["text"] = "morska zvijezda"
    word["note"] = "životinja u moru"

    content = parse_content(content_data)
    words = [entry for chapter in content.chapters for entry in chapter.words]
    updated = next(entry for entry in words if entry.number == 30)

    assert updated.text == "morska zvijezda"
    assert updated.note == "životinja u moru"


@pytest.mark.parametrize(
    ("edit", "expected"),
    [
        (
            lambda data: data["chapters"][0]["words"][0].update(number=4),
            "duplicate recording number",
        ),
        (
            lambda data: data["locations"][0].update(slug="Bad Slug"),
            "locations[0].slug",
        ),
        (
            lambda data: data["locations"][0].update(slug="1bad"),
            "locations[0].slug",
        ),
        (
            lambda data: data["chapters"][0].update(location_slug="does-not-exist"),
            "chapters[0]",
        ),
        (
            lambda data: data["locations"][1].update(is_starting=True),
            "starting_location",
        ),
        (
            lambda data: data["chapters"][1]["words"][0].update(text="more"),
            "repeated word",
        ),
        (
            lambda data: data["chapters"][0]["words"][0].update(text="plaz\u030ca"),
            "Unicode NFC",
        ),
    ],
)
def test_invalid_entries_report_location(
    edit: ContentEdit,
    expected: str,
) -> None:
    bad = copy.deepcopy(make_content_data())
    edit(bad)

    with pytest.raises(ValueError, match=re.escape(expected)):
        parse_content(bad)
