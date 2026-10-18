import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth";

import PlayLayout from "./layout";

const { getCurrentUser } = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
}));
vi.mock("@/features/auth/server", () => ({ getCurrentUser }));

// Like Next.js, redirect() throws, so nothing after it runs.
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

// The request headers the middleware forwards.
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestHeaders.current),
}));

const signedInUser: CurrentUser = {
  id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
  email: "ana@example.com",
  createdAt: "2026-09-01T10:00:00Z",
};

function renderLayout() {
  return PlayLayout({ children: <h1>Your map</h1> });
}

beforeEach(() => {
  vi.clearAllMocks();
  requestHeaders.current = new Headers();
});

describe("PlayLayout", () => {
  it("shows the page to a signed-in user", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);

    render(await renderLayout());

    expect(
      screen.getByRole("heading", { name: "Your map" }),
    ).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a visitor whose session has ended to sign in, returning to the page they asked for", async () => {
    getCurrentUser.mockResolvedValue(null);
    requestHeaders.current = new Headers({
      "x-montelingo-path": "/play/kotor?x=1",
    });

    await expect(renderLayout()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fkotor%3Fx%3D1",
    );
  });

  it.each([
    ["missing", undefined],
    ["outside the learner area", "/account"],
    ["another site", "https://evil.com/play"],
  ])(
    "returns to the map when the requested path is %s",
    async (_case, requestedPath) => {
      getCurrentUser.mockResolvedValue(null);
      requestHeaders.current = new Headers(
        requestedPath === undefined
          ? {}
          : { "x-montelingo-path": requestedPath },
      );

      await expect(renderLayout()).rejects.toThrow("NEXT_REDIRECT");

      expect(redirect).toHaveBeenCalledWith("/sign-in?next=%2Fplay");
    },
  );

  it("lets a failed session check reach the error boundary instead of redirecting", async () => {
    getCurrentUser.mockRejectedValue(new Error("API unavailable"));

    await expect(renderLayout()).rejects.toThrow("API unavailable");
    expect(redirect).not.toHaveBeenCalled();
  });
});
