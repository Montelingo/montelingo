import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validationMessages,
} from "./messages";
import {
  type PasswordResetConfirmForm,
  type SignInForm,
  type SignUpForm,
  validatePasswordResetConfirm,
  validatePasswordResetRequest,
  validateSignIn,
  validateSignUp,
} from "./validation";

const VALID_EMAIL = "ana@example.com";
const VALID_PASSWORD = "correct horse";
// One code point, two UTF-16 units.
const EMOJI = "😀";

function makeSignInForm(overrides: Partial<SignInForm> = {}): SignInForm {
  return { email: VALID_EMAIL, password: VALID_PASSWORD, ...overrides };
}

function makeSignUpForm(overrides: Partial<SignUpForm> = {}): SignUpForm {
  const password = overrides.password ?? VALID_PASSWORD;
  return {
    email: VALID_EMAIL,
    password,
    confirmPassword: password,
    ...overrides,
  };
}

function makeResetConfirmForm(
  overrides: Partial<PasswordResetConfirmForm> = {},
): PasswordResetConfirmForm {
  const newPassword = overrides.newPassword ?? VALID_PASSWORD;
  return { newPassword, confirmPassword: newPassword, ...overrides };
}

// An address of exactly `length` characters, with the longest allowed local part.
function emailOfLength(length: number): string {
  const localPart = "a".repeat(64);
  const domainName = "b".repeat(length - localPart.length - "@.com".length);
  return `${localPart}@${domainName}.com`;
}

describe("email validation", () => {
  // Every form with an email field runs the same rules.
  const emailValidators = [
    ["sign-in", (email: string) => validateSignIn(makeSignInForm({ email }))],
    ["sign-up", (email: string) => validateSignUp(makeSignUpForm({ email }))],
    [
      "password reset request",
      (email: string) => validatePasswordResetRequest({ email }),
    ],
  ] as const;

  describe.each(emailValidators)("on the %s form", (_form, validate) => {
    it.each([
      "ana@example.com",
      "first.last@example.com",
      "ana+lessons@example.com",
      "o'brien@example.com",
      "ana@mail.example.co.uk",
      "ana@sub-domain.example.com",
      "josé@example.com",
      "user@bücher.de",
      "用户@例子.广告",
      `${"a".repeat(64)}@example.com`,
      `${EMOJI.repeat(64)}@example.com`,
      emailOfLength(254),
    ])("accepts %j", (email) => {
      const result = validate(email);

      expect(result.ok).toBe(true);
      expect(result.ok && result.data.email).toBe(email);
    });

    it("returns the email trimmed", () => {
      const result = validate("  ana@example.com\t\n");

      expect(result).toMatchObject({
        ok: true,
        data: { email: "ana@example.com" },
      });
    });

    it.each(["", "   ", "\t\n"])("requires an email (%j)", (email) => {
      expect(validate(email)).toEqual({
        ok: false,
        fieldErrors: { email: validationMessages.emailRequired },
      });
    });

    it.each([
      ["no @", "anaexample.com"],
      ["two @", "ana@bob@example.com"],
      ["an empty local part", "@example.com"],
      ["an empty domain", "ana@"],
      ["a domain without a dot", "ana@localhost"],
      ["an empty domain label", "a@b..com"],
      ["a leading dot in the domain", "ana@.example.com"],
      ["a trailing dot in the domain", "ana@example.com."],
      ["a leading dot in the local part", ".ana@example.com"],
      ["a trailing dot in the local part", "ana.@example.com"],
      ["a double dot in the local part", "an..a@example.com"],
      ["a space inside", "an a@example.com"],
      ["a tab inside", "ana@exa\tmple.com"],
      ["a label starting with -", "ana@-example.com"],
      ["a label ending with -", "ana@example-.com"],
      ["a top-level label starting with -", "ana@example.-com"],
      ["a quoted local part", '"ana"@example.com'],
      ["a comment", "ana(comment)@example.com"],
      ["a domain literal", "ana@[127.0.0.1]"],
      ["a comma", "ana,bob@example.com"],
      ["a semicolon", "ana;bob@example.com"],
      ["a colon", "ana:bob@example.com"],
      ["angle brackets", "<ana@example.com>"],
      ["a backslash", "an\\a@example.com"],
      ["a local part over 64 characters", `${"a".repeat(65)}@example.com`],
      ["a local part over 64 code points", `${EMOJI.repeat(65)}@example.com`],
      ["an address over 254 characters", emailOfLength(255)],
    ])("rejects an address with %s", (_case, email) => {
      expect(validate(email)).toEqual({
        ok: false,
        fieldErrors: { email: validationMessages.emailInvalid },
      });
    });
  });
});

