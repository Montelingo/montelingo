import { ApiClientError, ApiNetworkError, type Schemas } from "@app/api-client";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { SignUpDetails } from "../api/auth-api";
import { authErrorMessages, SignInAfterSignUpError } from "../errors";
import { validationMessages } from "../model/messages";
import type { CurrentUser } from "../model/user";
import { SignUpForm } from "./SignUpForm";

const { signUpAndSignIn } = vi.hoisted(() => ({
  signUpAndSignIn: vi.fn<(details: SignUpDetails) => Promise<CurrentUser>>(),
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

const POLICY_VERSION = "2026-12-01";

function renderForm(redirectTo = "/play") {
  const view = render(
    <SignUpForm
      redirectTo={redirectTo}
      privacyPolicyVersion={POLICY_VERSION}
    />,
  );
  return { ...view, user: userEvent.setup() };
}

// The welcome screens' error summary, which takes focus after a rejected submit.
function errorSummary(count: string) {
  return screen.getByText(count).closest<HTMLElement>('[tabindex="-1"]');
}

function emailInput() {
  return screen.getByLabelText("E-pošta odrasle osobe");
}

function passwordInput() {
  return screen.getByLabelText("Lozinka");
}

function confirmInput() {
  return screen.getByLabelText("Potvrdi lozinku");
}

// jsdom puts a space before the full stop that follows the link; browsers do not.
function consentCheckbox() {
  return screen.getByRole("checkbox", {
    name: /^Ja sam roditelj ili staratelj djeteta i prihvatam Politiku privatnosti ?\.$/,
  });
}

function submitButton() {
  return screen.getByRole("button", { name: "Napravi nalog" });
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  {
    email = "ana@example.com",
    password = "correct horse",
    confirmPassword = password,
    consent = true,
  }: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    consent?: boolean;
  } = {},
) {
  await user.type(emailInput(), email);
  await user.type(passwordInput(), password);
  await user.type(confirmInput(), confirmPassword);
  if (consent) {
    await user.click(consentCheckbox());
  }
  await user.click(submitButton());
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SignUpForm", () => {
  it("labels the form with its heading", () => {
    renderForm();

    expect(
      screen.getByRole("form", { name: "Napravi porodični nalog" }),
    ).toBeInTheDocument();
  });

  it("keeps the submit button disabled in the server HTML, until hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <SignUpForm redirectTo="/play" privacyPolicyVersion={POLICY_VERSION} />,
    );

    expect(
      within(container).getByRole("button", { name: "Napravi nalog" }),
    ).toBeDisabled();
  });

  it("enables the submit button once running in the browser", () => {
    renderForm();

    expect(submitButton()).toBeEnabled();
  });

  it("posts, so credentials never reach the URL", () => {
    renderForm();

    expect(
      screen.getByRole("form", { name: "Napravi porodični nalog" }),
    ).toHaveAttribute("method", "post");
  });

  it("shows the Za odrasle chip and leads back to the welcome", () => {
    renderForm();

    expect(screen.getByText("Za odrasle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nazad" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("names each show-password toggle after its field", async () => {
    const { user: actor } = renderForm();

    await actor.click(
      screen.getByRole("button", { name: "Prikaži potvrđenu lozinku" }),
    );

    expect(confirmInput()).toHaveAttribute("type", "text");
    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Prikaži lozinku" }),
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

    expect(passwordInput()).toHaveAccessibleDescription("Najmanje 8 znakova.");
  });

  it("links to sign in, keeping the destination", () => {
    renderForm("/lessons");

    expect(screen.getByRole("link", { name: "Prijavi se" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Flessons",
    );
  });

  describe("parental consent", () => {
    it("asks for it with a required checkbox, unticked at first", () => {
      renderForm();

      expect(consentCheckbox()).not.toBeChecked();
      expect(consentCheckbox()).toBeRequired();
    });

    it("ticks when its label text is clicked", async () => {
      const { user: actor } = renderForm();

      await actor.click(
        screen.getByText(/Ja sam roditelj ili staratelj djeteta/),
      );

      expect(consentCheckbox()).toBeChecked();
    });

    it("links to the privacy policy in a new tab, so nothing typed is lost", () => {
      renderForm();

      const link = screen.getByRole("link", { name: "Politiku privatnosti" });
      expect(link).toHaveAttribute("href", "/privatnost");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener");
    });

    it("gives the box a target of at least 44×44px", () => {
      renderForm();

      // size-touch is 3rem (48px), and the whole label row is clickable.
      expect(consentCheckbox().parentElement).toHaveClass("size-touch");
      expect(consentCheckbox().closest("label")).toHaveClass("min-h-touch");
    });

    it("shows its error on the field and in the summary, and sends nothing", async () => {
      const { user: actor } = renderForm();

      await fillAndSubmit(actor, { consent: false });

      expect(consentCheckbox()).toHaveAttribute("aria-invalid", "true");
      expect(consentCheckbox()).toHaveAccessibleDescription(
        validationMessages.parentalConsentRequired,
      );
      expect(errorSummary("Ispravi 1 stvar ispod")).toHaveFocus();
      expect(signUpAndSignIn).not.toHaveBeenCalled();
    });

    it("clears its error once ticked, and then signs up", async () => {
      signUpAndSignIn.mockResolvedValue(user);
      const { user: actor } = renderForm();
      await fillAndSubmit(actor, { consent: false });

      await actor.click(consentCheckbox());

      expect(consentCheckbox()).not.toHaveAttribute("aria-invalid");
      await actor.click(submitButton());
      expect(signUpAndSignIn).toHaveBeenCalledTimes(1);
    });

    it("says the policy changed when the page showed an older version", async () => {
      signUpAndSignIn.mockRejectedValue(
        makeApiError(409, "privacy_policy_outdated"),
      );
      const { user: actor } = renderForm();

      await fillAndSubmit(actor);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Politika privatnosti je promijenjena. Osvježi stranicu i pokušaj ponovo.",
      );
      expect(
        errorSummary(authErrorMessages.privacyPolicyOutdated),
      ).toHaveFocus();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it("shows the API's validation_error for the consent on the checkbox", async () => {
      signUpAndSignIn.mockRejectedValue(validationError("parental_consent"));
      const { user: actor } = renderForm();

      await fillAndSubmit(actor);

      await waitFor(() => {
        expect(consentCheckbox()).toHaveAccessibleDescription(
          validationMessages.parentalConsentRequired,
        );
      });
      expect(errorSummary("Ispravi 1 stvar ispod")).toHaveFocus();
    });
  });

  describe("validation", () => {
    it("shows a field's error when the user leaves it", async () => {
      const { user: actor } = renderForm();

      await actor.type(passwordInput(), "short");
      await actor.tab();

      expect(passwordInput()).toHaveAttribute("aria-invalid", "true");
      expect(passwordInput()).toHaveAccessibleDescription(
        `Najmanje 8 znakova. ${validationMessages.passwordTooShort}`,
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

    it("shows every error on submit, focuses the summary that counts them, and does not call the API", async () => {
      const { user: actor } = renderForm();

      await actor.click(submitButton());

      expect(emailInput()).toHaveAccessibleDescription(
        `Nikad je ne dijelimo. ${validationMessages.emailRequired}`,
      );
      expect(passwordInput()).toHaveAccessibleDescription(
        `Najmanje 8 znakova. ${validationMessages.passwordRequired}`,
      );
      expect(confirmInput()).toHaveAccessibleDescription(
        validationMessages.confirmPasswordRequired,
      );
      expect(consentCheckbox()).toHaveAccessibleDescription(
        validationMessages.parentalConsentRequired,
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ispravi 4 stvari ispod",
      );
      expect(errorSummary("Ispravi 4 stvari ispod")).toHaveFocus();
      expect(signUpAndSignIn).not.toHaveBeenCalled();
    });

    it("counts the mismatched confirmation as one thing to fix", async () => {
      const { user: actor } = renderForm();

      await fillAndSubmit(actor, { confirmPassword: "something else" });

      expect(errorSummary("Ispravi 1 stvar ispod")).toHaveFocus();
      expect(confirmInput()).toHaveAccessibleDescription(
        validationMessages.passwordsDiffer,
      );
      expect(signUpAndSignIn).not.toHaveBeenCalled();
    });
  });

  describe("on success", () => {
    it("signs up and in with the trimmed email and the policy version, then goes to the destination and refreshes", async () => {
      signUpAndSignIn.mockResolvedValue(user);
      const { user: actor } = renderForm("/lessons/42");

      await fillAndSubmit(actor, { email: " ana@example.com  " });

      expect(signUpAndSignIn).toHaveBeenCalledTimes(1);
      expect(signUpAndSignIn).toHaveBeenCalledWith({
        email: "ana@example.com",
        password: "correct horse",
        privacyPolicyVersion: POLICY_VERSION,
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
      ["the default", "/play"],
      ["an absolute URL", "https://evil.com/phish"],
      ["a backslash host", "/\\evil.com"],
      ["the sign-up page", "/sign-up"],
      ["the forgot-password page", "/Forgot-Password/"],
    ])(
      "goes to the map when the destination is %s",
      async (_case, redirectTo) => {
        signUpAndSignIn.mockResolvedValue(user);
        const { user: actor } = renderForm(redirectTo);

        await fillAndSubmit(actor);

        await waitFor(() => {
          expect(router.replace).toHaveBeenCalledWith("/play");
        });
      },
    );

    it("goes home when that is the destination asked for", async () => {
      signUpAndSignIn.mockResolvedValue(user);
      const { user: actor } = renderForm("/");

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

      const button = screen.getByRole("button", { name: "Pravim nalog…" });
      expect(button).toHaveAttribute("aria-disabled", "true");

      await actor.click(button);
      expect(signUpAndSignIn).toHaveBeenCalledTimes(1);

      response.reject(makeApiError(409, "email_taken"));

      expect(
        await screen.findByRole("button", { name: "Napravi nalog" }),
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
        screen.getByRole("button", { name: "Pravim nalog…" }),
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
        `Nikad je ne dijelimo. ${authErrorMessages.emailTaken} Prijavi se ovim nalogom`,
      );
      expect(errorSummary("Ispravi 1 stvar ispod")).toHaveFocus();
      expect(
        screen.getByRole("link", { name: "Prijavi se ovim nalogom" }),
      ).toHaveAttribute("href", "/sign-in?next=%2Flessons");
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
        await screen.findByRole("button", { name: "Napravi nalog" }),
      ).toBeInTheDocument();
      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(
        screen.queryByRole("link", { name: "Prijavi se ovim nalogom" }),
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
      await screen.findByRole("link", { name: "Prijavi se ovim nalogom" });

      await actor.clear(emailInput());
      await actor.type(emailInput(), "bo@example.com");

      expect(emailInput()).not.toHaveAttribute("aria-invalid");
      expect(
        screen.queryByRole("link", { name: "Prijavi se ovim nalogom" }),
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
        within(alert).getByRole("link", { name: "Idi na prijavu" }),
      ).toHaveAttribute("href", "/sign-in?next=%2Flessons");
      expect(router.replace).not.toHaveBeenCalled();
    });

    it.each<[string, unknown, string]>([
      [
        "rate_limited with Retry-After",
        makeApiError(429, "rate_limited", {
          headers: { "Retry-After": "120" },
        }),
        "Previše pokušaja. Pokušaj ponovo za 2 minuta.",
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
      [
        "email",
        emailInput,
        `Nikad je ne dijelimo. ${validationMessages.emailInvalid}`,
      ],
      [
        "password",
        passwordInput,
        `Najmanje 8 znakova. ${validationMessages.passwordLength}`,
      ],
    ])(
      "shows the API's validation_error on the %s field and counts it in the summary",
      async (field, input, description) => {
        signUpAndSignIn.mockRejectedValue(validationError(field));
        const { user: actor } = renderForm();

        await fillAndSubmit(actor);

        await waitFor(() => {
          expect(input()).toHaveAccessibleDescription(description);
        });
        expect(errorSummary("Ispravi 1 stvar ispod")).toHaveFocus();
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

    it("has no violations with the consent ticked", async () => {
      const { container, user: actor } = renderForm();
      await actor.click(consentCheckbox());

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations when the policy changed", async () => {
      signUpAndSignIn.mockRejectedValue(
        makeApiError(409, "privacy_policy_outdated"),
      );
      const { container, user: actor } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("alert");

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no violations with email_taken", async () => {
      signUpAndSignIn.mockRejectedValue(makeApiError(409, "email_taken"));
      const { container, user: actor } = renderForm();
      await fillAndSubmit(actor);
      await screen.findByRole("link", { name: "Prijavi se ovim nalogom" });

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
