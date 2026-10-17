// The primary action's look, shared by buttons and by links that lead on as
// the page's main action. Pair it with a size.
export const ACTION_STYLE =
  "inline-flex items-center justify-center rounded-lg bg-action font-semibold text-action-ink hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

// "large" is for touch-first screens: at least as tall as the larger touch
// target.
export const ACTION_SIZE_STYLES = {
  default: "px-4 py-2",
  large: "min-h-touch-lg px-6 text-lg",
} as const;
