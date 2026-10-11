import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState, CurrentUser } from "@/features/auth";

import SignInPage, { metadata } from "./page";

const { getAuthState } = vi.hoisted(() => ({
  getAuthState: vi.fn<() => Promise<AuthState>>(),
}));
vi.mock("@/features/auth/server", () => ({ getAuthState }));

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

type SearchParams = {
  next?: string | string[];
  notice?: string | string[];
};

function renderPage(searchParams: SearchParams = {}) {
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
    getAuthState.mockResolvedValue({ status: "signed-out" });

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
      getAuthState.mockResolvedValue({ status: "signed-out" });

      render(await renderPage({ next }));

      expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
        "href",
        "/sign-up",
      );
    },
  );

  it("shows the password-updated notice", async () => {
    getAuthState.mockResolvedValue({ status: "signed-out" });

    render(await renderPage({ notice: "password-updated" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Password updated — please sign in.",
    );
  });

  it.each<[string, string | string[]]>([
    ["an unknown notice", "account-deleted"],
    ["free text", "Your account is locked"],
    ["a repeated parameter", ["password-updated", "password-updated"]],
  ])("shows no notice for %s", async (_case, notice) => {
    getAuthState.mockResolvedValue({ status: "signed-out" });

    render(await renderPage({ notice }));

    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the destination alongside a notice", async () => {
    getAuthState.mockResolvedValue({ status: "signed-out" });

    render(await renderPage({ next: "/lessons", notice: "password-updated" }));

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/sign-up?next=%2Flessons",
    );
  });

  it("sends a signed-in user to the destination", async () => {
    getAuthState.mockResolvedValue({ status: "signed-in", user: signedInUser });

    await expect(renderPage({ next: "/lessons/42" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith("/lessons/42");
  });

  it.each<[string, SearchParams]>([
    ["no destination", {}],
    ["an absolute URL", { next: "https://evil.com" }],
    ["a protocol-relative URL", { next: "//evil.com" }],
    ["a repeated parameter", { next: ["/a", "/b"] }],
    ["an auth page", { next: "/sign-up" }],
    ["an encoded auth page with a slash", { next: "/%73ign-in/" }],
    ["the reset-password page", { next: "/reset-password?token=abc" }],
  ])("sends a signed-in user home when there is %s", async (_case, params) => {
    getAuthState.mockResolvedValue({ status: "signed-in", user: signedInUser });

    await expect(renderPage(params)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/");
  });

  // Someone who reset another account's password while signed in here.
  it("shows a signed-in user the form with a notice, without redirecting", async () => {
    getAuthState.mockResolvedValue({ status: "signed-in", user: signedInUser });

    render(await renderPage({ next: "/lessons", notice: "password-updated" }));

    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Password updated — please sign in.",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each<[string, string | string[]]>([
    ["an unknown notice", "account-deleted"],
    ["a repeated parameter", ["password-updated", "password-updated"]],
  ])(
    "still sends a signed-in user to the destination with %s",
    async (_case, notice) => {
      getAuthState.mockResolvedValue({
        status: "signed-in",
        user: signedInUser,
      });

      await expect(renderPage({ next: "/lessons/42", notice })).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(redirect).toHaveBeenCalledWith("/lessons/42");
    },
  );

  it("shows the form when the session check fails, keeping the destination", async () => {
    getAuthState.mockResolvedValue({ status: "unavailable" });

    render(await renderPage({ next: "/lessons" }));

    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
