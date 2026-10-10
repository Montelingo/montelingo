import { ApiClientError, ApiNetworkError, type Schemas } from "@app/api-client";
import { describe, expect, it } from "vitest";

import {
  type ApiFieldMap,
  authErrorMessages,
  passwordResetConfirmFields,
  passwordResetRequestFields,
  SignInAfterSignUpError,
  signInFields,
  signUpFields,
  toAuthFormError,
} from "./errors";
import { validationMessages } from "./model/messages";

const NOW = new Date("2026-10-08T12:00:00Z");

function makeApiError(
  status: number,
  code: string,
  {
    details = null,
    requestId = "req-1",
    headers = {},
  }: {
    details?: Schemas["ErrorDetail"][] | null;
    requestId?: string;
    headers?: Record<string, string>;
  } = {},
): ApiClientError {
  return new ApiClientError(
    status,
    {
      error: {
        code,
        message: `API message for ${code}`,
        request_id: requestId,
        details,
      },
    },
    new Headers(headers),
  );
}

function makeDetail(field: string | null): Schemas["ErrorDetail"] {
  return { field, code: "invalid_value", message: "API detail message" };
}

function rateLimitedError(retryAfter?: string): ApiClientError {
  return makeApiError(429, "rate_limited", {
    headers: retryAfter === undefined ? {} : { "Retry-After": retryAfter },
  });
}

function validationError(...fields: (string | null)[]): ApiClientError {
  return makeApiError(422, "validation_error", {
    details: fields.map(makeDetail),
  });
}

