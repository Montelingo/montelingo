from __future__ import annotations

import pytest

from app.modules.content.media import word_image_url


@pytest.mark.parametrize(
    ("number", "expected"),
    [
        (1, "/media/words/0001.webp"),
        (10, "/media/words/0010.webp"),
        (11, None),
        (300, None),
    ],
)
def test_word_image_url(number: int, expected: str | None) -> None:
    assert word_image_url(number) == expected
