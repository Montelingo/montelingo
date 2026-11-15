"""Builds the learner area's font files from Fredoka.

Usage (from apps/web):

    uv run --no-project --with "fonttools[woff]" python scripts/build_font.py \
        "path/to/Fredoka[wdth,wght].ttf"

The source is Fredoka (SIL Open Font License, src/lib/fonts/OFL.txt) from
github.com/google/fonts, ofl/fredoka/Fredoka[wdth,wght].ttf at commit
eda3fe521878f70de0e2d91fd6d800f93f8c4758. The script writes, for each weight
the app uses (500 and 600), at normal width:

- src/lib/fonts/fredoka-<weight>.woff2: the Latin and Latin Extended
  characters Google Fonts serves Fredoka with, plus Č č Ć ć Đ đ Ś ś Ź ź,
  which Fredoka does not have and Montenegrin needs. They are built from the
  font's own parts, as it builds its other accented letters: C and c with the
  caron of Š and š; C, S and Z and c, s and z with the acute of É and é; Đ is
  Ð (Eth), the same shape; đ is d with Fredoka's hyphen, thinner, across its
  stem.

The font's own name, copyright and licence stay in each file.
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

WEB_ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = WEB_ROOT / "src" / "lib" / "fonts"

WEIGHTS = (500, 600)

# Google Fonts' "latin" and "latin-ext" subsets of Fredoka, together.
UNICODES = (
    "U+0000-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,"
    "U+2000-206F,U+20A0-20C0,U+2113,U+2122,U+2191,U+2193,U+2212,U+2215,"
    "U+2C60-2C7F,U+A720-A7FF,U+FEFF,U+FFFD"
)

# The letters Fredoka lacks, each as (base, accent, the letter whose accent it
# copies, that letter's base): the accent sits over the new base where it sits
# over the model's, centred the same way.
ACCENTED = {
    "Ccaron": (0x010C, "C", "uni030C", "Scaron", "S"),
    "ccaron": (0x010D, "c", "uni030C", "scaron", "s"),
    "Cacute": (0x0106, "C", "acutecomb", "Eacute", "E"),
    "cacute": (0x0107, "c", "acutecomb", "eacute", "e"),
    "Sacute": (0x015A, "S", "acutecomb", "Eacute", "E"),
    "sacute": (0x015B, "s", "acutecomb", "eacute", "e"),
    "Zacute": (0x0179, "Z", "acutecomb", "Eacute", "E"),
    "zacute": (0x017A, "z", "acutecomb", "eacute", "e"),
}

# Montenegrin's letters beyond ASCII, in both alphabets' Latin form; every
# file must have them all.
MONTENEGRIN = "ČčĆćĐđŠšŽžŚśŹź"

# Every letter added: the accented ones, Đ and đ.
ADDED = (*(codepoint for codepoint, *_ in ACCENTED.values()), 0x0110, 0x0111)

# đ's bar: from this share of d's width to just past its stem, as thick as
# this share of the hyphen, centred between the x-height and the ascender.
BAR_FROM = 0.53
BAR_PAST_STEM = 16
BAR_THICKNESS = 0.8


def main(source: Path) -> None:
    for weight in WEIGHTS:
        font = instantiateVariableFont(
            TTFont(source), {"wght": weight, "wdth": 100}, updateFontNames=True
        )
        add_missing_letters(font)
        subsetter = Subsetter(Options(layout_features=["*"], name_IDs=["*"]))
        subsetter.populate(unicodes=[*parse_unicodes(UNICODES), *ADDED])
        subsetter.subset(font)
        missing = [letter for letter in MONTENEGRIN if ord(letter) not in font.getBestCmap()]
        if missing:
            raise SystemExit(f"Fredoka {weight} has no {' '.join(missing)}")
        # Keep the source's date, so the same source makes the same file.
        font.recalcTimestamp = False
        font.flavor = "woff2"
        path = FONTS_DIR / f"fredoka-{weight}.woff2"
        font.save(path)
        print(f"wrote {path.relative_to(WEB_ROOT)} ({path.stat().st_size // 1024} KB)")


def add_missing_letters(font: TTFont) -> None:
    glyphs = font.getGlyphSet()
    for name, (codepoint, base, accent, model, model_base) in ACCENTED.items():
        dx, dy = accent_offset(font, model, accent)
        # Centre the accent over the new base as over the model's base.
        shift = centre_x(glyphs, base) - centre_x(glyphs, model_base)
        add_glyph(
            font,
            name,
            codepoint,
            base,
            [(base, (1, 0, 0, 1, 0, 0)), (accent, (1, 0, 0, 1, dx + shift, dy))],
        )

    # Đ is Ð: the same letter in Montenegrin and in Icelandic.
    add_glyph(font, "Dcroat", 0x0110, "Eth", [("Eth", (1, 0, 0, 1, 0, 0))])

    d_left, _, d_right, _ = bounds(glyphs, "d")
    h_left, h_bottom, h_right, h_top = bounds(glyphs, "hyphen")
    bar_left = d_left + (d_right - d_left) * BAR_FROM
    bar_right = d_right + BAR_PAST_STEM
    scale_x = (bar_right - bar_left) / (h_right - h_left)
    scale_y = BAR_THICKNESS
    x_height = font["OS/2"].sxHeight
    ascender = bounds(glyphs, "d")[3]
    bar_centre = (x_height + ascender) / 2
    dx = bar_left - h_left * scale_x
    dy = bar_centre - (h_bottom + h_top) / 2 * scale_y
    add_glyph(
        font,
        "dcroat",
        0x0111,
        "d",
        [("d", (1, 0, 0, 1, 0, 0)), ("hyphen", (scale_x, 0, 0, scale_y, dx, dy))],
    )


def accent_offset(font: TTFont, glyph: str, accent: str) -> tuple[float, float]:
    """Where `glyph`, a composite, places its `accent` component."""
    for component in font["glyf"][glyph].components:
        if component.glyphName == accent:
            return component.x, component.y
    raise SystemExit(f"{glyph} has no {accent}")


def add_glyph(
    font: TTFont,
    name: str,
    codepoint: int,
    width_of: str,
    components: list[tuple[str, tuple[float, ...]]],
) -> None:
    """Adds `name` for `codepoint`, made of `components` (glyph and transform),
    as wide as `width_of`."""
    pen = TTGlyphPen(font.getGlyphSet())
    for component, transform in components:
        pen.addComponent(component, transform)
    glyph = pen.glyph()
    order = [*font.getGlyphOrder(), name]
    font.setGlyphOrder(order)
    glyf = font["glyf"]
    glyf.glyphOrder = order
    glyf[name] = glyph
    glyph.recalcBounds(glyf)
    font["hmtx"][name] = (font["hmtx"][width_of][0], glyph.xMin)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[codepoint] = name


def bounds(glyphs, name: str) -> tuple[float, float, float, float]:
    pen = BoundsPen(glyphs)
    glyphs[name].draw(pen)
    return pen.bounds


def centre_x(glyphs, name: str) -> float:
    left, _, right, _ = bounds(glyphs, name)
    return (left + right) / 2


def parse_unicodes(ranges: str) -> list[int]:
    codepoints: list[int] = []
    for part in ranges.split(","):
        first, _, last = part.removeprefix("U+").partition("-")
        codepoints += range(int(first, 16), int(last or first, 16) + 1)
    return codepoints


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]))
