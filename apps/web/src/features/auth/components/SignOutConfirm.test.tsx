import { ApiClientError, ApiNetworkError } from "@app/api-client";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { authErrorMessages } from "../errors";
import { SignOutConfirm } from "./SignOutConfirm";

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<void>>(),
}));
vi.mock("../api/auth-api", () => ({ signOut }));

const { replaceDocument } = vi.hoisted(() => ({
  replaceDocument: vi.fn<(path: string) => void>(),
}));
vi.mock("@/lib/navigation", () => ({ replaceDocument }));

const EMAIL = "roditelj@example.com";

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderConfirm() {
  const view = render(<SignOutConfirm email={EMAIL} />);
  return { ...view, user: userEvent.setup() };
}

function row() {
  return screen.getByRole("button", { name: "Odjavi se" });
}

function dialog() {
  return screen.getByRole<HTMLDialogElement>("dialog", {
    name: "Odjaviti se iz Montelinga?",
  });
}

function confirmButton() {
  return within(dialog()).getByRole("button", {
    name: /^(Odjavi se|Odjavljujem…)$/,
  });
}

function stayButton() {
  return within(dialog()).getByRole("button", { name: "Ostani prijavljen" });
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(row());
  return dialog();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignOutConfirm", () => {
  it("is the grown-ups area's red row, with its icon, and asks nothing yet", () => {
    renderConfirm();

    expect(row()).toHaveAttribute("aria-haspopup", "dialog");
    expect(row().querySelector('img[src*="icon-logout"]')).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks first, saying where the progress is saved", async () => {
    const { user } = renderConfirm();

    const asked = await openDialog(user);

    expect(asked).toHaveAttribute("open");
    expect(asked).toHaveAccessibleDescription(
      `Napredak je sačuvan na nalogu ${EMAIL}. Trebaće ti ponovna prijava.`,
    );
    expect(asked.querySelector('img[src*="icon-logout"]')).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("starts on the safe choice, Ostani prijavljen", async () => {
    const { user } = renderConfirm();

    await openDialog(user);

    expect(stayButton()).toHaveFocus();
  });

  // A browser's modal keeps the focus in the dialog; jsdom's stand-in does
  // not, so this checks only the order the focus moves in.
  it("puts Odjavi se before Ostani prijavljen", async () => {
    const { user } = renderConfirm();
    await openDialog(user);

    await user.tab({ shift: true });

    expect(confirmButton()).toHaveFocus();
    expect(
      confirmButton().compareDocumentPosition(stayButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("stays signed in with Ostani prijavljen, back on the row", async () => {
    const { user } = renderConfirm();
    await openDialog(user);

    await user.click(stayButton());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(row()).toHaveFocus();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("closes with Escape, back on the row", async () => {
    const { user } = renderConfirm();
    await openDialog(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(row()).toHaveFocus();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out, then loads the welcome screen afresh", async () => {
    signOut.mockResolvedValue(undefined);
    const { user } = renderConfirm();
    await openDialog(user);

    await user.click(confirmButton());

    await waitFor(() => {
      expect(replaceDocument).toHaveBeenCalledWith("/");
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("holds both buttons while signing out, and Escape does not close it", async () => {
    const call = deferred<undefined>();
    signOut.mockReturnValue(call.promise);
    const { user } = renderConfirm();
    await openDialog(user);

    await user.click(confirmButton());

    expect(confirmButton()).toHaveAccessibleName("Odjavljujem…");
    expect(confirmButton()).toHaveAttribute("aria-disabled", "true");
    expect(stayButton()).toHaveAttribute("aria-disabled", "true");
    expect(confirmButton()).toHaveFocus();

    await user.click(confirmButton());
    await user.click(stayButton());
    await user.keyboard("{Escape}");
    expect(dialog()).toHaveAttribute("open");
    expect(signOut).toHaveBeenCalledTimes(1);

    call.resolve(undefined);
    await waitFor(() => {
      expect(replaceDocument).toHaveBeenCalledTimes(1);
    });
  });

  it("stays open while signing out even when the browser closes it, so a failure is still shown", async () => {
    // Chrome closes a modal on a second Escape without a tap in between,
    // whatever its `cancel` handler does.
    let fail: (reason: unknown) => void = () => undefined;
    signOut.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const { user } = renderConfirm();
    await openDialog(user);
    await user.click(confirmButton());

    act(() => {
      dialog().close();
    });

    expect(dialog()).toHaveAttribute("open");
    act(() => {
      fail(new ApiNetworkError({ cause: new TypeError("fetch failed") }));
    });
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      authErrorMessages.signOutFailed,
    );
  });

  it.each([
    [
      "an API error",
      () =>
        new ApiClientError(500, {
          error: {
            code: "internal_server_error",
            message: "API message",
            request_id: "req-1",
            details: null,
          },
        }),
    ],
    [
      "a network failure",
      () => new ApiNetworkError({ cause: new TypeError("fetch failed") }),
    ],
  ])(
    "says sign-out was not confirmed after %s, in the dialog, and can try again",
    async (_case, error) => {
      signOut.mockRejectedValueOnce(error());
      const { user } = renderConfirm();
      await openDialog(user);

      await user.click(confirmButton());

      expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
        authErrorMessages.signOutFailed,
      );
      expect(replaceDocument).not.toHaveBeenCalled();
      expect(confirmButton()).not.toHaveAttribute("aria-disabled");
      expect(stayButton()).not.toHaveAttribute("aria-disabled");

      signOut.mockResolvedValueOnce(undefined);
      await user.click(confirmButton());

      await waitFor(() => {
        expect(replaceDocument).toHaveBeenCalledWith("/");
      });
      expect(signOut).toHaveBeenCalledTimes(2);
    },
  );

  it("opens afresh, without the last failure, after it was closed", async () => {
    signOut.mockRejectedValueOnce(new ApiNetworkError({ cause: new Error() }));
    const { user } = renderConfirm();
    await openDialog(user);
    await user.click(confirmButton());
    await within(dialog()).findByRole("alert");

    await user.click(stayButton());
    await openDialog(user);

    expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has no accessibility violations, closed or open", async () => {
    const { container, user } = renderConfirm();

    expect(await axe(container)).toHaveNoViolations();

    await openDialog(user);

    expect(await axe(container)).toHaveNoViolations();
  });
});
