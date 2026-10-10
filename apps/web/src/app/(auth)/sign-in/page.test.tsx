import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth";

import SignInPage, { metadata } from "./page";

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
vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const signedInUser: CurrentUser = {
  id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
  email: "ana@example.com",
  createdAt: "2026-09-01T10:00:00Z",
};

function renderPage(searchParams: { next?: string | string[] } = {}) {
  return SignInPage({ searchParams: Promise.resolve(searchParams) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignInPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Sign in");
  });

  it("shows the form to a signed-out visitor, keeping the destination", async () => {
    getCurrentUser.mockResolvedValue(null);

    render(await renderPage({ next: "/lessons" }));

    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/sign-up?next=%2Flessons",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(["https://evil.com", "/forgot-password"])(
    "drops the destination %j for a signed-out visitor",
    async (next) => {
      getCurrentUser.mockResolvedValue(null);

      render(await renderPage({ next }));

      expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
        "href",
        "/sign-up",
      );
    },
  );

  it("sends a signed-in user to the destination", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);

    await expect(renderPage({ next: "/lessons/42" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith("/lessons/42");
  });

  it.each<[string, { next?: string | string[] }]>([
    ["no destination", {}],
    ["an absolute URL", { next: "https://evil.com" }],
    ["a protocol-relative URL", { next: "//evil.com" }],
    ["a repeated parameter", { next: ["/a", "/b"] }],
    ["an auth page", { next: "/sign-up" }],
    ["an encoded auth page with a slash", { next: "/%73ign-in/" }],
    ["the reset-password page", { next: "/reset-password?token=abc" }],
  ])("sends a signed-in user home when there is %s", async (_case, params) => {
    getCurrentUser.mockResolvedValue(signedInUser);

    await expect(renderPage(params)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("lets a failed session check reach the error boundary", async () => {
    getCurrentUser.mockRejectedValue(new Error("API unavailable"));

    await expect(renderPage()).rejects.toThrow("API unavailable");
    expect(redirect).not.toHaveBeenCalled();
  });
});
