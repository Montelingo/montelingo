// Class names of the designers' kit (Figma "0 · Components") that more than
// one feature draws: the welcome, setup and auth screens and the map's chrome.
// Written out in full so Tailwind finds them.

/** The visible keyboard focus of every kit control. */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * The wide button with the raised ink edge, without its fill: add
 * `bg-kid-yellow` for the main action or `bg-white` for the other.
 */
export const BIG_BUTTON = `flex h-touch-xl w-full items-center justify-center rounded-kid-lg border-3 border-kid-ink text-2xl font-semibold text-kid-ink shadow-raised-4 ${FOCUS_RING}`;

/** The grown-up's small underlined links and buttons on the kit's screens. */
export const SMALL_LINK = `inline-flex h-touch items-center rounded-kid px-3 text-lg font-semibold text-kid-ink underline underline-offset-4 ${FOCUS_RING}`;

/** The round 56px icon button (back, sound, close). */
export const ICON_BUTTON = `inline-flex size-touch-lg shrink-0 items-center justify-center rounded-full border-3 border-kid-ink bg-white shadow-raised-4 ${FOCUS_RING}`;

/** A card of the grown-ups area: white, with the ink edge (Figma Me3). */
export const GROWN_UPS_CARD =
  "flex flex-col gap-2.5 rounded-kid-md border-3 border-kid-ink bg-white px-4 pb-4 pt-3.5";