describe("new password validation", () => {
  // Sign-up and choosing a new password share the length rules.
  const passwordValidators = [
    [
      "sign-up",
      "password",
      (password: string) => validateSignUp(makeSignUpForm({ password })),
    ],
    [
      "password reset confirm",
      "newPassword",
      (newPassword: string) =>
        validatePasswordResetConfirm(makeResetConfirmForm({ newPassword })),
    ],
  ] as const;

  describe.each(passwordValidators)(
    "on the %s form",
    (_form, field, validate) => {
      it.each([
        ["8 characters", "a".repeat(PASSWORD_MIN_LENGTH)],
        ["128 characters", "a".repeat(PASSWORD_MAX_LENGTH)],
        ["8 emoji", EMOJI.repeat(8)],
        ["128 emoji (256 UTF-16 units)", EMOJI.repeat(128)],
        ["spaces only", " ".repeat(8)],
      ])("accepts %s", (_case, password) => {
        expect(validate(password).ok).toBe(true);
      });

      it.each([
        ["7 characters", "a".repeat(PASSWORD_MIN_LENGTH - 1)],
        ["7 emoji (14 UTF-16 units)", EMOJI.repeat(7)],
        ["1 character", "a"],
      ])("rejects %s as too short", (_case, password) => {
        expect(validate(password)).toEqual({
          ok: false,
          fieldErrors: { [field]: validationMessages.passwordTooShort },
        });
      });

      it.each([
        ["129 characters", "a".repeat(PASSWORD_MAX_LENGTH + 1)],
        ["129 emoji", EMOJI.repeat(129)],
      ])("rejects %s as too long", (_case, password) => {
        expect(validate(password)).toEqual({
          ok: false,
          fieldErrors: { [field]: validationMessages.passwordTooLong },
        });
      });

      it("requires a password, reporting only the first message", () => {
        expect(validate("")).toMatchObject({
          ok: false,
          fieldErrors: { [field]: validationMessages.passwordRequired },
        });
      });
    },
  );
});

describe("validateSignIn", () => {
  it("returns the form with the email trimmed", () => {
    expect(
      validateSignIn({ email: " ana@example.com ", password: "secret" }),
    ).toEqual({
      ok: true,
      data: { email: "ana@example.com", password: "secret" },
    });
  });

  it.each([
    ["1 character", "a"],
    ["a short password", "1234567"],
    ["spaces only", "   "],
    ["128 characters", "a".repeat(PASSWORD_MAX_LENGTH)],
    ["128 emoji", EMOJI.repeat(128)],
  ])("accepts %s, leaving the check to the API", (_case, password) => {
    expect(validateSignIn(makeSignInForm({ password }))).toEqual({
      ok: true,
      data: { email: VALID_EMAIL, password },
    });
  });

  it("requires a password", () => {
    expect(validateSignIn(makeSignInForm({ password: "" }))).toEqual({
      ok: false,
      fieldErrors: { password: validationMessages.passwordRequired },
    });
  });

  it.each([
    ["129 characters", "a".repeat(PASSWORD_MAX_LENGTH + 1)],
    ["129 emoji", EMOJI.repeat(129)],
  ])("rejects %s as too long", (_case, password) => {
    expect(validateSignIn(makeSignInForm({ password }))).toEqual({
      ok: false,
      fieldErrors: { password: validationMessages.passwordTooLong },
    });
  });

  it("never trims the password", () => {
    expect(
      validateSignIn(makeSignInForm({ password: " password " })),
    ).toMatchObject({ ok: true, data: { password: " password " } });
  });

  it("reports every invalid field", () => {
    expect(validateSignIn({ email: "", password: "" })).toEqual({
      ok: false,
      fieldErrors: {
        email: validationMessages.emailRequired,
        password: validationMessages.passwordRequired,
      },
    });
  });
});

