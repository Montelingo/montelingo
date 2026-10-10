import type { z } from "zod";

import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
} from "../schemas";

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type ValidationResult<Data, Field extends string> =
  | { ok: true; data: Data }
  | { ok: false; fieldErrors: FieldErrors<Field> };

export type SignInValues = z.input<typeof signInSchema>;
export type SignUpValues = z.input<typeof signUpSchema>;
export type PasswordResetRequestValues = z.input<
  typeof passwordResetRequestSchema
>;
export type PasswordResetConfirmValues = z.input<
  typeof passwordResetConfirmSchema
>;

export type SignInField = keyof SignInValues;
export type SignUpField = keyof SignUpValues;
export type PasswordResetRequestField = keyof PasswordResetRequestValues;
export type PasswordResetConfirmField = keyof PasswordResetConfirmValues;

// Returns the parsed form, or the first message for each invalid field.
function validate<Form extends Record<string, string>>(
  schema: z.ZodType<Form, Form>,
  form: Form,
): ValidationResult<Form, Extract<keyof Form, string>> {
  const result = schema.safeParse(form);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const fieldErrors: FieldErrors<string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }
  return { ok: false, fieldErrors };
}

/** Validates the sign-in form. On success the email is trimmed. */
export function validateSignIn(
  form: SignInValues,
): ValidationResult<SignInValues, SignInField> {
  return validate(signInSchema, form);
}

/** Validates the sign-up form. On success the email is trimmed. */
export function validateSignUp(
  form: SignUpValues,
): ValidationResult<SignUpValues, SignUpField> {
  return validate(signUpSchema, form);
}

/** Validates the "forgot password" form. On success the email is trimmed. */
export function validatePasswordResetRequest(
  form: PasswordResetRequestValues,
): ValidationResult<PasswordResetRequestValues, PasswordResetRequestField> {
  return validate(passwordResetRequestSchema, form);
}

/** Validates the "choose a new password" form. */
export function validatePasswordResetConfirm(
  form: PasswordResetConfirmValues,
): ValidationResult<PasswordResetConfirmValues, PasswordResetConfirmField> {
  return validate(passwordResetConfirmSchema, form);
}
