import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { CurrentUser } from "@/features/auth";

import AccountPage, { metadata } from "./page";

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

const signedInUser: CurrentUser = {
  id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
  email: "ana@example.com",
  createdAt: "2026-09-01T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AccountPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Account");
  });

  it("shows the signed-in user's email", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);

    render(await AccountPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a visitor whose session has ended to sign in, returning here", async () => {
    getCurrentUser.mockResolvedValue(null);

    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/sign-in?next=%2Faccount");
  });

  it("lets a failed session check reach the error boundary instead of redirecting", async () => {
    getCurrentUser.mockRejectedValue(new Error("API unavailable"));

    await expect(AccountPage()).rejects.toThrow("API unavailable");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);

    const { container } = render(await AccountPage());

    expect(await axe(container)).toHaveNoViolations();
  });
});
