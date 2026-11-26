"""Where a word's media is served from.

Word images are static files in the web app, `apps/web/public/media/words/`,
named by the word's recording number (word 1 is `0001.webp`), so the URL is
same-origin and stable across environments. Only the words listed here have
an image; every other word keeps `image_url: null` and the web's placeholder.
Add a word's number here when its image file is added.

The URL carries a version, `?v=<hash>`: the first 8 hex characters of the
file's SHA-256, from `media_hashes.json`, which `scripts/word-images.sh`
writes. The web app caches the files for a year, so a redrawn image must get
a new URL (docs/architecture/word-images.md, section 3).
"""

from __future__ import annotations

import json
from pathlib import Path

WORD_IMAGES: frozenset[int] = frozenset(
    [
        *range(1, 11),  # Na plaži (Budva), #127
        *range(11, 21),  # U luci (Kotor), #188
        *range(21, 31),  # Morske životinje (Ulcinj), #189
        *range(31, 41),  # Šetnja uz more (Herceg Novi), #190
        *range(41, 51),  # Putujemo (Tivat), #191
        *range(51, 61),  # Voće na pijaci (Bar), #192
        *range(61, 71),  # Ljeto i odjeća (Budva)
        *range(71, 81),  # Boje oko nas (Kotor), #188
        *range(81, 91),  # Igramo se (Ulcinj), #189
        *range(91, 101),  # Šta radimo na obali (Herceg Novi), #190
        *range(101, 111),  # Kod kuće (Podgorica), #193
        *range(111, 121),  # Porodica (Cetinje), #194
        *range(121, 131),  # Za stolom (Nikšić), #195
        *range(131, 141),  # Povrće i ručak (Podgorica), #193
        *range(141, 151),  # U kuhinji (Podgorica), #193
        *range(151, 161),  # Moje tijelo (Cetinje), #194
        *range(161, 171),  # Oblačimo se (Danilovgrad), #196
        *range(171, 181),  # U vrtiću (Podgorica), #193
        *range(181, 191),  # Muzika i slavlje (Cetinje), #194
        *range(191, 201),  # Pored jezera (Skadarsko jezero), #197
    ]
)
"""Recording numbers of the words that have an image."""

MEDIA_HASHES_PATH = Path(__file__).parent / "media_hashes.json"

ImageHashes = dict[str, dict[str, str]]
"""Four-digit word number -> {"1024": hash of NNNN.webp, "512": hash of NNNN-512.webp}."""

MEDIA_HASHES: ImageHashes = json.loads(MEDIA_HASHES_PATH.read_text(encoding="utf-8"))


def word_image_url(number: int) -> str | None:
    """The image URL for a word's recording number, or None if it has none."""

    if number not in WORD_IMAGES:
        return None
    name = f"{number:04}"
    return f"/media/words/{name}.webp?v={MEDIA_HASHES[name]['1024']}"
