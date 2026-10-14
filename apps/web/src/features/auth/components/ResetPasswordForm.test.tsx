import { ApiClientError, ApiNetworkError, type Schemas } from "@app/api-client";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { PasswordResetConfirmation } from "../api/auth-api";
import { authErrorMessages } from "../errors";
import { validationMessages } from "../model/messages";
import { ResetPasswordForm } from "./ResetPasswordForm";

const { confirmPasswordReset } = vi.hoisted(() => ({
  confirmPasswordReset:
    vi.fn<(confirmation: PasswordResetConfirmation) => Promise<void>>(),
}));
vi.mock("../api/auth-api", () => ({ confirmPasswordReset }));

const { replaceDocument } = vi.hoisted(() => ({
  replaceDocument: vi.fn<(path: string) => void>(),
}));
vi.mock("@/lib/navigation", () => ({ replaceDocument }));

// Shaped like a real token, with characters that change under URL encoding.
const TOKEN = "Zx3-k9_Qp0aLm2VtR8wYb4+/=";

function makeApiError(
  status: number,
  code: string,
  {
    details = null,
    headers = {},
  }: {
    details?: Schemas["ErrorDetail"][] | null;
    headers?: Record<string, string>;
  } = {},
): ApiClientError {
  return new ApiClientError(
    status,
    {
      error: {
        code,
        message: `API message for ${code}`,
        request_id: "req-1",
        details,
      },
    },
    new Headers(headers),
  );
}

