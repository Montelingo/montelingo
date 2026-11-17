import { FOCUS_RING } from "@/components/ui/focus-ring";

// Class names the setup screens share (Figma A5, A6), written out in full so
// Tailwind finds them.

/** The wide yellow "Next" button with the raised ink edge. */
export const PRIMARY_BUTTON = `flex h-touch-xl w-full items-center justify-center rounded-kid-lg border-3 border-kid-ink bg-kid-yellow text-2xl font-semibold text-kid-ink shadow-raised-4 disabled:opacity-60 ${FOCUS_RING}`;

/** A choice card or buddy that is not picked, and the one that is. */
export const CHOICE = "border-3 border-kid-ink bg-white shadow-raised-4";
export const CHOICE_PICKED =
  "border-3 border-kid-ink bg-kid-yellow shadow-raised-4 ring-4 ring-kid-yellow/50";
