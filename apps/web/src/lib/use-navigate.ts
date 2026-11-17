"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { startNavigation } from "./navigation-progress";

export type Navigate = {
  push: (href: string) => void;
  replace: (href: string) => void;
  /** The router's refresh(): new server data for this page. */
  refresh: () => void;
};

/**
 * The router's push() and replace(), which also show the app's navigation
 * indicator until the next page arrives. Use it for every programmatic
 * navigation; links show the indicator on their own.
 */
export function useNavigate(): Navigate {
  const router = useRouter();
  return useMemo(
    () => ({
      push(href) {
        startNavigation(href);
        router.push(href);
      },
      replace(href) {
        startNavigation(href);
        router.replace(href);
      },
      refresh() {
        router.refresh();
      },
    }),
    [router],
  );
}
