// Kept out of TileCard.tsx, a client module: a Server Component that imports a
// value from a "use client" file gets a client reference, not the value, so the
// list would be unusable where cards are built from data.
export const TILE_CARD_STATES = [
  "locked",
  "available",
  "active",
  "in-progress",
  "completed",
  "loading",
  "error",
] as const;

export type TileCardState = (typeof TILE_CARD_STATES)[number];
