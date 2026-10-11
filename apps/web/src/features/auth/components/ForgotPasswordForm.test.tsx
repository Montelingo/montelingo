import { ApiClientError, ApiNetworkError, type Schemas } from "@app/api-client";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { authErrorMessages } from "../errors";
import { validationMessages } from "../model/messages";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn<(input: { email: string }) => Promise<void>>(),
}));
vi.mock("../api/auth-api", () => ({ requestPasswordReset }));

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

function renderForm() {
  const view = render(<ForgotPasswordForm />);
  return { ...view, user: userEvent.setup() };
}

function emailInput() {
  return screen.getByLabelText("Email");
}

function submitButton() {
  return screen.getByRole("button", { name: "Send reset link" });
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  email = "ana@example.com",
) {
  await user.type(emailInput(), email);
  await user.click(submitButton());
}

function confirmationHeading() {
  return screen.findByRole("heading", { level: 1, name: "Check your email" });
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ForgotPasswordForm", () => {
  it("labels the form with its heading", () => {
    renderForm();

    expect(
      screen.getByRole("heading", { level: 1, name: "Forgot your password?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Forgot your password?" }),
    ).toBeInTheDocument();
  });

  it("keeps the submit button disabled in the server HTML, until hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ForgotPasswordForm />);

    expect(
      within(container).getByRole("button", { name: "Send reset link" }),
    ).toBeDisabled();
  });

  it("enables the submit button once running in the browser", () => {
    renderForm();

    expect(submitButton()).toBeEnabled();
  });

  it("posts, so the email never reaches the URL", () => {
    renderForm();

    expect(
      screen.getByRole("form", { name: "Forgot your password?" }),
    ).toHaveAttribute("method", "post");
  });

  it("asks the browser to fill in the email", () => {
    renderForm();

    expect(emailInput()).toHaveAttribute("type", "email");
    expect(emailInput()).toHaveAttribute("autocomplete", "email");
  });

  it("links back to sign in", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  describe("validation", () => {
    it("shows the email's error when the user leaves it", async () => {
      const { user } = renderForm();

      await user.click(emailInput());
      await user.tab();

      expect(emailInput()).toHaveAttribute("aria-invalid", "true");
      expect(emailInput()).toHaveAccessibleDescription(
        validationMessages.emailRequired,
      );
    });

    it("does not show an error while the user is still typing", async () => {
      const { user } = renderForm();

      await user.type(emailInput(), "ana@");

      expect(emailInput()).not.toHaveAttribute("aria-invalid");
    });

    it.each([
      ["empty", "", validationMessages.emailRequired],
      ["only spaces", "   ", validationMessages.emailRequired],
      ["not an email", "ana@example", validationMessages.emailInvalid],
    ])(
      "rejects an email that is %s on submit, focuses it, and does not call the API",
      async (_case, email, message) => {
        const { user } = renderForm();

        if (email !== "") {
          await user.type(emailInput(), email);
        }
        await user.click(submitButton());

        expect(emailInput()).toHaveAccessibleDescription(message);
        expect(emailInput()).toHaveFocus();
        expect(requestPasswordReset).not.toHaveBeenCalled();
      },
    );
  });

  describe("on success", () => {
    it("requests a link for the trimmed email and shows the confirmation", async () => {
      requestPasswordReset.mockResolvedValue(undefined);
      const { user } = renderForm();

      await fillAndSubmit(user, "  ana@example.com ");

      expect(requestPasswordReset).toHaveBeenCalledTimes(1);
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: "ana@example.com",
      });
      const heading = await confirmationHeading();
      expect(heading).toHaveFocus();
      expect(screen.getByText(/If an account exists for/)).toHaveTextContent(
        "If an account exists for ana@example.com, we’ve sent a link to reset your password. The link works once and expires after a short time.",
      );
      expect(
        screen.queryByRole("form", { name: "Forgot your password?" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Back to sign in" }),
      ).toHaveAttribute("href", "/sign-in");
    });

    it("submits when the user presses Enter in the field", async () => {
      requestPasswordReset.mockResolvedValue(undefined);
      const { user } = renderForm();

      await user.type(emailInput(), "ana@example.com{Enter}");

      expect(requestPasswordReset).toHaveBeenCalledTimes(1);
      await confirmationHeading();
    });
  });

  // The API answers 204 whether or not the account exists, so an error never
  // reveals one. Every failure is shown, so nobody waits for an email that was
  // never sent.
  describe("errors", () => {
    it.each<[string, unknown, string]>([
      [
        "a network failure",
        new ApiNetworkError({ cause: new TypeError("Failed to fetch") }),
        authErrorMessages.unreachable,
      ],
      [
        "service_unavailable",
        makeApiError(502, "service_unavailable"),
        authErrorMessages.unreachable,
      ],
      [
        "rate_limited with Retry-After",
        makeApiError(429, "rate_limited", { headers: { "Retry-After": "30" } }),
        "Too many attempts. Try again in 30 seconds.",
      ],
      [
        "rate_limited without Retry-After",
        makeApiError(429, "rate_limited"),
        authErrorMessages.rateLimited,
      ],
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
        "a response without the error envelope",
        makeApiError(502, "request_failed"),
        authErrorMessages.generic,
      ],
      [
        "an unknown code",
        makeApiError(404, "user_not_found"),
        authErrorMessages.generic,
      ],
      [
        "not_implemented",
        makeApiError(501, "not_implemented"),
        authErrorMessages.generic,
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
      "shows %s in the alert and keeps the form, without the confirmation",
      async (_case, error, message) => {
        requestPasswordReset.mockRejectedValue(error);
        const { user } = renderForm();

        await fillAndSubmit(user);

        expect(await screen.findByRole("alert")).toHaveTextContent(message);
        expect(
          screen.getByRole("form", { name: "Forgot your password?" }),
        ).toBeInTheDocument();
        expect(emailInput()).toHaveValue("ana@example.com");
        expect(
          screen.queryByRole("heading", { name: "Check your email" }),
        ).not.toBeInTheDocument();
      },
    );

    it("shows the API's email validation_error on the field and focuses it", async () => {
      requestPasswordReset.mockRejectedValue(validationError("email"));
      const { user } = renderForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(emailInput()).toHaveAccessibleDescription(
          validationMessages.emailInvalid,
        );
      });
      expect(emailInput()).toHaveAttribute("aria-invalid", "true");
      expect(emailInput()).toHaveFocus();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("lets the user try again after a network failure", async () => {
      requestPasswordReset
        .mockRejectedValueOnce(
          new ApiNetworkError({ cause: new TypeError("Failed to fetch") }),
        )
        .mockResolvedValueOnce(undefined);
      const { user } = renderForm();
      await fillAndSubmit(user);
      await screen.findByRole("alert");

      await user.click(submitButton());

      expect(await confirmationHeading()).toBeInTheDocument();
      expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    });
  });

  describe("when rate limited", () => {
    beforeEach(() => {
      // The clock and the countdown's interval are faked; userEvent keeps
      // real timeouts.
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    });

    it("holds the submit button, counting down, until Retry-After has passed", async () => {
      requestPasswordReset
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
      expect(requestPasswordReset).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      await user.click(submitButton());

      expect(requestPasswordReset).toHaveBeenCalledTimes(2);
      expect(await confirmationHeading()).toBeInTheDocument();
    });
  });

  describe("while pending", () => {
    it("holds the submit button until the API answers, sending one request", async () => {
      const response = deferred<undefined>();
      requestPasswordReset.mockReturnValue(response.promise);
      const { user } = renderForm();

      await fillAndSubmit(user);

      const button = screen.getByRole("button", { name: "Sending…" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      await user.click(button);
      await user.type(emailInput(), "{Enter}");
      expect(requestPasswordReset).toHaveBeenCalledTimes(1);

      response.resolve(undefined);

      expect(await confirmationHeading()).toBeInTheDocument();
    });
  });

  describe("send another link", () => {
    it("returns to the form with the email filled in and focused", async () => {
      requestPasswordReset.mockResolvedValue(undefined);
      const { user } = renderForm();
      await fillAndSubmit(user, " ana@example.com ");
      await confirmationHeading();

      await user.click(
        screen.getByRole("button", { name: "send another link" }),
      );

      expect(
        screen.getByRole("form", { name: "Forgot your password?" }),
      ).toBeInTheDocument();
      expect(emailInput()).toHaveValue("ana@example.com");
      expect(emailInput()).toHaveFocus();
      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("requests another link for the same or a corrected email", async () => {
      requestPasswordReset.mockResolvedValue(undefined);
      const { user } = renderForm();
      await fillAndSubmit(user, "ana@exmaple.com");
      await confirmationHeading();
      await user.click(
        screen.getByRole("button", { name: "send another link" }),
      );

      await user.clear(emailInput());
      await fillAndSubmit(user, "ana@example.com");

      expect(requestPasswordReset).toHaveBeenLastCalledWith({
        email: "ana@example.com",
      });
      expect(await confirmationHeading()).toHaveFocus();
      expect(screen.getByText(/If an account exists for/)).toHaveTextContent(
        "ana@example.com",
      );
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
      requestPasswordReset.mockRejectedValue(
        makeApiError(429, "rate_limited", { headers: { "Retry-After": "30" } }),
      );
      const { container, user } = renderForm();
      await fillAndSubmit(user);
      await screen.findByRole("alert");

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations while pending", async () => {
      requestPasswordReset.mockReturnValue(deferred<undefined>().promise);
      const { container, user } = renderForm();
      await fillAndSubmit(user);

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations on the confirmation", async () => {
      requestPasswordReset.mockResolvedValue(undefined);
      const { container, user } = renderForm();
      await fillAndSubmit(user);
      await confirmationHeading();

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations back on the form after send another link", async () => {
      requestPasswordReset.mockResolvedValue(undefined);
      const { container, user } = renderForm();
      await fillAndSubmit(user);
      await confirmationHeading();
      await user.click(
        screen.getByRole("button", { name: "send another link" }),
      );

      expect(emailInput()).toHaveFocus();
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
