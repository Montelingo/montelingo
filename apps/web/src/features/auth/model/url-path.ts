// Any origin works: the checks resolve a path against it only to see whether
// it stays on whichever origin it is resolved against, and to read its parts.
export const PLACEHOLDER_ORIGIN = "https://montelingo.invalid";

/**
 * True when `pathname` is `root` or a path under it (`/play` and
 * `/play/kotor`, not `/playground`). The path is decoded first, because the
 * router decodes it too (`/%70lay/kotor` is `/play/kotor`); a malformed
 * encoding is compared as it is. Matching is case-sensitive, like the router's.
 */
export function isPathWithin(pathname: string, root: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  return decoded === root || decoded.startsWith(`${root}/`);
}
