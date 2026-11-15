"""Where a word's media is served from.

Word images are static files in the web app, `apps/web/public/media/words/`,
named by the word's recording number (word 1 is `0001.webp`), so the URL is
same-origin and stable across environments. Only the words listed here have
an image; every other word keeps `image_url: null` and the web's placeholder.
Add a word's number here when its image file is added.
"""

from __future__ import annotations

WORD_IMAGES: frozenset[int] = frozenset(
    [
        *range(1, 11),  # Na plaži (Budva), #127
        *range(61, 71),  # Ljeto i odjeća (Budva)
    ]
)
"""Recording numbers of the words that have an image."""


def word_image_url(number: int) -> str | None:
    """The image URL for a word's recording number, or None if it has none."""

    if number not in WORD_IMAGES:
        return None
    return f"/media/words/{number:04}.webp"
