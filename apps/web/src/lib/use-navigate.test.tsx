import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { endNavigation, isNavigationPending } from "./navigation-progress";
import { useNavigate } from "./use-navigate";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("useNavigate", () => {
  afterEach(() => {
    endNavigation();
    vi.clearAllMocks();
  });

  it.each(["push", "replace"] as const)(
    "%s() goes through the router and marks the navigation pending",
    (method) => {
      const { result } = renderHook(() => useNavigate());

      result.current[method]("/play/coast");

      expect(router[method]).toHaveBeenCalledWith("/play/coast");
      expect(isNavigationPending()).toBe(true);
    },
  );

  it("does not mark a navigation to the current URL pending", () => {
    const { result } = renderHook(() => useNavigate());

    result.current.push(window.location.pathname);

    expect(isNavigationPending()).toBe(false);
  });

  it("refresh() refreshes without a pending navigation", () => {
    const { result } = renderHook(() => useNavigate());

    result.current.refresh();

    expect(router.refresh).toHaveBeenCalled();
    expect(isNavigationPending()).toBe(false);
  });
});
