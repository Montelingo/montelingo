import { ApiClientError, ApiNetworkError, type Schemas } from "@app/api-client";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { Credentials } from "../api/auth-api";
import { authErrorMessages } from "../errors";
import { validationMessages } from "../model/messages";
import type { CurrentUser } from "../model/user";
import { SignInForm } from "./SignInForm";

const { signIn } = vi.hoisted(() => ({
  signIn: vi.fn<(credentials: Credentials) => Promise<CurrentUser>>(),
}));
vi.mock("../api/auth-api", () => ({ signIn }));

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
  const view = render(<SignInForm redirectTo={redirectTo} />);
  return { ...view, user: userEvent.setup() };
}

function emailInput() {
  return screen.getByLabelText("Email");
}

function passwordInput() {
  return screen.getByLabelText("Password");
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { email = "ana@example.com", password = "correct horse" } = {},
) {
  await user.type(emailInput(), email);
  await user.type(passwordInput(), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SignInForm", () => {
  it("labels the form with its heading", () => {
    renderForm();

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
  });

  it("posts if submitted before hydration, so credentials never reach the URL", () => {
    renderForm();

    expect(screen.getByRole("form", { name: "Sign in" })).toHaveAttribute(
      "method",
      "post",
    );
  });

  it("asks the browser to fill in the email and current password", () => {
    renderForm();

    expect(emailInput()).toHaveAttribute("type", "email");
    expect(emailInput()).toHaveAttribute("autocomplete", "email");
    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(passwordInput()).toHaveAttribute("autocomplete", "current-password");
  });

  it("links to the forgot-password and sign-up pages", () => {
    renderForm();

    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  it("keeps the destination on the sign-up link", () => {
    renderForm("/lessons/42");

    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/sign-up?next=%2Flessons%2F42",
    );
  });

  it.each(["//evil.com", "/sign-up"])(
    "drops the destination %j from the sign-up link",
    (redirectTo) => {
      renderForm(redirectTo);

      expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
        "href",
        "/sign-up",
      );
    },
  );

  describe("validation", () => {
    it("shows a field's error when the user leaves it, and only that field's", async () => {
      const { user } = renderForm();

      await user.click(emailInput());
      await user.tab();

      expect(emailInput()).toHaveAttribute("aria-invalid", "true");
      expect(emailInput()).toHaveAccessibleDescription(
        validationMessages.emailRequired,
      );
      expect(passwordInput()).not.toHaveAttribute("aria-invalid");
    });

    it("does not show an error while the user is still typing", async () => {
      const { user } = renderForm();

      await user.type(emailInput(), "ana@");

      expect(emailInput()).not.toHaveAttribute("aria-invalid");
    });

    it("updates a touched field's error as the user fixes it", async () => {
      const { user } = renderForm();
      await user.type(emailInput(), "ana@");
      await user.tab();
      expect(emailInput()).toHaveAccessibleDescription(
        validationMessages.emailInvalid,
      );

      await user.type(emailInput(), "example.com");

      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(
        screen.queryByText(validationMessages.emailInvalid),
      ).not.toBeInTheDocument();
    });

    it("shows every error on submit, focuses the first field, and does not call the API", async () => {
      const { user } = renderForm();

      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(emailInput()).toHaveAccessibleDescription(
        validationMessages.emailRequired,
      );
      expect(passwordInput()).toHaveAccessibleDescription(
        validationMessages.passwordRequired,
      );
      expect(emailInput()).toHaveFocus();
      expect(signIn).not.toHaveBeenCalled();
    });

    it("focuses the first invalid field when earlier fields are valid", async () => {
      const { user } = renderForm();
      await user.type(emailInput(), "ana@example.com");

      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(passwordInput()).toHaveFocus();
      expect(signIn).not.toHaveBeenCalled();
    });

    it("lets the API judge a short password", async () => {
      signIn.mockResolvedValue(user);
      const { user: actor } = renderForm();

      await fillAndSubmit(actor, { password: "short" });

      expect(signIn).toHaveBeenCalledWith({
        email: "ana@example.com",
        password: "short",
      });
    });
  });

  describe("on success", () => {
    it("signs in with the trimmed email, then goes to the destination and refreshes", async () => {
      signIn.mockResolvedValue(user);
      const { user: actor } = renderForm("/lessons/42");

      await fillAndSubmit(actor, { email: "  ana@example.com " });

      expect(signIn).toHaveBeenCalledTimes(1);
      expect(signIn).toHaveBeenCalledWith({
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
      ["a protocol-relative URL", "//evil.com"],
      ["an API path", "/api/v1/auth/me"],
      ["the sign-in page", "/sign-in"],
      ["an encoded sign-up page", "/%73ign-up/"],
    ])("goes home when the destination is %s", async (_case, redirectTo) => {
      signIn.mockResolvedValue(user);
      const { user: actor } = renderForm(redirectTo);

      await fillAndSubmit(actor);

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/");
      });
    });

    it("submits when the user presses Enter in a field", async () => {
      signIn.mockResolvedValue(user);
      const { user: actor } = renderForm();

      await actor.type(emailInput(), "ana@example.com");
      await actor.type(passwordInput(), "correct horse{Enter}");

      expect(signIn).toHaveBeenCalledTimes(1);
    });
  });

  describe("while pending", () => {
    it("holds the submit button until the API answers", async () => {
      const response = deferred<CurrentUser>();
      signIn.mockReturnValue(response.promise);
      const { user: actor } = renderForm();

      await fillAndSubmit(actor);

      const button = screen.getByRole("button", { name: "Signing in…" });
      expect(button).toHaveAttribute("aria-disabled", "true");

      await actor.click(button);
      await actor.type(passwordInput(), "{Enter}");
      expect(signIn).toHaveBeenCalledTimes(1);

      response.reject(makeApiError(401, "invalid_credentials"));

      expect(
        await screen.findByRole("button", { name: "Sign in" }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("stays pending after success while the page navigates away", async () => {
      signIn.mockResolvedValue(user);
      const { user: actor } = renderForm();

      await fillAndSubmit(actor);

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalled();
      });
      expect(
        screen.getByRole("button", { name: "Signing in…" }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("clears the last error when the user submits again", async () => {
      const response = deferred<CurrentUser>();
      signIn
        .mockRejectedValueOnce(makeApiError(401, "invalid_credentials"))
        .mockReturnValueOnce(response.promise);
      const { user: actor } = renderForm();
      await fillAndSubmit(actor);
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      await actor.click(screen.getByRole("button", { name: "Sign in" }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      response.resolve(user);
    });
  });

  describe("after leaving the page", () => {
    it.each([
      [
        "succeeds",
        (response: ReturnType<typeof deferred<CurrentUser>>) =>
          response.resolve(user),
      ],
      [
        "fails",
        (response: ReturnType<typeof deferred<CurrentUser>>) =>
          response.reject(makeApiError(401, "invalid_credentials")),
      ],
    ])("does nothing when the call %s", async (_case, settle) => {
      const response = deferred<CurrentUser>();
      signIn.mockReturnValue(response.promise);
      const { user: actor, unmount } = renderForm("/lessons");
      await fillAndSubmit(actor);

      unmount();
      settle(response);
      await flushPromises();

      expect(router.replace).not.toHaveBeenCalled();
      expect(router.refresh).not.toHaveBeenCalled();
    });
  });

  describe("when rate limited", () => {
    beforeEach(() => {
      // The clock and the countdown's interval are faked; userEvent keeps
      // real timeouts.
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    });

    it("holds the submit button, counting down, until Retry-After has passed", async () => {
      signIn
        .mockRejectedValueOnce(
          makeApiError(429, "rate_limited", {
            headers: { "Retry-After": "2" },
          }),
        )
        .mockResolvedValueOnce(user);
      const { user: actor } = renderForm();
      await fillAndSubmit(actor);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Too many attempts. Try again in 2 seconds.",
      );
      const held = screen.getByRole("button", { name: "Try again in 0:02" });
      expect(held).toHaveAttribute("aria-disabled", "true");
      await actor.click(held);
      expect(signIn).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(
        screen.getByRole("button", { name: "Try again in 0:01" }),
      ).toHaveAttribute("aria-disabled", "true");

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      const button = screen.getByRole("button", { name: "Sign in" });
      expect(button).not.toHaveAttribute("aria-disabled");

      await actor.click(button);
      expect(signIn).toHaveBeenCalledTimes(2);
    });

    it.each([
      [
        "the tab becomes visible again",
        () => document.dispatchEvent(new Event("visibilitychange")),
      ],
      [
        "the window regains focus",
        () => window.dispatchEvent(new Event("focus")),
      ],
      // A throttled background tab: one tick, far fewer than the seconds waited.
      ["a single late tick arrives", () => vi.advanceTimersByTime(1000)],
    ])(
      "releases the hold once the deadline has passed and %s",
      async (_case, wake) => {
        signIn.mockRejectedValue(
          makeApiError(429, "rate_limited", {
            headers: { "Retry-After": "30" },
          }),
        );
        const { user: actor } = renderForm();
        await fillAndSubmit(actor);
        await screen.findByRole("button", { name: "Try again in 0:30" });

        act(() => {
          vi.setSystemTime(Date.now() + 60_000);
          wake();
        });

        expect(
          screen.getByRole("button", { name: "Sign in" }),
        ).not.toHaveAttribute("aria-disabled");
      },
    );

    it("stops counting down once the form is gone", async () => {
      signIn.mockRejectedValue(
        makeApiError(429, "rate_limited", { headers: { "Retry-After": "30" } }),
      );
      const { user: actor, unmount } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("button", { name: "Try again in 0:30" });

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("does not hold the button without Retry-After", async () => {
      signIn.mockRejectedValue(makeApiError(429, "rate_limited"));
      const { user: actor } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("alert");

      expect(
        screen.getByRole("button", { name: "Sign in" }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("has no accessibility violations while held", async () => {
      vi.useRealTimers();
      signIn.mockRejectedValue(
        makeApiError(429, "rate_limited", { headers: { "Retry-After": "30" } }),
      );
      const { container, user: actor } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("button", { name: /Try again in/ });

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("errors", () => {
    it.each<[string, unknown, string]>([
      [
        "invalid_credentials",
        makeApiError(401, "invalid_credentials"),
        authErrorMessages.invalidCredentials,
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
        "a validation_error on no field",
        validationError(null),
        authErrorMessages.invalidInput,
      ],
    ])("shows %s in the alert", async (_case, error, message) => {
      signIn.mockRejectedValue(error);
      const { user: actor } = renderForm();

      await fillAndSubmit(actor);

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(passwordInput()).not.toHaveAttribute("aria-invalid");
      expect(router.replace).not.toHaveBeenCalled();
    });

    it.each([
      ["email", emailInput, validationMessages.emailInvalid],
      ["password", passwordInput, validationMessages.signInPassword],
    ])(
      "shows the API's validation_error on the %s field and focuses it",
      async (field, input, message) => {
        signIn.mockRejectedValue(validationError(field));
        const { user: actor } = renderForm();

        await fillAndSubmit(actor);

        await waitFor(() => {
          expect(input()).toHaveAccessibleDescription(message);
        });
        expect(input()).toHaveAttribute("aria-invalid", "true");
        expect(input()).toHaveFocus();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      },
    );

    it("clears the API's field error once the user changes the field", async () => {
      signIn.mockRejectedValue(validationError("email"));
      const { user: actor } = renderForm();
      await fillAndSubmit(actor);
      await waitFor(() => {
        expect(emailInput()).toHaveAttribute("aria-invalid", "true");
      });

      await actor.type(emailInput(), "m");

      expect(emailInput()).not.toHaveAttribute("aria-invalid");
    });
  });

  describe("accessibility", () => {
    it("has no violations when idle", async () => {
      const { container } = renderForm();

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations with field errors", async () => {
      const { container, user: actor } = renderForm();
      await actor.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations with an alert", async () => {
      signIn.mockRejectedValue(makeApiError(401, "invalid_credentials"));
      const { container, user: actor } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("alert");

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations while pending", async () => {
      signIn.mockReturnValue(deferred<CurrentUser>().promise);
      const { container, user: actor } = renderForm();
      await fillAndSubmit(actor);

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
