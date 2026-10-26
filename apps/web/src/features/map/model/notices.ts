// Messages a map screen shows from its `?notice=`, after sending the learner
// back from a place that is not open yet. Calm, and never blaming: the place
// simply opens later. Only these keys are accepted, so a link can never put
// its own text on the page.
export const MAP_NOTICES = {
  "region-locked":
    "That region isn’t open yet. Keep exploring the open places to reach it.",
  "location-locked":
    "That place isn’t open yet. Keep exploring the open places to reach it.",
} as const;

export type MapNotice = keyof typeof MAP_NOTICES;

/** Reads a map screen's `?notice=`: a known notice, or `null`. */
export function parseMapNotice(value: unknown): MapNotice | null {
  if (typeof value !== "string" || !Object.hasOwn(MAP_NOTICES, value)) {
    return null;
  }
  return value as MapNotice;
}

/** Links to `path`, a map screen, showing `notice` there. */
export function withMapNotice(path: string, notice: MapNotice): string {
  return `${path}?${new URLSearchParams({ notice }).toString()}`;
}