describe("validateSignUp", () => {
  it("returns the form with only the email trimmed", () => {
    expect(
      validateSignUp({
        email: " ana@example.com ",
        password: " password ",
        confirmPassword: " password ",
      }),
    ).toEqual({
      ok: true,
      data: {
        email: "ana@example.com",
        password: " password ",
        confirmPassword: " password ",
      },
    });
  });

  it("reports a confirmation that does not match", () => {
    expect(
      validateSignUp(
        makeSignUpForm({ password: "password1", confirmPassword: "password2" }),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: { confirmPassword: validationMessages.passwordsDiffer },
    });
  });

  it("treats a difference in surrounding spaces as a mismatch", () => {
    expect(
      validateSignUp(
        makeSignUpForm({ password: "password ", confirmPassword: "password" }),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: { confirmPassword: validationMessages.passwordsDiffer },
    });
  });

  it("asks for the confirmation, not a match, when it is empty", () => {
    expect(validateSignUp(makeSignUpForm({ confirmPassword: "" }))).toEqual({
      ok: false,
      fieldErrors: {
        confirmPassword: validationMessages.confirmPasswordRequired,
      },
    });
  });

  it("reports a mismatch alongside other field errors", () => {
    expect(
      validateSignUp({
        email: "not-an-email",
        password: "short",
        confirmPassword: "different",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        email: validationMessages.emailInvalid,
        password: validationMessages.passwordTooShort,
        confirmPassword: validationMessages.passwordsDiffer,
      },
    });
  });

  it("reports only the first message for each field", () => {
    expect(
      validateSignUp({ email: "", password: "", confirmPassword: "" }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        email: validationMessages.emailRequired,
        password: validationMessages.passwordRequired,
        confirmPassword: validationMessages.confirmPasswordRequired,
      },
    });
  });
});

describe("validatePasswordResetRequest", () => {
  it("returns the email trimmed", () => {
    expect(
      validatePasswordResetRequest({ email: " ana@example.com " }),
    ).toEqual({ ok: true, data: { email: "ana@example.com" } });
  });
});

describe("validatePasswordResetConfirm", () => {
  it("returns the passwords unchanged", () => {
    expect(
      validatePasswordResetConfirm({
        newPassword: " password ",
        confirmPassword: " password ",
      }),
    ).toEqual({
      ok: true,
      data: { newPassword: " password ", confirmPassword: " password " },
    });
  });

  it("reports a confirmation that does not match", () => {
    expect(
      validatePasswordResetConfirm(
        makeResetConfirmForm({
          newPassword: "password1",
          confirmPassword: "password2",
        }),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: { confirmPassword: validationMessages.passwordsDiffer },
    });
  });

  it("asks for the confirmation, not a match, when it is empty", () => {
    expect(
      validatePasswordResetConfirm(
        makeResetConfirmForm({ confirmPassword: "" }),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: {
        confirmPassword: validationMessages.confirmPasswordRequired,
      },
    });
  });

  it("reports a mismatch alongside a password error", () => {
    expect(
      validatePasswordResetConfirm({
        newPassword: "a".repeat(PASSWORD_MAX_LENGTH + 1),
        confirmPassword: "different",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        newPassword: validationMessages.passwordTooLong,
        confirmPassword: validationMessages.passwordsDiffer,
      },
    });
  });

  it("reports only the first message for each field", () => {
    expect(
      validatePasswordResetConfirm({ newPassword: "", confirmPassword: "" }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        newPassword: validationMessages.passwordRequired,
        confirmPassword: validationMessages.confirmPasswordRequired,
      },
    });
  });
});
