import { ApiClientError, ApiNetworkError } from "@app/api-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { authErrorMessages } from "../errors";
import { SignOutButton } from "./SignOutButton";

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<void>>(),
}));
vi.mock("../api/auth-api", () => ({ signOut }));

const { replaceDocument } = vi.hoisted(() => ({
  replaceDocument: vi.fn<(path: string) => void>(),
}));
vi.mock("@/lib/navigation", () => ({ replaceDocument }));

function makeApiError(status: number, code: string): ApiClientError {
  return new ApiClientError(status, {
    error: { code, message: "API message", request_id: "req-1", details: null },
  });
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderButton() {
  const view = render(<SignOutButton />);
  return { ...view, user: userEvent.setup() };
}

function signOutButton() {
  return screen.getByRole("button", { name: /^Sign(ing)? out/ });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignOutButton", () => {
  it("signs out, then loads the home page afresh", async () => {
    signOut.mockResolvedValue(undefined);
    const { user } = renderButton();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(replaceDocument).toHaveBeenCalledWith("/");
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("holds the button while signing out, keeping focus on it", async () => {
    const call = deferred<undefined>();
    signOut.mockReturnValue(call.promise);
    const { user } = renderButton();

    await user.click(signOutButton());

    const button = screen.getByRole("button", { name: "Signing out…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();

    await user.click(button);
    await user.keyboard("{Enter}");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replaceDocument).not.toHaveBeenCalled();

    call.resolve(undefined);
    await waitFor(() => {
      expect(replaceDocument).toHaveBeenCalledTimes(1);
    });
    // Still held while the next page loads.
    expect(signOutButton()).toHaveAccessibleName("Signing out…");
  });

  it("signs out once on a double click", async () => {
    signOut.mockReturnValue(new Promise(() => undefined));
    const { user } = renderButton();

    await user.dblClick(signOutButton());

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an API error", () => makeApiError(500, "internal_server_error")],
    [
      "a network failure",
      () => new ApiNetworkError({ cause: new TypeError("fetch failed") }),
    ],
  ])(
    "says sign-out could not be confirmed after %s, and stays put",
    async (_case, error) => {
      signOut.mockRejectedValue(error());
      const { user } = renderButton();

      await user.click(signOutButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        authErrorMessages.signOutFailed,
      );
      expect(replaceDocument).not.toHaveBeenCalled();
      const button = screen.getByRole("button", { name: "Sign out" });
      expect(button).not.toHaveAttribute("aria-disabled");
      expect(button).toHaveFocus();
    },
  );

  it("can try again after a failure", async () => {
    signOut.mockRejectedValueOnce(makeApiError(500, "internal_server_error"));
    const { user } = renderButton();

    await user.click(signOutButton());
    await screen.findByRole("alert");

    const retry = deferred<undefined>();
    signOut.mockReturnValueOnce(retry.promise);
    await user.click(signOutButton());

    // The alert goes while the retry runs, so a second failure is announced again.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    retry.resolve(undefined);
    await waitFor(() => {
      expect(replaceDocument).toHaveBeenCalledWith("/");
    });
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("has no accessibility violations when idle", async () => {
    const { container } = renderButton();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations while signing out", async () => {
    signOut.mockReturnValue(new Promise(() => undefined));
    const { container, user } = renderButton();

    await user.click(signOutButton());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations after a failure", async () => {
    signOut.mockRejectedValue(makeApiError(500, "internal_server_error"));
    const { container, user } = renderButton();

    await user.click(signOutButton());
    await screen.findByRole("alert");

    expect(await axe(container)).toHaveNoViolations();
  });
});
