from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.modules.content.loader import load_content
from app.modules.content.media import WORD_IMAGES, word_image_url

# apps/api/tests/unit/modules/content/test_media.py -> repository root.
REPO_ROOT = Path(__file__).resolve().parents[6]
WORD_IMAGES_DIR = REPO_ROOT / "apps" / "web" / "public" / "media" / "words"
IMAGE_FILE_RE = re.compile(r"(\d{4})\.webp")


@pytest.mark.parametrize(
    ("number", "expected"),
    [
        (1, "/media/words/0001.webp"),
        (10, "/media/words/0010.webp"),
        (11, None),
        (60, None),
        (61, "/media/words/0061.webp"),
        (70, "/media/words/0070.webp"),
        (71, None),
        (300, None),
    ],
)
def test_word_image_url(number: int, expected: str | None) -> None:
    assert word_image_url(number) == expected


def image_file_numbers(folder: Path) -> set[int]:
    """Recording numbers of the `NNNN.webp` files in `folder`; other files are ignored."""

    return {
        int(match.group(1))
        for path in folder.iterdir()
        if path.is_file() and (match := IMAGE_FILE_RE.fullmatch(path.name))
    }


def test_image_file_numbers_reads_only_nnnn_webp(tmp_path: Path) -> None:
    for name in ("0001.webp", "0070.webp", "README.md", "0002.png", "3.webp"):
        (tmp_path / name).write_bytes(b"")
    (tmp_path / "0004.webp").mkdir()

    assert image_file_numbers(tmp_path) == {1, 70}


@pytest.fixture
def web_image_numbers() -> set[int]:
    if not WORD_IMAGES_DIR.is_dir():
        pytest.skip(
            f"{WORD_IMAGES_DIR} is missing: the web app is not in this checkout "
            "(as in the API's Docker image), so the word image files cannot be checked"
        )
    return image_file_numbers(WORD_IMAGES_DIR)


def test_every_word_image_number_has_a_file(web_image_numbers: set[int]) -> None:
    missing = sorted(WORD_IMAGES - web_image_numbers)

    assert not missing, (
        f"WORD_IMAGES lists {missing} but {WORD_IMAGES_DIR} has no "
        f"{', '.join(f'{number:04}.webp' for number in missing)}. "
        "Add the image file or remove the number from WORD_IMAGES."
    )


def test_every_word_image_file_is_in_word_images(web_image_numbers: set[int]) -> None:
    unlisted = sorted(web_image_numbers - WORD_IMAGES)

    assert not unlisted, (
        f"{WORD_IMAGES_DIR} has {', '.join(f'{number:04}.webp' for number in unlisted)} "
        f"but WORD_IMAGES does not list {unlisted}. "
        "Add the number to WORD_IMAGES in app/modules/content/media.py."
    )


def test_every_word_image_number_is_a_word_in_content() -> None:
    content = load_content()
    word_numbers = {word.number for chapter in content.chapters for word in chapter.words}
    unknown = sorted(WORD_IMAGES - word_numbers)

    assert not unknown, f"WORD_IMAGES lists {unknown}, which are not words in content.json."
