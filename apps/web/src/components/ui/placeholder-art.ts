export const PLACEHOLDER_ART_PATTERNS = [
  "dots",
  "stripes",
  "waves",
  "checks",
  "triangles",
] as const;

export type PlaceholderArtPattern = (typeof PLACEHOLDER_ART_PATTERNS)[number];

/** How many colour palettes the art picks from (`art-1` … `art-8` in tailwind.config.ts). */
export const PLACEHOLDER_ART_PALETTE_COUNT = 8;

/** The quarter turns a pattern can be drawn at. */
export const PLACEHOLDER_ART_ROTATIONS = [0, 45, 90, 135] as const;

export type PlaceholderArtRotation = (typeof PLACEHOLDER_ART_ROTATIONS)[number];

export type PlaceholderArtSpec = {
  /** 0 to PLACEHOLDER_ART_PALETTE_COUNT − 1. */
  palette: number;
  pattern: PlaceholderArtPattern;
  rotation: PlaceholderArtRotation;
  /** One letter (or a digraph such as "Lj"), or "" when there is no text. */
  initial: string;
};

// Montenegrin (and Serbo-Croatian) Latin letters written with two characters.
// Alphabetised as single letters, so "Ljubljana" starts with "Lj", not "L".
const DIGRAPH_INITIAL = /^(?:lj|nj|dž)/iu;
// The same letters as single Unicode characters (Ǆ ǅ ǆ Ǉ ǈ ǉ Ǌ ǋ ǌ), which
// compatibility normalization splits into the two-character spelling.
const DIGRAPH_CHARACTER = /^[Ǆ-ǌ]/u;

/**
 * Picks a palette, pattern, and rotation from `id`, and an initial from
 * `label` (or `id` when there is no label). The same input always gives the
 * same picture, on the server and in every browser, so a place keeps its look
 * until a real picture replaces it.
 */
export function placeholderArt(id: string, label?: string): PlaceholderArtSpec {
  const hash = fnv1a(id.normalize("NFC"));
  const patternCount = PLACEHOLDER_ART_PATTERNS.length;
  const palette = hash % PLACEHOLDER_ART_PALETTE_COUNT;
  const rest = Math.floor(hash / PLACEHOLDER_ART_PALETTE_COUNT);

  return {
    palette,
    pattern: pick(PLACEHOLDER_ART_PATTERNS, rest % patternCount),
    rotation: pick(
      PLACEHOLDER_ART_ROTATIONS,
      Math.floor(rest / patternCount) % PLACEHOLDER_ART_ROTATIONS.length,
    ),
    initial: initialOf(label?.trim() ? label : id),
  };
}

/**
 * The first letter of `text`, upper-cased: a whole grapheme, so accented
 * letters keep their accent ("Žabljak" → "Ž", including when the accent is a
 * separate combining mark) and an emoji stays whole; the Montenegrin digraphs
 * Lj, Nj, and Dž count as one letter ("Njeguši" → "Nj").
 */
export function initialOf(text: string): string {
  const normalized = text
    .trim()
    .normalize("NFC")
    .replace(DIGRAPH_CHARACTER, (character) => character.normalize("NFKC"));

  const digraph = DIGRAPH_INITIAL.exec(normalized)?.[0];
  if (digraph !== undefined) {
    return `${digraph.charAt(0).toUpperCase()}${digraph.slice(1).toLowerCase()}`;
  }

  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const first = segments.segment(normalized)[Symbol.iterator]().next();
  return first.done ? "" : first.value.segment.toUpperCase();
}

// 32-bit FNV-1a over the string's UTF-16 code units: small, fast, and spreads
// similar IDs ("kotor-1", "kotor-2") across the palettes. Math.imul keeps the
// multiplication in 32 bits; >>> 0 makes the result unsigned.
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`No value at index ${index}`);
  }
  return value;
}