describe("toAuthFormError", () => {
  describe("invalid_credentials", () => {
    it("shows a form-level message", () => {
      expect(
        toAuthFormError(makeApiError(401, "invalid_credentials"), {
          fields: signInFields,
        }),
      ).toEqual({
        code: "invalid_credentials",
        formError: authErrorMessages.invalidCredentials,
        fieldErrors: {},
        retryAfterSeconds: null,
        requestId: "req-1",
      });
    });
  });

  describe("email_taken", () => {
    it("shows the message on the email field when the form has one", () => {
      expect(
        toAuthFormError(makeApiError(409, "email_taken"), {
          fields: signUpFields,
        }),
      ).toEqual({
        code: "email_taken",
        formError: null,
        fieldErrors: { email: authErrorMessages.emailTaken },
        retryAfterSeconds: null,
        requestId: "req-1",
      });
    });

    it("shows the message on the form when the form has no email field", () => {
      expect(
        toAuthFormError(makeApiError(409, "email_taken"), {
          fields: passwordResetConfirmFields,
        }),
      ).toMatchObject({
        code: "email_taken",
        formError: authErrorMessages.emailTaken,
        fieldErrors: {},
      });
    });

    it("shows the message on the form when no fields are given", () => {
      expect(toAuthFormError(makeApiError(409, "email_taken"))).toMatchObject({
        formError: authErrorMessages.emailTaken,
        fieldErrors: {},
      });
    });
  });

  describe("invalid_reset_token", () => {
    it("shows a form-level message", () => {
      expect(
        toAuthFormError(makeApiError(400, "invalid_reset_token"), {
          fields: passwordResetConfirmFields,
        }),
      ).toEqual({
        code: "invalid_reset_token",
        formError: authErrorMessages.invalidResetToken,
        fieldErrors: {},
        retryAfterSeconds: null,
        requestId: "req-1",
      });
    });
  });

  describe("rate_limited", () => {
    it.each([
      ["1", 1, "1 second"],
      ["30", 30, "30 seconds"],
      ["59", 59, "59 seconds"],
      ["60", 60, "1 minute"],
      ["61", 61, "2 minutes"],
      ["120", 120, "2 minutes"],
      ["3540", 3540, "59 minutes"],
      ["3541", 3541, "1 hour"],
      ["3600", 3600, "1 hour"],
      ["3601", 3601, "2 hours"],
      ["86400", 86400, "24 hours"],
      [" 30 ", 30, "30 seconds"],
    ])(
      "reads Retry-After %j as %i seconds and says %j",
      (retryAfter, seconds, wait) => {
        expect(
          toAuthFormError(rateLimitedError(retryAfter), {
            fields: signInFields,
            now: NOW,
          }),
        ).toEqual({
          code: "rate_limited",
          formError: `Too many attempts. Try again in ${wait}.`,
          fieldErrors: {},
          retryAfterSeconds: seconds,
          requestId: "req-1",
        });
      },
    );

    it("reads an HTTP-date Retry-After relative to now", () => {
      expect(
        toAuthFormError(rateLimitedError("Thu, 08 Oct 2026 12:00:45 GMT"), {
          now: NOW,
        }),
      ).toMatchObject({
        formError: "Too many attempts. Try again in 45 seconds.",
        retryAfterSeconds: 45,
      });
    });

    it("rounds a partial second of an HTTP-date up", () => {
      expect(
        toAuthFormError(rateLimitedError("Thu, 08 Oct 2026 12:00:45 GMT"), {
          now: new Date("2026-10-08T12:00:00.250Z"),
        }),
      ).toMatchObject({ retryAfterSeconds: 45 });
    });

    it("reads an HTTP-date in the past as no wait, with the generic message", () => {
      expect(
        toAuthFormError(rateLimitedError("Thu, 08 Oct 2026 11:59:00 GMT"), {
          now: NOW,
        }),
      ).toMatchObject({
        formError: authErrorMessages.rateLimited,
        retryAfterSeconds: 0,
      });
    });

    it("shows the generic message for Retry-After 0", () => {
      expect(
        toAuthFormError(rateLimitedError("0"), { now: NOW }),
      ).toMatchObject({
        formError: authErrorMessages.rateLimited,
        retryAfterSeconds: 0,
      });
    });

    it.each([
      ["missing", undefined],
      ["not a number or date", "soon"],
      ["a decimal number", "1.5"],
      ["a negative number", "-5"],
      ["a loosely formatted date", "12 30"],
      ["over 24 hours in seconds", "86401"],
      ["an HTTP-date over 24 hours away", "Sat, 10 Oct 2026 12:00:00 GMT"],
    ])(
      "shows the generic message when Retry-After is %s",
      (_case, retryAfter) => {
        expect(
          toAuthFormError(rateLimitedError(retryAfter), {
            fields: signInFields,
            now: NOW,
          }),
        ).toEqual({
          code: "rate_limited",
          formError: authErrorMessages.rateLimited,
          fieldErrors: {},
          retryAfterSeconds: null,
          requestId: "req-1",
        });
      },
    );
  });

  describe("validation_error", () => {
    it("shows our own copy on mapped fields, not the API's message", () => {
      expect(
        toAuthFormError(validationError("email", "password"), {
          fields: signUpFields,
        }),
      ).toEqual({
        code: "validation_error",
        formError: null,
        fieldErrors: {
          email: validationMessages.emailInvalid,
          password: validationMessages.passwordLength,
        },
        retryAfterSeconds: null,
        requestId: "req-1",
      });
    });

    it("maps new_password onto the newPassword field", () => {
      expect(
        toAuthFormError(validationError("new_password"), {
          fields: passwordResetConfirmFields,
        }),
      ).toMatchObject({
        formError: null,
        fieldErrors: { newPassword: validationMessages.passwordLength },
      });
    });

    it("maps email on the password reset request form", () => {
      expect(
        toAuthFormError(validationError("email"), {
          fields: passwordResetRequestFields,
        }),
      ).toMatchObject({
        formError: null,
        fieldErrors: { email: validationMessages.emailInvalid },
      });
    });

    it.each([
      ["a field the form does not have", "new_password"],
      ["an unknown field", "nickname"],
      ["a field-less detail", null],
    ])("shows a form-level message for %s", (_case, field) => {
      expect(
        toAuthFormError(validationError(field), { fields: signInFields }),
      ).toEqual({
        code: "validation_error",
        formError: authErrorMessages.invalidInput,
        fieldErrors: {},
        retryAfterSeconds: null,
        requestId: "req-1",
      });
    });

    it("shows the sign-in password copy, not the sign-up length rule", () => {
      expect(
        toAuthFormError(validationError("password"), { fields: signInFields }),
      ).toMatchObject({
        formError: null,
        fieldErrors: { password: validationMessages.signInPassword },
      });
    });

    it("shows the copy a custom field map gives", () => {
      const fields: ApiFieldMap<"nickname"> = {
        nickname: { field: "nickname", message: "Pick another nickname." },
      };

      expect(
        toAuthFormError(validationError("nickname"), { fields }),
      ).toMatchObject({
        formError: null,
        fieldErrors: { nickname: "Pick another nickname." },
      });
    });

    it("shows mapped and unmapped details together", () => {
      expect(
        toAuthFormError(validationError("email", "nickname"), {
          fields: signInFields,
        }),
      ).toMatchObject({
        formError: authErrorMessages.invalidInput,
        fieldErrors: { email: validationMessages.emailInvalid },
      });
    });

    it("keeps the first message when two details land on one field", () => {
      const fields: ApiFieldMap<"secret"> = {
        password: { field: "secret", message: "First." },
        email: { field: "secret", message: "Second." },
      };

      expect(
        toAuthFormError(validationError("password", "email"), { fields }),
      ).toMatchObject({
        formError: null,
        fieldErrors: { secret: "First." },
      });
    });

    it("treats a token detail as an invalid reset link", () => {
      expect(
        toAuthFormError(validationError("new_password", "token"), {
          fields: passwordResetConfirmFields,
        }),
      ).toEqual({
        code: "invalid_reset_token",
        formError: authErrorMessages.invalidResetToken,
        fieldErrors: {},
        retryAfterSeconds: null,
        requestId: "req-1",
      });
    });

    it.each([
      ["null", null],
      ["empty", []],
    ])("shows a form-level message when details are %s", (_case, details) => {
      expect(
        toAuthFormError(makeApiError(422, "validation_error", { details }), {
          fields: signInFields,
        }),
      ).toEqual({
        code: "validation_error",
        formError: authErrorMessages.invalidInput,
        fieldErrors: {},
        retryAfterSeconds: null,
        requestId: "req-1",
      });
    });
  });

  describe("other API errors", () => {
    it("shows the unreachable message for service_unavailable", () => {
      expect(
        toAuthFormError(makeApiError(503, "service_unavailable")),
      ).toMatchObject({
        code: "service_unavailable",
        formError: authErrorMessages.unreachable,
      });
    });

    it.each([
      [403, "authorization_error"],
      [500, "internal_server_error"],
      [502, "request_failed"],
    ])(
      "shows the generic message for %i %s, keeping the code",
      (status, code) => {
        expect(toAuthFormError(makeApiError(status, code))).toEqual({
          code,
          formError: authErrorMessages.generic,
          fieldErrors: {},
          retryAfterSeconds: null,
          requestId: "req-1",
        });
      },
    );
  });

  describe("request ID", () => {
    it("carries the API's request ID", () => {
      expect(
        toAuthFormError(
          makeApiError(401, "invalid_credentials", { requestId: "req-abc" }),
        ),
      ).toMatchObject({ requestId: "req-abc" });
    });

    it("turns an empty request ID into null", () => {
      expect(
        toAuthFormError(
          makeApiError(401, "invalid_credentials", { requestId: "" }),
        ),
      ).toMatchObject({ requestId: null });
    });
  });

  describe("errors that are not API errors", () => {
    it("reads an ApiNetworkError as a network failure", () => {
      expect(
        toAuthFormError(
          new ApiNetworkError({ cause: new TypeError("fetch failed") }),
        ),
      ).toEqual({
        code: "network_error",
        formError: authErrorMessages.unreachable,
        fieldErrors: {},
        retryAfterSeconds: null,
        requestId: null,
      });
    });

    it.each([
      ["an Error", new Error("boom")],
      // A TypeError thrown after a response arrived is a bug, not the network.
      ["a TypeError", new TypeError("Cannot read properties of undefined")],
      ["a string", "boom"],
      ["undefined", undefined],
      ["null", null],
    ])("reads %s as an unexpected error", (_case, error) => {
      expect(toAuthFormError(error)).toEqual({
        code: "unexpected_error",
        formError: authErrorMessages.generic,
        fieldErrors: {},
        retryAfterSeconds: null,
        requestId: null,
      });
    });
  });

  describe("SignInAfterSignUpError", () => {
    it("keeps the cause's wait and request ID", () => {
      const error = new SignInAfterSignUpError({
        cause: makeApiError(429, "rate_limited", {
          requestId: "req-429",
          headers: { "Retry-After": "90" },
        }),
      });

      expect(
        toAuthFormError(error, { fields: signUpFields, now: NOW }),
      ).toEqual({
        code: "sign_in_after_sign_up_failed",
        formError: authErrorMessages.signInAfterSignUp,
        fieldErrors: {},
        retryAfterSeconds: 90,
        requestId: "req-429",
      });
    });

    it("reads an HTTP-date wait of the cause relative to now", () => {
      const error = new SignInAfterSignUpError({
        cause: rateLimitedError("Thu, 08 Oct 2026 12:01:00 GMT"),
      });

      expect(toAuthFormError(error, { now: NOW })).toMatchObject({
        retryAfterSeconds: 60,
      });
    });

    it("never shows field errors, even when the cause has them", () => {
      const error = new SignInAfterSignUpError({
        cause: validationError("email"),
      });

      expect(toAuthFormError(error, { fields: signUpFields })).toEqual({
        code: "sign_in_after_sign_up_failed",
        formError: authErrorMessages.signInAfterSignUp,
        fieldErrors: {},
        retryAfterSeconds: null,
        requestId: "req-1",
      });
    });

    it("has no request ID when the cause is a network failure", () => {
      const error = new SignInAfterSignUpError({
        cause: new TypeError("fetch failed"),
      });

      expect(toAuthFormError(error)).toMatchObject({
        code: "sign_in_after_sign_up_failed",
        requestId: null,
      });
    });

    it("is an Error carrying its cause", () => {
      const cause = new TypeError("fetch failed");
      const error = new SignInAfterSignUpError({ cause });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("SignInAfterSignUpError");
      expect(error.cause).toBe(cause);
    });
  });
});
