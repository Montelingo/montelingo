from __future__ import annotations

import copy
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pytest

from app.modules.content.loader import load_content, parse_content

DATA_PATH = (
    Path(__file__).resolve().parents[4] / "app" / "modules" / "content" / "data" / "content.json"
)


def data() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def test_source_manifest_counts_numbers_chapters_regions():
    content = load_content(DATA_PATH)
    assert len(content.regions) == 3
    assert len(content.locations) == 17
    assert len(content.chapters) == 30
    assert [word.number for ch in content.chapters for word in ch.words] == list(range(1, 301))
    assert all(len(ch.words) == 10 for ch in content.chapters)
    membership = {loc.slug: loc.region_slug for loc in content.locations}
    assert Counter(membership[ch.location_slug] for ch in content.chapters) == {
        "coast": 10,
        "central": 10,
        "north": 10,
    }


def test_slug_references_and_start():
    content = load_content(DATA_PATH)
    slugs = [x.slug for x in (*content.regions, *content.locations, *content.chapters)]
    assert len(slugs) == len(set(slugs))
    assert all(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", s) for s in slugs)
    assert {ch.location_slug for ch in content.chapters} <= {loc.slug for loc in content.locations}
    assert content.starting_location == "budva"
    assert [loc.slug for loc in content.locations if loc.is_starting] == ["budva"]


def test_words_nfc_unique_and_notes():
    content = load_content(DATA_PATH)
    words = [w for ch in content.chapters for w in ch.words]
    assert all(
        unicodedata.is_normalized("NFC", s)
        for w in words
        for s in (w.text, *([w.note] if w.note else []))
    )
    assert len({w.text.casefold() for w in words}) == 300
    assert {w.number: w.note for w in words if w.note} == {
        30: "morska zvijezda",
        86: "igračka koja leti",
    }


@pytest.mark.parametrize(
    "edit,expected",
    [
        (lambda d: d["chapters"][0]["words"][0].update(number=4), "recording numbers"),
        (lambda d: d["chapters"][0]["words"].pop(), "chapters[0].words"),
        (lambda d: d["locations"][0].update(slug="Bad Slug"), "locations[0].slug"),
        (lambda d: d["chapters"][0].update(location_slug="does-not-exist"), "chapters[0]"),
        (lambda d: d["locations"][1].update(is_starting=True), "starting_location"),
        (lambda d: d["chapters"][1]["words"][0].update(text="more"), "repeated word"),
        (lambda d: d["chapters"][0]["words"][0].update(text="plaz\u030ca"), "Unicode NFC"),
    ],
)
def test_invalid_entries_report_location(edit, expected):
    bad = copy.deepcopy(data())
    edit(bad)
    with pytest.raises(ValueError, match=re.escape(expected)):
        parse_content(bad)
