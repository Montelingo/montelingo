from __future__ import annotations

import re
import struct
from dataclasses import dataclass
from pathlib import Path

import pytest

from app.modules.content.loader import load_content
from app.modules.content.media import WORD_IMAGES, word_image_url

# apps/api/tests/unit/modules/content/test_media.py -> repository root.
REPO_ROOT = Path(__file__).resolve().parents[6]
WORD_IMAGES_DIR = REPO_ROOT / "apps" / "web" / "public" / "media" / "words"
IMAGE_FILE_RE = re.compile(r"(\d{4})(-512)?\.webp")

# Each word has two variants (scripts/word-images.sh): file suffix -> (pixels, byte budget).
VARIANTS: dict[str, tuple[int, int]] = {
    "": (1024, 80 * 1024),
    "-512": (512, 30 * 1024),
}


@pytest.mark.parametrize(
    ("number", "expected"),
    [
        (1, "/media/words/0001.webp"),
        (10, "/media/words/0010.webp"),
        (11, "/media/words/0011.webp"),
        (20, "/media/words/0020.webp"),
        (21, "/media/words/0021.webp"),
        (30, "/media/words/0030.webp"),
        (31, "/media/words/0031.webp"),
        (41, "/media/words/0041.webp"),
        (50, "/media/words/0050.webp"),
        (51, "/media/words/0051.webp"),
        (60, "/media/words/0060.webp"),
        (61, "/media/words/0061.webp"),
        (80, "/media/words/0080.webp"),
        (81, "/media/words/0081.webp"),
        (90, "/media/words/0090.webp"),
        (91, "/media/words/0091.webp"),
        (100, "/media/words/0100.webp"),
        (101, None),
        (300, None),
    ],
)
def test_word_image_url(number: int, expected: str | None) -> None:
    assert word_image_url(number) == expected


def image_file_numbers(folder: Path) -> set[int]:
    """Recording numbers of the `NNNN.webp` and `NNNN-512.webp` files in `folder`.

    Other files are ignored.
    """

    return {
        int(match.group(1))
        for path in folder.iterdir()
        if path.is_file() and (match := IMAGE_FILE_RE.fullmatch(path.name))
    }


def test_image_file_numbers_reads_only_word_images(tmp_path: Path) -> None:
    for name in ("0001.webp", "0070.webp", "0005-512.webp", "README.md", "0002.png", "3.webp"):
        (tmp_path / name).write_bytes(b"")
    for name in ("0004.webp", "0006-256.webp"):
        (tmp_path / name).mkdir()

    assert image_file_numbers(tmp_path) == {1, 5, 70}


@dataclass(frozen=True)
class WebPInfo:
    width: int
    height: int
    has_alpha: bool


def read_webp_info(data: bytes) -> WebPInfo:
    """Canvas size and alpha flag from a WebP file's header (RIFF container).

    Lossy images with alpha, and all extended images, start with a VP8X chunk;
    simple lossless images start with VP8L; plain VP8 is lossy with no alpha.
    """

    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("not a WebP file")
    chunk = data[12:16]
    if chunk == b"VP8X":
        flags = data[20]
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return WebPInfo(width, height, has_alpha=bool(flags & 0x10))
    if chunk == b"VP8L":
        if data[20] != 0x2F:
            raise ValueError("bad VP8L signature")
        bits = int.from_bytes(data[21:25], "little")
        width = 1 + (bits & 0x3FFF)
        height = 1 + ((bits >> 14) & 0x3FFF)
        return WebPInfo(width, height, has_alpha=bool((bits >> 28) & 1))
    if chunk == b"VP8 ":
        width, height = struct.unpack("<HH", data[26:30])
        return WebPInfo(width & 0x3FFF, height & 0x3FFF, has_alpha=False)
    raise ValueError(f"unknown WebP chunk {chunk!r}")


def riff(chunk: bytes, payload: bytes) -> bytes:
    body = b"WEBP" + chunk + struct.pack("<I", len(payload)) + payload
    return b"RIFF" + struct.pack("<I", len(body)) + body


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (
            riff(b"VP8X", bytes([0x10, 0, 0, 0]) + (1023).to_bytes(3, "little") * 2),
            WebPInfo(1024, 1024, has_alpha=True),
        ),
        (
            riff(b"VP8X", bytes([0, 0, 0, 0]) + (511).to_bytes(3, "little") * 2),
            WebPInfo(512, 512, has_alpha=False),
        ),
        (
            riff(
                b"VP8L",
                bytes([0x2F]) + (511 | 255 << 14 | 1 << 28).to_bytes(4, "little") + bytes(5),
            ),
            WebPInfo(512, 256, has_alpha=True),
        ),
        (
            riff(b"VP8 ", bytes(3) + b"\x9d\x01\x2a" + struct.pack("<HH", 1024, 1024)),
            WebPInfo(1024, 1024, has_alpha=False),
        ),
    ],
)
def test_read_webp_info(data: bytes, expected: WebPInfo) -> None:
    assert read_webp_info(data) == expected


def test_read_webp_info_rejects_other_files() -> None:
    with pytest.raises(ValueError):
        read_webp_info(b"\x89PNG\r\n\x1a\n" + bytes(30))


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
        f"{WORD_IMAGES_DIR} has images for {', '.join(f'{number:04}' for number in unlisted)} "
        f"but WORD_IMAGES does not list {unlisted}. "
        "Add the number to WORD_IMAGES in app/modules/content/media.py."
    )


def test_every_word_image_variant_is_valid(web_image_numbers: set[int]) -> None:
    problems: list[str] = []
    for number in sorted(WORD_IMAGES):
        for suffix, (pixels, budget) in VARIANTS.items():
            path = WORD_IMAGES_DIR / f"{number:04}{suffix}.webp"
            if not path.is_file():
                problems.append(f"{path.name}: missing")
                continue
            data = path.read_bytes()
            try:
                info = read_webp_info(data)
            except ValueError as error:
                problems.append(f"{path.name}: {error}")
                continue
            if (info.width, info.height) != (pixels, pixels):
                size = f"{info.width} x {info.height}"
                problems.append(f"{path.name}: {size}, not {pixels} x {pixels}")
            if len(data) > budget:
                problems.append(f"{path.name}: {len(data) // 1024} KB, over {budget // 1024} KB")
            if not info.has_alpha:
                problems.append(f"{path.name}: no alpha channel")

    assert not problems, (
        "Word images are wrong:\n  "
        + "\n  ".join(problems)
        + "\nMake them with scripts/word-images.sh (see apps/web/public/media/words/README.md)."
    )


def test_every_word_image_number_is_a_word_in_content() -> None:
    content = load_content()
    word_numbers = {word.number for chapter in content.chapters for word in chapter.words}
    unknown = sorted(WORD_IMAGES - word_numbers)

    assert not unknown, f"WORD_IMAGES lists {unknown}, which are not words in content.json."
