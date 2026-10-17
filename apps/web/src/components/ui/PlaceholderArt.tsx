import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

import {
  type PLACEHOLDER_ART_PALETTE_COUNT,
  type PlaceholderArtPattern,
  placeholderArt,
} from "./placeholder-art";

// The art-1 … art-8 tokens in tailwind.config.ts, as full class names.
const PALETTES = [
  {
    bg: "fill-art-1-bg",
    pattern: "fill-art-1-pattern",
    line: "stroke-art-1-pattern",
    ink: "fill-art-1-ink",
  },
  {
    bg: "fill-art-2-bg",
    pattern: "fill-art-2-pattern",
    line: "stroke-art-2-pattern",
    ink: "fill-art-2-ink",
  },
  {
    bg: "fill-art-3-bg",
    pattern: "fill-art-3-pattern",
    line: "stroke-art-3-pattern",
    ink: "fill-art-3-ink",
  },
  {
    bg: "fill-art-4-bg",
    pattern: "fill-art-4-pattern",
    line: "stroke-art-4-pattern",
    ink: "fill-art-4-ink",
  },
  {
    bg: "fill-art-5-bg",
    pattern: "fill-art-5-pattern",
    line: "stroke-art-5-pattern",
    ink: "fill-art-5-ink",
  },
  {
    bg: "fill-art-6-bg",
    pattern: "fill-art-6-pattern",
    line: "stroke-art-6-pattern",
    ink: "fill-art-6-ink",
  },
  {
    bg: "fill-art-7-bg",
    pattern: "fill-art-7-pattern",
    line: "stroke-art-7-pattern",
    ink: "fill-art-7-ink",
  },
  {
    bg: "fill-art-8-bg",
    pattern: "fill-art-8-pattern",
    line: "stroke-art-8-pattern",
    ink: "fill-art-8-ink",
  },
] as const satisfies readonly unknown[] & {
  length: typeof PLACEHOLDER_ART_PALETTE_COUNT;
};

// Patterns are plain shapes on a grid, not SVG <pattern> elements, so the
// markup needs no IDs (several pictures on a page cannot clash) and renders the
// same on the server and the client. The grid covers -60 … 160, so the
// 100 × 100 picture stays filled at any rotation.
const STEP = 20;
const GRID = Array.from({ length: 12 }, (_, index) => -60 + index * STEP);

const PATTERN_SHAPES: Record<PlaceholderArtPattern, ReactNode> = {
  dots: GRID.flatMap((y, row) =>
    GRID.map((x) => (
      <circle key={`${x},${y}`} cx={x + (row % 2) * 10} cy={y} r={5} />
    )),
  ),
  stripes: GRID.map((x) => (
    <rect key={x} x={x} y={-60} width={8} height={220} />
  )),
  waves: GRID.map((y) => (
    <path
      key={y}
      d={`M -60 ${y} q 10 -8 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0`}
      fill="none"
      strokeWidth={5}
      strokeLinecap="round"
    />
  )),
  checks: GRID.flatMap((y, row) =>
    GRID.filter((_, column) => (row + column) % 2 === 0).map((x) => (
      <rect key={`${x},${y}`} x={x} y={y} width={STEP} height={STEP} />
    )),
  ),
  triangles: GRID.flatMap((y) =>
    GRID.map((x) => (
      <polygon
        key={`${x},${y}`}
        points={`${x},${y + 14} ${x + 8},${y} ${x + 16},${y + 14}`}
      />
    )),
  ),
};

type PlaceholderArtProps = {
  /** A stable ID, such as a place's: it picks the colours and pattern. */
  id: string;
  /** The name the initial is taken from; the ID's first letter otherwise. */
  label?: string;
  /** Layout only. The picture fills its box, cropping to keep its shape. */
  className?: string;
};

// A stand-in picture until real artwork arrives: a pattern and an initial,
// always the same for the same ID. Decorative, so it is hidden from assistive
// technology; the name next to it carries the meaning.
export function PlaceholderArt({ id, label, className }: PlaceholderArtProps) {
  const art = placeholderArt(id, label);
  const palette = PALETTES[art.palette] ?? PALETTES[0];
  const isWaves = art.pattern === "waves";

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn("block size-full", className)}
    >
      <rect width={100} height={100} className={palette.bg} />
      <g
        transform={`rotate(${art.rotation} 50 50)`}
        className={isWaves ? palette.line : palette.pattern}
      >
        {PATTERN_SHAPES[art.pattern]}
      </g>
      {art.initial ? (
        <>
          <circle cx={50} cy={50} r={26} className={palette.bg} />
          <text
            x={50}
            y={50}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={Array.from(art.initial).length > 1 ? 26 : 32}
            fontWeight={700}
            className={palette.ink}
          >
            {art.initial}
          </text>
        </>
      ) : null}
    </svg>
  );
}
