import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResetPasswordPage, { metadata } from "./page";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/auth/server", () => ({ getCurrentUser }));

function renderPage(searchParams: { token?: string | string[] } = {}) {
  return ResetPasswordPage({ searchParams: Promise.resolve(searchParams) });
}

function invalidLinkHeading() {
  return screen.queryByRole("heading", {
    level: 1,
    name: "This reset link doesn’t work",
  });
}

describe("ResetPasswordPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Choose a new password");
  });

  it("keeps the token in its URL out of Referer headers", () => {
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("is never indexed", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("shows the form for a token, without checking the session", async () => {
    render(await renderPage({ token: "Zx3-k9_Qp0aLm2VtR8wYb4" }));

    expect(
      screen.getByRole("form", { name: "Choose a new password" }),
    ).toBeInTheDocument();
    expect(invalidLinkHeading()).not.toBeInTheDocument();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("does not move focus on page load", async () => {
    render(await renderPage());

    expect(invalidLinkHeading()).not.toHaveFocus();
  });

  it.each<[string, { token?: string | string[] }]>([
    ["no token", {}],
    ["an empty token", { token: "" }],
    ["a token over 256 characters", { token: "a".repeat(257) }],
    ["a repeated token", { token: ["a", "b"] }],
  ])("shows the invalid-link state for %s", async (_case, params) => {
    render(await renderPage(params));

    expect(invalidLinkHeading()).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});
