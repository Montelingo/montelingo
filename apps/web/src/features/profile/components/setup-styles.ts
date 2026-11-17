// Class names the setup screens share (Figma A5, A6), written out in full so
// Tailwind finds them. The kit's own (focus, buttons) live in
// @/components/ui/kid-styles.

import { BIG_BUTTON } from "@/components/ui/kid-styles";

/** The wide yellow "Next" button with the raised ink edge. */
export const PRIMARY_BUTTON = `${BIG_BUTTON} bg-kid-yellow disabled:opacity-60`;

/** A choice card or buddy that is not picked, and the one that is. */
export const CHOICE = "border-3 border-kid-ink bg-white shadow-raised-4";
export const CHOICE_PICKED =
  "border-3 border-kid-ink bg-kid-yellow shadow-raised-4 ring-4 ring-kid-yellow/50";
