// Class names the map's chrome shares (Figma "Icon button" and the focus
// outline every control draws), written out in full so Tailwind finds them.

/** The visible keyboard focus of every chrome control. */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The round 56px icon button from the designers' kit (back, sound, close). */
export const ICON_BUTTON_CLASS = `inline-flex size-touch-lg shrink-0 items-center justify-center rounded-full border-3 border-kid-ink bg-white shadow-raised-4 ${FOCUS_RING}`;
