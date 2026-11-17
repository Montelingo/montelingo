/**
 * Whether a client-side navigation is under way, for the app's one navigation
 * indicator (NavigationProgress). Started by a link click (which
 * NavigationProgress listens for) or by useNavigate(); ended when the URL
 * changes, or after NAVIGATION_TIMEOUT_MS if a navigation never completes.
 */

/** Clears the indicator if a navigation never changes the URL. */
export const NAVIGATION_TIMEOUT_MS = 10_000;

type Listener = () => void;

// The pending navigation's id, or 0 when none is pending: each navigation
// gets its own, so the indicator can time its delay per navigation.
let pendingId = 0;
let lastId = 0;
let timeout: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

function setPendingId(next: number) {
  if (pendingId === next) return;
  pendingId = next;
  listeners.forEach((listener) => listener());
}

export function isNavigationPending(): boolean {
  return pendingId !== 0;
}

/** The pending navigation's id, or 0 when none is pending. */
export function pendingNavigationId(): number {
  return pendingId;
}

export function subscribeToNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Whether going to `href` loads another page of this app: same origin, and a
 * different path or query (a change of hash only stays on the page).
 */
export function leavesCurrentPage(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  return (
    url.origin === window.location.origin &&
    (url.pathname !== window.location.pathname ||
      url.search !== window.location.search)
  );
}

/** Marks a navigation to `href` as pending, unless it stays on this page. */
export function startNavigation(href: string): void {
  if (!leavesCurrentPage(href)) return;
  clearTimeout(timeout);
  timeout = setTimeout(endNavigation, NAVIGATION_TIMEOUT_MS);
  if (pendingId === 0) {
    lastId += 1;
    setPendingId(lastId);
  }
}

export function endNavigation(): void {
  clearTimeout(timeout);
  timeout = undefined;
  setPendingId(0);
}

/**
 * The href a click on a link will navigate to in this tab, or `null`: not the
 * main button, a modifier key (a new tab or window), a link without an href,
 * one that opens elsewhere (`target`) or downloads. HTML and SVG links both.
 */
export function navigationHrefOf(event: MouseEvent): string | null {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }
  if (!(event.target instanceof Element)) return null;
  const link = event.target.closest("a[href]");
  if (link === null) return null;
  const target = link.getAttribute("target");
  if (
    (target !== null && target !== "_self") ||
    link.hasAttribute("download")
  ) {
    return null;
  }
  return link.getAttribute("href");
}
