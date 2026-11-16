import { ApiClientError } from "@app/api-client";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "@/features/auth";
import type { Profile } from "@/features/profile/edge";

import HomePage, { metadata } from "./page";

const { getAuthState } = vi.hoisted(() => ({
  getAuthState: vi.fn<() => Promise<AuthState>>(),
}));
vi.mock("@/features/auth/server", () => ({ getAuthState }));

const { getProfile } = vi.hoisted(() => ({
  getProfile: vi.fn<() => Promise<Profile | null>>(),
}));
vi.mock("@/features/profile/server", () => ({ getProfile }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const SIGNED_IN: AuthState = {
  status: "signed-in",
  user: {
    id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
    email: "ana@example.com",
    createdAt: "2026-09-01T10:00:00Z",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HomePage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Montelingo");
  });

  it("welcomes a visitor who is signed out", async () => {
    getAuthState.mockResolvedValue({ status: "signed-out" });

    render(await HomePage());

    expect(screen.getByRole("link", { name: "Nov sam" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Odjavi se" })).toBeNull();
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("welcomes, with signing out, when the account cannot be looked up", async () => {
    getAuthState.mockResolvedValue({ status: "unavailable" });

    render(await HomePage());

    expect(screen.getByRole("link", { name: "Nov sam" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Odjavi se" }),
    ).toBeInTheDocument();
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("shows a signed-in family their child and the way back to the map", async () => {
    getAuthState.mockResolvedValue(SIGNED_IN);
    getProfile.mockResolvedValue({
      name: "Mia",
      ageBand: "7",
      avatar: "owl",
      isComplete: true,
    });

    render(await HomePage());

    expect(screen.getByText("Mia")).toBeInTheDocument();
    expect(
      screen.getByText("Veliki istraživač · 7 godina"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nastavi istraživanje" }),
    ).toHaveAttribute("href", "/play");
    expect(
      screen.getByRole("button", { name: "Odjavi se" }),
    ).toBeInTheDocument();
  });

  it("shows the placeholder explorer when the profile cannot be read", async () => {
    getAuthState.mockResolvedValue(SIGNED_IN);
    getProfile.mockResolvedValue(null);

    render(await HomePage());

    expect(screen.getByText("Istraživač")).toBeInTheDocument();
  });

  it("welcomes a visitor whose session ended between the two calls", async () => {
    getAuthState.mockResolvedValue(SIGNED_IN);
    getProfile.mockRejectedValue(
      new ApiClientError(401, {
        error: {
          code: "authentication_error",
          message: "Authentication required.",
          request_id: "req-1",
          details: null,
        },
      }),
    );

    render(await HomePage());

    expect(screen.getByRole("link", { name: "Nov sam" })).toBeInTheDocument();
  });
});
