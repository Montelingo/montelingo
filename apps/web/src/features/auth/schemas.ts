import { z } from "zod";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validationMessages,
} from "./model/messages";

// Form-input schemas mirroring the API's request rules
// (apps/api/app/modules/auth/schemas.py), so most mistakes are caught before a
// round trip. The API stays authoritative: when it still answers 422, its
// validation_error details are mapped onto the same fields by toAuthFormError().

const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_PART_MAX_LENGTH = 64;

// The API (Python) counts characters in code points. String#length counts
// UTF-16 units, which would count an emoji as two.
function characterCount(value: string): number {
  return [...value].length;
}

// Characters that are never valid unquoted, and the API does not accept quoted
// local parts. Everything else, including non-ASCII letters, is left to the API.
const FORBIDDEN_EMAIL_CHARACTERS = /[\s"(),:;<>[\\\]]/u;

// Deliberately looser than the API's validator, never stricter, so a valid
// address is never blocked here: one @, a local part without stray dots, and a
// domain of at least two non-empty labels.
function isPlausibleEmail(email: string): boolean {
  const parts = email.split("@");
  if (
    parts.length !== 2 ||
    characterCount(email) > EMAIL_MAX_LENGTH ||
    FORBIDDEN_EMAIL_CHARACTERS.test(email)
  ) {
    return false;
  }
  const [localPart = "", domain = ""] = parts;
  const labels = domain.split(".");
  return (
    localPart !== "" &&
    characterCount(localPart) <= EMAIL_LOCAL_PART_MAX_LENGTH &&
    !localPart.startsWith(".") &&
    !localPart.endsWith(".") &&
    !localPart.includes("..") &&
    labels.length >= 2 &&
    labels.every(
      (label) => label !== "" && !label.startsWith("-") && !label.endsWith("-"),
    )
  );
}

// The email is trimmed, and the trimmed value is what gets sent. Passwords are
// never trimmed or normalized: every character is part of the secret.
const emailSchema = z
  .string()
  .trim()
  .min(1, validationMessages.emailRequired)
  .refine(isPlausibleEmail, validationMessages.emailInvalid);

// Sign-in only caps the length, so a short wrong password still reaches the API
// and gets invalid_credentials (ADR 0004).
const passwordSchema = z
  .string()
  .min(1, validationMessages.passwordRequired)
  .refine(
    (value) => characterCount(value) <= PASSWORD_MAX_LENGTH,
    validationMessages.passwordTooLong,
  );

const newPasswordSchema = passwordSchema.refine(
  (value) => characterCount(value) >= PASSWORD_MIN_LENGTH,
  validationMessages.passwordTooShort,
);

const confirmPasswordSchema = z
  .string()
  .min(1, validationMessages.confirmPasswordRequired);

// Zod skips object-level refinements once any field has failed. Running the
// match check whenever the confirmation is filled in shows every problem at once.
function hasNoIssueOn(
  issues: readonly { path?: readonly PropertyKey[] }[],
  field: string,
): boolean {
  return !issues.some((issue) => issue.path?.[0] === field);
}

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine((form) => form.password === form.confirmPassword, {
    error: validationMessages.passwordsDiffer,
    path: ["confirmPassword"],
    when: (payload) => hasNoIssueOn(payload.issues, "confirmPassword"),
  });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetConfirmSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine((form) => form.newPassword === form.confirmPassword, {
    error: validationMessages.passwordsDiffer,
    path: ["confirmPassword"],
    when: (payload) => hasNoIssueOn(payload.issues, "confirmPassword"),
  });
