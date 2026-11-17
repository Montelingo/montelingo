import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "@/features/auth";
import type { ProfileResult } from "@/features/profile/server";

import { loadHomeView } from "./home-view";

const { getAuthState } = vi.hoisted(() => ({
  getAuthState: vi.fn<() => Promise<AuthState>>(),
}));
vi.mock("@/features/auth/server", () => ({ getAuthState }));

const { getProfileResult } = vi.hoisted(() => ({
  getProfileResult: vi.fn<() => Promise<ProfileResult>>(),
}));
vi.mock("@/features/profile/server", () => ({ getProfileResult }));

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

describe("loadHomeView", () => {
  it("welcomes a signed-out visitor, with nothing to sign out of", async () => {
    getAuthState.mockResolvedValue({ status: "signed-out" });

    await expect(loadHomeView()).resolves.toEqual({
      status: "visitor",
      canSignOut: false,
    });
    expect(getProfileResult).not.toHaveBeenCalled();
  });

  it("lets a visitor sign out when the account cannot be looked up", async () => {
    getAuthState.mockResolvedValue({ status: "unavailable" });

    await expect(loadHomeView()).resolves.toEqual({
      status: "visitor",
      canSignOut: true,
    });
    expect(getProfileResult).not.toHaveBeenCalled();
  });

  it("shows a signed-in family their child", async () => {
    getAuthState.mockResolvedValue(SIGNED_IN);
    getProfileResult.mockResolvedValue({
      status: "ready",
      profile: { name: "Mia", ageBand: "7", avatar: "owl", isComplete: true },
    });

    await expect(loadHomeView()).resolves.toEqual({
      status: "family",
      explorer: {
        name: "Mia",
        avatar: "owl",
        title: "Veliki istraživač · 7 godina",
      },
    });
  });

  it("shows no child before the profile is set up", async () => {
    getAuthState.mockResolvedValue(SIGNED_IN);
    getProfileResult.mockResolvedValue({
      status: "ready",
      profile: { name: null, ageBand: null, avatar: null, isComplete: false },
    });

    await expect(loadHomeView()).resolves.toEqual({
      status: "family",
      explorer: null,
    });
  });

  it("shows the placeholder explorer when the profile cannot be read", async () => {
    getAuthState.mockResolvedValue(SIGNED_IN);
    getProfileResult.mockResolvedValue({ status: "unavailable" });

    await expect(loadHomeView()).resolves.toEqual({
      status: "family",
      explorer: null,
    });
  });

  it("welcomes a visitor whose session ended between the two calls", async () => {
    getAuthState.mockResolvedValue(SIGNED_IN);
    getProfileResult.mockResolvedValue({ status: "signed-out" });

    await expect(loadHomeView()).resolves.toEqual({
      status: "visitor",
      canSignOut: false,
    });
  });
});
