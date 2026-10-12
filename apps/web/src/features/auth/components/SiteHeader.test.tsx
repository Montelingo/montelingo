import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { AuthState, CurrentUser } from "../model/user";
import { SiteHeader } from "./SiteHeader";

const { getAuthState } = vi.hoisted(() => ({
  getAuthState: vi.fn<() => Promise<AuthState>>(),
}));
vi.mock("../api/session", () => ({ getAuthState }));

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<void>>(),
}));
vi.mock("../api/auth-api", () => ({ signOut }));

vi.mock("@/lib/navigation", () => ({ replaceDocument: vi.fn() }));

const signedInUser: CurrentUser = {
  id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
  email: "ana@example.com",
  createdAt: "2026-09-01T10:00:00Z",
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// The header suspends on the session lookup, and React requires an awaited
// act() around a render that suspends. It resolves to render()'s result once
// the work it can do (including a settled lookup) is done.
function renderSuspending() {
  return act(() => Promise.resolve(render(<SiteHeader />)));
}

// Renders the header and waits for the account controls to stream in.
function renderHeader(state: AuthState) {
  getAuthState.mockResolvedValue(state);
  return renderSuspending();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SiteHeader", () => {
  it.each<AuthState>([
    { status: "signed-out" },
    { status: "signed-in", user: signedInUser },
    { status: "unavailable" },
  ])("is the page banner with a home link when $status", async (state) => {
    await renderHeader(state);

    const banner = screen.getByRole("banner");
    expect(
      within(banner).getByRole("link", { name: "Montelingo" }),
    ).toHaveAttribute("href", "/");
  });

  it("renders at once, while the session lookup is still pending", async () => {
    const lookup = deferred<AuthState>();
    getAuthState.mockReturnValue(lookup.promise);

    await renderSuspending();

    expect(
      within(screen.getByRole("banner")).getByRole("link", {
        name: "Montelingo",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(await axe(screen.getByRole("banner"))).toHaveNoViolations();

    await act(async () => {
      lookup.resolve({ status: "signed-out" });
      await lookup.promise;
    });

    expect(
      await screen.findByRole("navigation", { name: "Account" }),
    ).toBeInTheDocument();
    expect(getAuthState).toHaveBeenCalledTimes(1);
  });

  describe("signed out", () => {
    it("links to sign in and sign up", async () => {
      await renderHeader({ status: "signed-out" });

      const nav = screen.getByRole("navigation", { name: "Account" });
      expect(
        within(nav).getByRole("link", { name: "Sign in" }),
      ).toHaveAttribute("href", "/sign-in");
      expect(
        within(nav).getByRole("link", { name: "Sign up" }),
      ).toHaveAttribute("href", "/sign-up");
      expect(
        screen.queryByRole("button", { name: "Sign out" }),
      ).not.toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
      const { container } = await renderHeader({ status: "signed-out" });

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("signed in", () => {
    it("shows the user's email, linking to their account, and a sign-out button", async () => {
      await renderHeader({ status: "signed-in", user: signedInUser });

      const nav = screen.getByRole("navigation", { name: "Account" });
      const email = within(nav).getByRole("link", { name: "ana@example.com" });
      expect(email).toHaveAttribute("href", "/account");
      // The address may be truncated, so the full one is in the tooltip.
      expect(email).toHaveAttribute("title", "ana@example.com");
      expect(
        within(nav).getByRole("button", { name: "Sign out" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Sign in" }),
      ).not.toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
      const { container } = await renderHeader({
        status: "signed-in",
        user: signedInUser,
      });

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  // "unavailable" means the browser has a session cookie the API could not
  // check. Without a cookie the state is signed-out (see the tests above).
  describe("when the session check fails", () => {
    it("offers sign-out, but neither sign-in nor an unverified email", async () => {
      await renderHeader({ status: "unavailable" });

      const nav = screen.getByRole("navigation", { name: "Account" });
      expect(
        within(nav).getByRole("button", { name: "Sign out" }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(
        screen.queryByRole("link", { name: "Sign in" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
      const { container } = await renderHeader({ status: "unavailable" });

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
