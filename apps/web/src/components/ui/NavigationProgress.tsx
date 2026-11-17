"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";

import {
  endNavigation,
  navigationHrefOf,
  pendingNavigationId,
  startNavigation,
  subscribeToNavigation,
} from "@/lib/navigation-progress";

/** How long a navigation is pending before the indicator shows. */
export const NAVIGATION_PROGRESS_DELAY_MS = 150;

// The app's one navigation indicator, mounted once in the root layout: a bar
// across the top of the screen from the moment a link is tapped (or
// useNavigate() runs) until the next page arrives, so the app never looks
// stuck while the server answers. Its short delay keeps instant (cached)
// navigations from flashing it. In Suspense, because useSearchParams() would
// otherwise opt every static page out of prerendering.
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}

function NavigationProgressBar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const pendingId = useSyncExternalStore(
    subscribeToNavigation,
    pendingNavigationId,
    () => 0,
  );
  // The navigation whose delay has passed: shown while it is still pending.
  const [delayedId, setDelayedId] = useState(0);
  const isShown = pendingId !== 0 && delayedId === pendingId;

  // A link click, in the capture phase: before the link's own handler, and
  // whether or not it (or Next.js's Link) cancels the browser's navigation.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const href = navigationHrefOf(event);
      if (href !== null) startNavigation(href);
    }
    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  // The URL changed: the navigation is done.
  useEffect(() => {
    endNavigation();
  }, [pathname, search]);

  useEffect(() => {
    if (pendingId === 0) return;
    const timer = setTimeout(
      () => setDelayedId(pendingId),
      NAVIGATION_PROGRESS_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [pendingId]);

  return (
    <>
      {/* Always mounted, so screen readers hear the text when it appears. */}
      <span role="status" className="sr-only">
        {isShown ? "Učitava se…" : ""}
      </span>
      {isShown ? (
        <div
          aria-hidden="true"
          data-testid="navigation-progress"
          className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1.5 overflow-hidden bg-kid-yellow-soft"
        >
          <div className="h-full w-1/3 animate-navigation-progress rounded-full bg-kid-coral motion-reduce:w-full motion-reduce:animate-pulse" />
        </div>
      ) : null}
    </>
  );
}
