"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => undefined;
}

/**
 * False in server HTML and while it hydrates, true from then on, and true
 * from the start when a component first renders in the browser. Nothing ever
 * changes it, so it needs no subscription.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
