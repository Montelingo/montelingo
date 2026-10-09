import { ApiClientError, ApiNetworkError, type Schemas } from "@app/api-client";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { Credentials } from "../api/auth-api";
import { authErrorMessages, SignInAfterSignUpError } from "../errors";
import { validationMessages } from "../model/messages";
import type { CurrentUser } from "../model/user";
import { SignUpForm } from "./SignUpForm";

const { signUpAndSignIn } = vi.hoisted(() => ({
  signUpAndSignIn: vi.fn<(credentials: Credentials) => Promise<CurrentUser>>(),
}));
vi.mock("../api/auth-api", () => ({ signUpAndSignIn }));

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const user: CurrentUser = {
  id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
  email: "ana@example.com",
  createdAt: "2026-09-01T10:00:00Z",
};

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

function renderForm(redirectTo = "/") {
  const view = render(<SignUpForm redirectTo={redirectTo} />);
  return { ...view, user: userEvent.setup() };
}

function emailInput() {
  return screen.getByLabelText("Email");
}

function passwordInput() {
  return screen.getByLabelText("Password");
}

function confirmInput() {
  return screen.getByLabelText("Confirm password");
}

function submitButton() {
  return screen.getByRole("button", { name: "Create account" });
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  {
    email = "ana@example.com",
    password = "correct horse",
    confirmPassword = password,
  }: { email?: string; password?: string; confirmPassword?: string } = {},
) {
  await user.type(emailInput(), email);
  await user.type(passwordInput(), password);
  await user.type(confirmInput(), confirmPassword);
  await user.click(submitButton());
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SignUpForm", () => {
  it("labels the form with its heading", () => {
    renderForm();

    expect(
      screen.getByRole("form", { name: "Create your account" }),
    ).toBeInTheDocument();
  });

  it("posts if submitted before hydration, so credentials never reach the URL", () => {
    renderForm();

    expect(
      screen.getByRole("form", { name: "Create your account" }),
    ).toHaveAttribute("method", "post");
  });

  it("names each show-password toggle after its field", async () => {
    const { user: actor } = renderForm();

    await actor.click(
      screen.getByRole("button", { name: "Show confirm password" }),
    );

    expect(confirmInput()).toHaveAttribute("type", "text");
    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("asks the browser to fill in the email and suggest a new password", () => {
    renderForm();

    expect(emailInput()).toHaveAttribute("type", "email");
    expect(emailInput()).toHaveAttribute("autocomplete", "email");
    expect(passwordInput()).toHaveAttribute("autocomplete", "new-password");
    expect(confirmInput()).toHaveAttribute("autocomplete", "new-password");
  });

  it("states the password rule up front", () => {
    renderForm();

    expect(passwordInput()).toHaveAccessibleDescription(
      "Use at least 8 characters.",
    );
  });

  it("links to sign in, keeping the destination", () => {
    renderForm("/lessons");

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Flessons",
    );
  });

  describe("validation", () => {
    it("shows a field's error when the user leaves it", async () => {
      const { user: actor } = renderForm();

      await actor.type(passwordInput(), "short");
      await actor.tab();

      expect(passwordInput()).toHaveAttribute("aria-invalid", "true");
      expect(passwordInput()).toHaveAccessibleDescription(
        `Use at least 8 characters. ${validationMessages.passwordTooShort}`,
      );
      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(confirmInput()).not.toHaveAttribute("aria-invalid");
    });

    it("reports a confirmation that does not match, and clears it once it does", async () => {
      const { user: actor } = renderForm();
      await actor.type(passwordInput(), "correct horse");
      await actor.type(confirmInput(), "correct hose");
      await actor.tab();

      expect(confirmInput()).toHaveAccessibleDescription(
        validationMessages.passwordsDiffer,
      );

      await actor.clear(confirmInput());
      await actor.type(confirmInput(), "correct horse");

      expect(confirmInput()).not.toHaveAttribute("aria-invalid");
    });

    it("re-checks a touched confirmation when the password changes", async () => {
      const { user: actor } = renderForm();
      await actor.type(passwordInput(), "correct horse");
      await actor.type(confirmInput(), "correct horse");
      await actor.tab();
      expect(confirmInput()).not.toHaveAttribute("aria-invalid");

      await actor.type(passwordInput(), "!");

      expect(confirmInput()).toHaveAccessibleDescription(
        validationMessages.passwordsDiffer,
      );
    });

    it("shows every error on submit, focuses the first field, and does not call the API", async () => {
      const { user: actor } = renderForm();

      await actor.click(submitButton());

      expect(emailInput()).toHaveAccessibleDescription(
        validationMessages.emailRequired,
      );
      expect(passwordInput()).toHaveAccessibleDescription(
        `Use at least 8 characters. ${validationMessages.passwordRequired}`,
      );
      expect(confirmInput()).toHaveAccessibleDescription(
        validationMessages.confirmPasswordRequired,
      );
      expect(emailInput()).toHaveFocus();
      expect(signUpAndSignIn).not.toHaveBeenCalled();
    });

    it("focuses the mismatched confirmation on submit", async () => {
      const { user: actor } = renderForm();

      await fillAndSubmit(actor, { confirmPassword: "something else" });

      expect(confirmInput()).toHaveFocus();
      expect(signUpAndSignIn).not.toHaveBeenCalled();
    });
  });

  describe("on success", () => {
    it("signs up and in with the trimmed email, then goes to the destination and refreshes", async () => {
      signUpAndSignIn.mockResolvedValue(user);
      const { user: actor } = renderForm("/lessons/42");

      await fillAndSubmit(actor, { email: " ana@example.com  " });

      expect(signUpAndSignIn).toHaveBeenCalledTimes(1);
      expect(signUpAndSignIn).toHaveBeenCalledWith({
        email: "ana@example.com",
        password: "correct horse",
      });
      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/lessons/42");
      });
      expect(router.refresh).toHaveBeenCalledTimes(1);
      expect(router.replace.mock.invocationCallOrder[0]).toBeLessThan(
        router.refresh.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it.each([
      ["the default", "/"],
      ["an absolute URL", "https://evil.com/phish"],
      ["a backslash host", "/\\evil.com"],
      ["the sign-up page", "/sign-up"],
      ["the forgot-password page", "/Forgot-Password/"],
    ])("goes home when the destination is %s", async (_case, redirectTo) => {
      signUpAndSignIn.mockResolvedValue(user);
      const { user: actor } = renderForm(redirectTo);

      await fillAndSubmit(actor);

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/");
      });
    });
  });

  describe("while pending", () => {
    it("holds the submit button until the API answers", async () => {
      const response = deferred<CurrentUser>();
      signUpAndSignIn.mockReturnValue(response.promise);
      const { user: actor } = renderForm();

      await fillAndSubmit(actor);

      const button = screen.getByRole("button", { name: "Creating account…" });
      expect(button).toHaveAttribute("aria-disabled", "true");

      await actor.click(button);
      expect(signUpAndSignIn).toHaveBeenCalledTimes(1);

      response.reject(makeApiError(409, "email_taken"));

      expect(
        await screen.findByRole("button", { name: "Create account" }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("stays pending after success while the page navigates away", async () => {
      signUpAndSignIn.mockResolvedValue(user);
      const { user: actor } = renderForm();

      await fillAndSubmit(actor);

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalled();
      });
      expect(
        screen.getByRole("button", { name: "Creating account…" }),
      ).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("errors", () => {
    it("shows email_taken on the email field with a link to sign in", async () => {
      signUpAndSignIn.mockRejectedValue(makeApiError(409, "email_taken"));
      const { user: actor } = renderForm("/lessons");

      await fillAndSubmit(actor);

      await waitFor(() => {
        expect(emailInput()).toHaveAttribute("aria-invalid", "true");
      });
      expect(emailInput()).toHaveAccessibleDescription(
        `${authErrorMessages.emailTaken} Sign in instead`,
      );
      expect(emailInput()).toHaveFocus();
      expect(
        screen.getByRole("link", { name: "Sign in instead" }),
      ).toHaveAttribute("href", "/sign-in?next=%2Flessons");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it("ignores email_taken for an email the user changed while waiting", async () => {
      const response = deferred<CurrentUser>();
      signUpAndSignIn.mockReturnValue(response.promise);
      const { user: actor } = renderForm();
      await fillAndSubmit(actor);

      await actor.clear(emailInput());
      await actor.type(emailInput(), "bo@example.com");
      response.reject(makeApiError(409, "email_taken"));

      expect(
        await screen.findByRole("button", { name: "Create account" }),
      ).toBeInTheDocument();
      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(
        screen.queryByRole("link", { name: "Sign in instead" }),
      ).not.toBeInTheDocument();
    });

    it("does not navigate when the user left before the call finished", async () => {
      const response = deferred<CurrentUser>();
      signUpAndSignIn.mockReturnValue(response.promise);
      const { user: actor, unmount } = renderForm();
      await fillAndSubmit(actor);

      unmount();
      response.resolve(user);
      await flushPromises();

      expect(router.replace).not.toHaveBeenCalled();
      expect(router.refresh).not.toHaveBeenCalled();
    });

    it("drops email_taken and its link once the email changes", async () => {
      signUpAndSignIn.mockRejectedValue(makeApiError(409, "email_taken"));
      const { user: actor } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("link", { name: "Sign in instead" });

      await actor.clear(emailInput());
      await actor.type(emailInput(), "bo@example.com");

      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(
        screen.queryByRole("link", { name: "Sign in instead" }),
      ).not.toBeInTheDocument();
    });

    it("sends the user to sign in when the account was created but sign-in failed", async () => {
      signUpAndSignIn.mockRejectedValue(
        new SignInAfterSignUpError({
          cause: makeApiError(429, "rate_limited"),
        }),
      );
      const { user: actor } = renderForm("/lessons");

      await fillAndSubmit(actor);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(authErrorMessages.signInAfterSignUp);
      expect(
        within(alert).getByRole("link", { name: "Go to sign in" }),
      ).toHaveAttribute("href", "/sign-in?next=%2Flessons");
      expect(router.replace).not.toHaveBeenCalled();
    });

    it.each<[string, unknown, string]>([
      [
        "rate_limited with Retry-After",
        makeApiError(429, "rate_limited", {
          headers: { "Retry-After": "120" },
        }),
        "Too many attempts. Try again in 2 minutes.",
      ],
      [
        "rate_limited without Retry-After",
        makeApiError(429, "rate_limited"),
        authErrorMessages.rateLimited,
      ],
      [
        "service_unavailable",
        makeApiError(504, "service_unavailable"),
        authErrorMessages.unreachable,
      ],
      [
        "a network failure",
        new ApiNetworkError({ cause: new TypeError("Failed to fetch") }),
        authErrorMessages.unreachable,
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
        "an unexpected error",
        new TypeError("Cannot read properties of undefined"),
        authErrorMessages.generic,
      ],
      [
        "a validation_error on a field the form does not have",
        validationError("display_name"),
        authErrorMessages.invalidInput,
      ],
    ])("shows %s in the alert", async (_case, error, message) => {
      signUpAndSignIn.mockRejectedValue(error);
      const { user: actor } = renderForm();

      await fillAndSubmit(actor);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(message);
      expect(within(alert).queryByRole("link")).not.toBeInTheDocument();
      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(passwordInput()).not.toHaveAttribute("aria-invalid");
      expect(router.replace).not.toHaveBeenCalled();
    });

    it.each([
      ["email", emailInput, validationMessages.emailInvalid],
      [
        "password",
        passwordInput,
        `Use at least 8 characters. ${validationMessages.passwordLength}`,
      ],
    ])(
      "shows the API's validation_error on the %s field and focuses it",
      async (field, input, description) => {
        signUpAndSignIn.mockRejectedValue(validationError(field));
        const { user: actor } = renderForm();

        await fillAndSubmit(actor);

        await waitFor(() => {
          expect(input()).toHaveAccessibleDescription(description);
        });
        expect(input()).toHaveFocus();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      },
    );
  });

  describe("accessibility", () => {
    it("has no violations when idle", async () => {
      const { container } = renderForm();

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations with field errors", async () => {
      const { container, user: actor } = renderForm();
      await actor.click(submitButton());

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations with email_taken", async () => {
      signUpAndSignIn.mockRejectedValue(makeApiError(409, "email_taken"));
      const { container, user: actor } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("link", { name: "Sign in instead" });

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations when the account was created but sign-in failed", async () => {
      signUpAndSignIn.mockRejectedValue(
        new SignInAfterSignUpError({ cause: new Error("offline") }),
      );
      const { container, user: actor } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("alert");

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations while pending", async () => {
      signUpAndSignIn.mockReturnValue(deferred<CurrentUser>().promise);
      const { container, user: actor } = renderForm();
      await fillAndSubmit(actor);

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
