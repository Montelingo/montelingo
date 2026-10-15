// "Back" in the learner area goes up the URL, not back through the browser's
// history: from a place to its region, from a region to the map. A deep link
// or a reload still has a sensible way back, and Back never leaves the area by
// surprise. Only the map itself leads out, to the exit.

/** `pathname` without repeated or trailing slashes ("/play//kotor/" → "/play/kotor"). */
function normalizePath(pathname: string): string {
  return pathname.replace(/\/{2,}/g, "/").replace(/(.)\/+$/, "$1");
}

/** True when `pathname` is `root` or a path under it. */
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

type BackTargets = {
  /** The top of the area (the map). */
  homeHref: string;
  /** Where Back leads from the top of the area, out of it. */
  exitHref: string;
};

/** Where the Back control on `pathname` goes: its parent, or out of the area from the top. */
export function backHref(
  pathname: string,
  { homeHref, exitHref }: BackTargets,
): string {
  return parentPath(pathname, homeHref) ?? exitHref;
}