function validationError(field: string | null): ApiClientError {
  return makeApiError(422, "validation_error", {
    details: [{ field, code: "invalid_value", message: "API detail message" }],
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

// Lets every pending promise continuation run, including the form's own.
function flushPromises() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function renderForm(token = TOKEN) {
  const view = render(<ResetPasswordForm token={token} />);
  return { ...view, user: userEvent.setup() };
}

function newPasswordInput() {
  return screen.getByLabelText("New password");
}

function confirmInput() {
  return screen.getByLabelText("Confirm new password");
}

function submitButton() {
  return screen.getByRole("button", { name: "Update password" });
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  {
    newPassword = "correct horse",
    confirmPassword = newPassword,
  }: { newPassword?: string; confirmPassword?: string } = {},
) {
  await user.type(newPasswordInput(), newPassword);
  await user.type(confirmInput(), confirmPassword);
  await user.click(submitButton());
}

function invalidLinkHeading() {
  return screen.findByRole("heading", {
    level: 1,
    name: "This reset link doesn’t work",
  });
}

const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ResetPasswordForm", () => {
  it("labels the form with its heading", () => {
    renderForm();

    expect(
      screen.getByRole("heading", { level: 1, name: "Choose a new password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Choose a new password" }),
    ).toBeInTheDocument();
  });

  it("keeps the submit button disabled in the server HTML, until hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ResetPasswordForm token={TOKEN} />);

    expect(
      within(container).getByRole("button", { name: "Update password" }),
    ).toBeDisabled();
  });

  it("enables the submit button once running in the browser", () => {
    renderForm();

    expect(submitButton()).toBeEnabled();
  });

  it("posts, so passwords never reach the URL", () => {
    renderForm();

    expect(
      screen.getByRole("form", { name: "Choose a new password" }),
    ).toHaveAttribute("method", "post");
  });

  it("asks the browser to suggest a new password", () => {
    renderForm();

    for (const input of [newPasswordInput(), confirmInput()]) {
      expect(input).toHaveAttribute("type", "password");
      expect(input).toHaveAttribute("autocomplete", "new-password");
    }
  });

  it("states the password rule up front", () => {
    renderForm();

    expect(newPasswordInput()).toHaveAccessibleDescription(
      "Use at least 8 characters.",
    );
  });

  it("names each show-password toggle after its field", async () => {
    const { user } = renderForm();

    await user.click(
      screen.getByRole("button", { name: "Show confirm new password" }),
    );

    expect(confirmInput()).toHaveAttribute("type", "text");
    expect(newPasswordInput()).toHaveAttribute("type", "password");
  });

  it("never renders the token", () => {
    const { container } = renderForm();

    expect(container.innerHTML).not.toContain(TOKEN);
  });

  describe("validation", () => {
    it("shows every error on submit, focuses the first field, and does not call the API", async () => {
      const { user } = renderForm();

      await user.click(submitButton());

      expect(newPasswordInput()).toHaveAccessibleDescription(
        `Use at least 8 characters. ${validationMessages.passwordRequired}`,
      );
      expect(confirmInput()).toHaveAccessibleDescription(
        validationMessages.confirmPasswordRequired,
      );
      expect(newPasswordInput()).toHaveFocus();
      expect(confirmPasswordReset).not.toHaveBeenCalled();
    });

    it.each([
      ["too short", "short", validationMessages.passwordTooShort],
      ["too long", "a".repeat(129), validationMessages.passwordTooLong],
    ])("rejects a password that is %s", async (_case, newPassword, message) => {
      const { user } = renderForm();

      await fillAndSubmit(user, { newPassword });

      expect(newPasswordInput()).toHaveAccessibleDescription(
        `Use at least 8 characters. ${message}`,
      );
      expect(newPasswordInput()).toHaveFocus();
      expect(confirmPasswordReset).not.toHaveBeenCalled();
    });

    it("focuses a confirmation that does not match", async () => {
      const { user } = renderForm();

      await fillAndSubmit(user, { confirmPassword: "something else" });

      expect(confirmInput()).toHaveAccessibleDescription(
        validationMessages.passwordsDiffer,
      );
      expect(confirmInput()).toHaveFocus();
      expect(confirmPasswordReset).not.toHaveBeenCalled();
    });

    it("clears the mismatch once the confirmation matches", async () => {
      const { user } = renderForm();
      await user.type(newPasswordInput(), "correct horse");
      await user.type(confirmInput(), "correct");
      await user.tab();
      expect(confirmInput()).toHaveAttribute("aria-invalid", "true");

      await user.type(confirmInput(), " horse");

      expect(confirmInput()).not.toHaveAttribute("aria-invalid");
    });
  });

  describe("on success", () => {
    it("sends the token exactly as given with the untrimmed password, then loads sign in afresh", async () => {
      confirmPasswordReset.mockResolvedValue(undefined);
      const { user } = renderForm();

      await fillAndSubmit(user, { newPassword: " correct horse " });

      expect(confirmPasswordReset).toHaveBeenCalledTimes(1);
      expect(confirmPasswordReset).toHaveBeenCalledWith({
        token: TOKEN,
        newPassword: " correct horse ",
      });
      await waitFor(() => {
        expect(replaceDocument).toHaveBeenCalledTimes(1);
      });
      expect(replaceDocument).toHaveBeenCalledWith(
        "/sign-in?notice=password-updated",
      );
    });

    it("stays pending after success while the page navigates away", async () => {
      confirmPasswordReset.mockResolvedValue(undefined);
      const { user } = renderForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(replaceDocument).toHaveBeenCalled();
      });
      expect(screen.getByRole("button", { name: "Updating…" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
  });

  describe("while pending", () => {
    it("holds the submit button until the API answers, sending one request", async () => {
      const response = deferred<undefined>();
      confirmPasswordReset.mockReturnValue(response.promise);
      const { user } = renderForm();

      await fillAndSubmit(user);

      const button = screen.getByRole("button", { name: "Updating…" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      await user.click(button);
      await user.type(confirmInput(), "{Enter}");
      expect(confirmPasswordReset).toHaveBeenCalledTimes(1);

      response.reject(makeApiError(500, "internal_server_error"));

      expect(
        await screen.findByRole("button", { name: "Update password" }),
      ).not.toHaveAttribute("aria-disabled");
    });
  });

  describe("after leaving the page", () => {
    it("does not navigate when the call succeeds", async () => {
      const response = deferred<undefined>();
      confirmPasswordReset.mockReturnValue(response.promise);
      const { user, unmount } = renderForm();
      await fillAndSubmit(user);

      unmount();
      response.resolve(undefined);
      await flushPromises();

      expect(replaceDocument).not.toHaveBeenCalled();
    });
  });

  describe("invalid link", () => {
    it.each<[string, ApiClientError]>([
      ["invalid_reset_token", makeApiError(400, "invalid_reset_token")],
      ["a validation_error on the token", validationError("token")],
    ])(
      "replaces the form with the invalid-link state on %s",
      async (_case, error) => {
        confirmPasswordReset.mockRejectedValue(error);
        const { user } = renderForm();

        await fillAndSubmit(user);

        expect(await invalidLinkHeading()).toHaveFocus();
        expect(
          screen.queryByRole("form", { name: "Choose a new password" }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: "Request a new link" }),
        ).toHaveAttribute("href", "/forgot-password");
        expect(replaceDocument).not.toHaveBeenCalled();
      },
    );

    it("never carries the token into a link", async () => {
      confirmPasswordReset.mockRejectedValue(
        makeApiError(400, "invalid_reset_token"),
      );
      const { container, user } = renderForm();

      await fillAndSubmit(user);
      await invalidLinkHeading();

      expect(container.innerHTML).not.toContain(TOKEN);
      for (const link of screen.getAllByRole("link")) {
        expect(link.getAttribute("href")).not.toContain("token");
      }
    });
  });

  describe("errors", () => {
    it.each<[string, unknown, string]>([
      [
        "authorization_error (Origin check)",
        makeApiError(403, "authorization_error"),
        authErrorMessages.generic,
      ],
      [
        "internal_server_error",
        makeApiError(500, "internal_server_error"),
        authErrorMessages.generic,
      ],
      [
        "not_implemented",
        makeApiError(501, "not_implemented"),
        authErrorMessages.generic,
      ],
      [
        "service_unavailable",
        makeApiError(502, "service_unavailable"),
        authErrorMessages.unreachable,
      ],
      [
        "a network failure",
        new ApiNetworkError({ cause: new TypeError("Failed to fetch") }),
        authErrorMessages.unreachable,
      ],
      [
        "an unexpected error",
        new TypeError("Cannot read properties of undefined"),
        authErrorMessages.generic,
      ],
      [
        "a validation_error on no field",
        validationError(null),
        authErrorMessages.invalidInput,
      ],
    ])(
      "shows %s in the alert and keeps the form",
      async (_case, error, message) => {
        confirmPasswordReset.mockRejectedValue(error);
        const { user } = renderForm();

        await fillAndSubmit(user);

        expect(await screen.findByRole("alert")).toHaveTextContent(message);
        expect(
          screen.getByRole("form", { name: "Choose a new password" }),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("heading", {
            name: "This reset link doesn’t work",
          }),
        ).not.toBeInTheDocument();
        expect(replaceDocument).not.toHaveBeenCalled();
      },
    );

    it("shows the API's new_password validation_error on the field and focuses it", async () => {
      confirmPasswordReset.mockRejectedValue(validationError("new_password"));
      const { user } = renderForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(newPasswordInput()).toHaveAccessibleDescription(
          `Use at least 8 characters. ${validationMessages.passwordLength}`,
        );
      });
      expect(newPasswordInput()).toHaveAttribute("aria-invalid", "true");
      expect(newPasswordInput()).toHaveFocus();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // The confirm endpoint does not document 429, but a proxy in front of the
  // API may still answer with it.
  describe("when rate limited (robustness)", () => {
    beforeEach(() => {
      // The clock and the countdown's interval are faked; userEvent keeps
      // real timeouts.
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    });

    it("holds the submit button, counting down, until Retry-After has passed", async () => {
      confirmPasswordReset
        .mockRejectedValueOnce(
          makeApiError(429, "rate_limited", {
            headers: { "Retry-After": "2" },
          }),
        )
        .mockResolvedValueOnce(undefined);
      const { user } = renderForm();
      await fillAndSubmit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Too many attempts. Try again in 2 seconds.",
      );
      const held = screen.getByRole("button", { name: "Try again in 0:02" });
      expect(held).toHaveAttribute("aria-disabled", "true");
      await user.click(held);
      expect(confirmPasswordReset).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      await user.click(submitButton());

      expect(confirmPasswordReset).toHaveBeenCalledTimes(2);
    });
  });

  describe("the token stays out of the console", () => {
    it.each<[string, () => void]>([
      ["success", () => confirmPasswordReset.mockResolvedValue(undefined)],
      [
        "invalid_reset_token",
        () =>
          confirmPasswordReset.mockRejectedValue(
            makeApiError(400, "invalid_reset_token"),
          ),
      ],
      [
        "a validation_error",
        () => confirmPasswordReset.mockRejectedValue(validationError("token")),
      ],
      [
        "rate_limited",
        () =>
          confirmPasswordReset.mockRejectedValue(
            makeApiError(429, "rate_limited"),
          ),
      ],
      [
        "a network failure",
        () =>
          confirmPasswordReset.mockRejectedValue(
            new ApiNetworkError({ cause: new TypeError("Failed to fetch") }),
          ),
      ],
      [
        "an unexpected error",
        () => confirmPasswordReset.mockRejectedValue(new Error("boom")),
      ],
    ])("on %s", async (_case, arrange) => {
      const spies = consoleMethods.map((method) =>
        vi.spyOn(console, method).mockImplementation(() => undefined),
      );
      arrange();
      const { user } = renderForm();

      await fillAndSubmit(user);
      await flushPromises();

      expect(confirmPasswordReset).toHaveBeenCalledTimes(1);
      for (const spy of spies) {
        for (const args of spy.mock.calls) {
          expect(JSON.stringify(args.map(String))).not.toContain(TOKEN);
        }
      }
    });
  });

  describe("accessibility", () => {
    it("has no violations when idle", async () => {
      const { container } = renderForm();

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations with field errors", async () => {
      const { container, user } = renderForm();
      await user.click(submitButton());

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations with an alert", async () => {
      confirmPasswordReset.mockRejectedValue(
        makeApiError(500, "internal_server_error"),
      );
      const { container, user } = renderForm();
      await fillAndSubmit(user);
      await screen.findByRole("alert");

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations while pending", async () => {
      confirmPasswordReset.mockReturnValue(deferred<undefined>().promise);
      const { container, user } = renderForm();
      await fillAndSubmit(user);

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations in the invalid-link state", async () => {
      confirmPasswordReset.mockRejectedValue(
        makeApiError(400, "invalid_reset_token"),
      );
      const { container, user } = renderForm();
      await fillAndSubmit(user);
      await invalidLinkHeading();

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
