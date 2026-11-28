import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { AuthState, CurrentUser } from "@/features/auth";

import WelcomeLayout from "../layout";
import SignUpPage, { metadata } from "./page";

const { getAuthState } = vi.hoisted(() => ({
  getAuthState: vi.fn<() => Promise<AuthState>>(),
}));
vi.mock("@/features/auth/server", () => ({ getAuthState }));

const { getPrivacyPolicyVersion } = vi.hoisted(() => ({
  getPrivacyPolicyVersion: vi.fn<() => Promise<string>>(),
}));
vi.mock("@/features/privacy/server", () => ({ getPrivacyPolicyVersion }));

const { signUpAndSignIn } = vi.hoisted(() => ({
  signUpAndSignIn: vi.fn(),
}));
vi.mock("@/features/auth/api/auth-api", () => ({ signUpAndSignIn }));

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
  return SignUpPage({ searchParams: Promise.resolve(searchParams) });
}

beforeEach(() => {
  vi.clearAllMocks();
  getPrivacyPolicyVersion.mockResolvedValue("2026-12-01");
});

describe("SignUpPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Napravi nalog");
  });

  it("shows the form to a signed-out visitor, keeping the destination", async () => {
    getAuthState.mockResolvedValue({ status: "signed-out" });

    render(await renderPage({ next: "/lessons" }));

    expect(
      screen.getByRole("form", { name: "Napravi porodični nalog" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prijavi se" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Flessons",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(["https://evil.com", "/forgot-password"])(
    "drops the destination %j for a signed-out visitor",
    async (next) => {
      getAuthState.mockResolvedValue({ status: "signed-out" });

      render(await renderPage({ next }));

      expect(screen.getByRole("link", { name: "Prijavi se" })).toHaveAttribute(
        "href",
        "/sign-in",
      );
    },
  );

  it("sends a signed-in user to the destination", async () => {
    getAuthState.mockResolvedValue({ status: "signed-in", user: signedInUser });

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
  ])(
    "sends a signed-in user to the map when there is %s",
    async (_case, params) => {
      getAuthState.mockResolvedValue({
        status: "signed-in",
        user: signedInUser,
      });

      await expect(renderPage(params)).rejects.toThrow("NEXT_REDIRECT");

      expect(redirect).toHaveBeenCalledWith("/play");
    },
  );

  it("sends the policy version read when the page rendered with the consent", async () => {
    getAuthState.mockResolvedValue({ status: "signed-out" });
    getPrivacyPolicyVersion.mockResolvedValue("2027-03-01");
    signUpAndSignIn.mockReturnValue(new Promise(() => {}));
    const actor = userEvent.setup();

    render(await renderPage());
    await actor.type(
      screen.getByLabelText("E-pošta odrasle osobe"),
      "ana@example.com",
    );
    await actor.type(screen.getByLabelText("Lozinka"), "correct horse");
    await actor.type(screen.getByLabelText("Potvrdi lozinku"), "correct horse");
    await actor.click(screen.getByRole("checkbox"));
    await actor.click(screen.getByRole("button", { name: "Napravi nalog" }));

    expect(signUpAndSignIn).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "correct horse",
      privacyPolicyVersion: "2027-03-01",
    });
  });

  it("shows the form when the session check fails, keeping the destination", async () => {
    getAuthState.mockResolvedValue({ status: "unavailable" });

    render(await renderPage({ next: "/lessons" }));

    expect(
      screen.getByRole("form", { name: "Napravi porodični nalog" }),
    ).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("has no accessibility violations in the welcome frame", async () => {
    getAuthState.mockResolvedValue({ status: "signed-out" });

    const { container } = render(
      <WelcomeLayout>{await renderPage()}</WelcomeLayout>,
    );

    expect(
      screen.getByRole("form", { name: "Napravi porodični nalog" }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
