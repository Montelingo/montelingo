// "Back" in the learner area goes up the URL, not back through the browser's
// history: from a place to its region, from a region to the map. A deep link
// or a reload still has a sensible way back, and Back never leaves the area by
// surprise. Only the map itself leads out, to the exit. A level of the URL
// that has no screen, such as a chapter's between a lesson and its place, is
// skipped, so Back never lands on a 404.

/** `pathname` without repeated or trailing slashes ("/play//kotor/" → "/play/kotor"). */
function normalizePath(pathname: string): string {
  return pathname.replace(/\/{2,}/g, "/").replace(/(.)\/+$/, "$1");
}

/**
 * True when `pathname` is `root` or a path under it. Unlike the auth checks,
 * the path is compared as written, not decoded: `parentPath()` cuts the Back
 * target from this same string, and decoding the check alone would let them
 * disagree (`/play%2Fkotor` would be inside `/play` with no parent there).
 */
export function isWithinPath(pathname: string, root: string): boolean {
  const path = normalizePath(pathname);
  return path === root || path.startsWith(`${root}/`);
}

/** True when `pathname` is `path` itself, ignoring a trailing slash. */
export function isAtPath(pathname: string, path: string): boolean {
  return normalizePath(pathname) === path;
}

/**
 * The page one level up from `pathname` inside `root`
 * ("/play/kotor/old-town" → "/play/kotor"), never above `root`. `null` at
 * `root` itself and outside it, where there is no parent in the area.
 */
export function parentPath(pathname: string, root: string): string | null {
  const path = normalizePath(pathname);
  if (path === root || !isWithinPath(path, root)) {
    return null;
  }
  return path.slice(0, path.lastIndexOf("/"));
}

/** How many segments `path`, inside `root`, is below it (`root` itself is 0). */
function depthBelow(path: string, root: string): number {
  return normalizePath(path).slice(root.length).split("/").filter(Boolean)
    .length;
}

export type BackTargets = {
  /** The top of the area (the map). */
  homeHref: string;
  /** Where Back leads from the top of the area, out of it. */
  exitHref: string;
  /**
   * Depths below `homeHref` whose URLs have no screen (1 is a region's), which
   * Back skips. Plain data, so a Server Component can pass it to the control.
   */
  screenlessDepths?: readonly number[];
};

/**
 * Where the Back control on `pathname` goes: its nearest parent that has a
 * screen, or out of the area from the top.
 */
export function backHref(
  pathname: string,
  { homeHref, exitHref, screenlessDepths = [] }: BackTargets,
): string {
  let target = parentPath(pathname, homeHref);
  // The top (depth 0) always has a screen, so this stops there at the latest.
  while (
    target !== null &&
    screenlessDepths.includes(depthBelow(target, homeHref))
  ) {
    target = parentPath(target, homeHref);
  }
  return target ?? exitHref;
}
