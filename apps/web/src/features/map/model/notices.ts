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

// The query parameter that carries a map notice.
const MAP_NOTICE_PARAM = "notice";

/** Reads a map screen's `?notice=`: a known notice, or `null`. */
export function parseMapNotice(value: unknown): MapNotice | null {
  if (typeof value !== "string" || !Object.hasOwn(MAP_NOTICES, value)) {
    return null;
  }
  return value as MapNotice;
}

/** Links to `path`, a map screen, showing `notice` there. */
export function withMapNotice(path: string, notice: MapNotice): string {
  const query = new URLSearchParams({ [MAP_NOTICE_PARAM]: notice });
  return `${path}?${query.toString()}`;
}

/** Reads the notice from a map screen's query string: a known notice, or `null`. */
export function mapNoticeIn(
  searchParams: Pick<URLSearchParams, "get">,
): MapNotice | null {
  return parseMapNotice(searchParams.get(MAP_NOTICE_PARAM));
}

/**
 * `url`, an absolute URL, as a path without its `?notice=`, or `null` when it
 * has none. The other parameters, in their order and encoding, and the hash
 * are kept as they are.
 */
export function withoutMapNotice(url: string): string | null {
  const { pathname, search, hash } = new URL(url);
  const pairs = search.slice(1).split("&");
  const kept = pairs.filter(
    (pair) => !new URLSearchParams(pair).has(MAP_NOTICE_PARAM),
  );
  if (kept.length === pairs.length) {
    return null;
  }
  const query = kept.join("&");
  return `${pathname}${query === "" ? "" : `?${query}`}${hash}`;
}
