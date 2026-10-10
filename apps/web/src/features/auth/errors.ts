import { ApiClientError, ApiNetworkError } from "@app/api-client";

import { parseRetryAfter } from "@/lib/retry-after";

import { validationMessages } from "./model/messages";
import type {
  FieldErrors,
  PasswordResetConfirmField,
  PasswordResetRequestField,
  SignInField,
  SignUpField,
} from "./model/validation";

/**
 * What a form shows after a failed auth call: a message for the whole form,
 * messages for individual fields, or both. A plain serializable object, so it
 * can be returned from `useActionState` or passed to a Client Component.
 */
export type AuthFormError<Field extends string> = {
  /** The API error code, or `network_error` / `sign_in_after_sign_up_failed` / `unexpected_error`. */
  code: string;
  formError: string | null;
  fieldErrors: FieldErrors<Field>;
  /** From `Retry-After` on `rate_limited`, so a form can count down or hold the submit button. */
  retryAfterSeconds: number | null;
  /** The API's request ID, for support. */
  requestId: string | null;
};

/**
 * A form's fields, keyed by the API's request field names, with the copy shown
 * when the API rejects that field. The copy is the form's own, never the API's
 * `message`, which comes from the validation library and is not written for users.
 */
export type ApiFieldMap<Field extends string> = Readonly<
  Partial<Record<string, { field: Field; message: string }>>
>;

const emailField = {
  field: "email",
  message: validationMessages.emailInvalid,
} as const;

export const signInFields = {
  email: emailField,
  // Sign-in accepts any length up to the maximum (ADR 0004).
  password: { field: "password", message: validationMessages.signInPassword },
} as const satisfies ApiFieldMap<SignInField>;

export const signUpFields = {
  email: emailField,
  password: { field: "password", message: validationMessages.passwordLength },
} as const satisfies ApiFieldMap<SignUpField>;

export const passwordResetRequestFields = {
  email: emailField,
} as const satisfies ApiFieldMap<PasswordResetRequestField>;

export const passwordResetConfirmFields = {
  new_password: {
    field: "newPassword",
    message: validationMessages.passwordLength,
  },
} as const satisfies ApiFieldMap<PasswordResetConfirmField>;

/**
 * Thrown by `signUpAndSignIn()` when the account was created but signing in
 * failed, so the form can send the user to sign in rather than retry sign-up
 * (which would now fail with `email_taken`).
 */
export class SignInAfterSignUpError extends Error {
  constructor(options: { cause: unknown }) {
    super("The account was created, but signing in failed.", options);
    this.name = "SignInAfterSignUpError";
  }
}

export const authErrorMessages = {
  invalidCredentials: "Incorrect email or password.",
  emailTaken: "An account with this email already exists.",
  invalidResetToken:
    "This reset link is invalid or has expired. Request a new one.",
  rateLimited: "Too many attempts. Wait a moment and try again.",
  invalidInput: "Check the details you entered and try again.",
  unreachable:
    "We couldn’t reach Montelingo. Check your connection and try again.",
  signInAfterSignUp:
    "Your account was created, but we couldn’t sign you in. Sign in to continue.",
  generic: "Something went wrong. Try again.",
};

type ToAuthFormErrorOptions<Field extends string> = {
  /** The form's fields, such as `signInFields`. Errors for other fields go to `formError`. */
  fields?: ApiFieldMap<Field>;
  /** The current time, for an HTTP-date `Retry-After`. */
  now?: Date;
};

/**
 * Turns an error thrown by an auth call into what the form shows. Components
 * switch on `code`, never on the API's `message`.
 */
export function toAuthFormError<Field extends string = never>(
  error: unknown,
  { fields = {}, now = new Date() }: ToAuthFormErrorOptions<Field> = {},
): AuthFormError<Field> {
  if (error instanceof SignInAfterSignUpError) {
    const cause = toAuthFormError(error.cause, { now });
    return {
      ...cause,
      code: "sign_in_after_sign_up_failed",
      formError: authErrorMessages.signInAfterSignUp,
      fieldErrors: {},
    };
  }
  if (error instanceof ApiNetworkError) {
    return formLevel("network_error", authErrorMessages.unreachable, null);
  }
  if (!(error instanceof ApiClientError)) {
    return formLevel("unexpected_error", authErrorMessages.generic, null);
  }

  const { code, request_id: requestId, details } = error.error.error;
  switch (code) {
    case "invalid_credentials":
      return formLevel(code, authErrorMessages.invalidCredentials, requestId);
    case "email_taken":
      return onField(
        code,
        fields.email?.field,
        authErrorMessages.emailTaken,
        requestId,
      );
    case "invalid_reset_token":
      return formLevel(code, authErrorMessages.invalidResetToken, requestId);
    case "rate_limited": {
      const retryAfterSeconds = parseRetryAfter(
        error.headers.get("retry-after"),
        now,
      );
      return {
        ...formLevel(code, rateLimitedMessage(retryAfterSeconds), requestId),
        retryAfterSeconds,
      };
    }
    case "validation_error":
      return fromValidationDetails(details ?? [], fields, requestId);
    case "service_unavailable":
      return formLevel(code, authErrorMessages.unreachable, requestId);
    default:
      return formLevel(code, authErrorMessages.generic, requestId);
  }
}

function formLevel<Field extends string>(
  code: string,
  formError: string | null,
  requestId: string | null,
  fieldErrors: FieldErrors<Field> = {},
): AuthFormError<Field> {
  return {
    code,
    formError,
    fieldErrors,
    retryAfterSeconds: null,
    requestId: requestId || null,
  };
}

// Shows the message on the field when the form has one, otherwise on the form.
function onField<Field extends string>(
  code: string,
  field: Field | undefined,
  message: string,
  requestId: string | null,
): AuthFormError<Field> {
  if (field === undefined) {
    return formLevel(code, message, requestId);
  }
  const fieldErrors: FieldErrors<Field> = {};
  fieldErrors[field] = message;
  return formLevel(code, null, requestId, fieldErrors);
}

function fromValidationDetails<Field extends string>(
  details: readonly { field: string | null }[],
  fields: ApiFieldMap<Field>,
  requestId: string | null,
): AuthFormError<Field> {
  const fieldErrors: FieldErrors<Field> = {};
  let hasFormLevelDetail = false;

  for (const { field: apiField } of details) {
    // A reset token arrives in the link, not in a field the user can fix.
    if (apiField === "token") {
      return formLevel(
        "invalid_reset_token",
        authErrorMessages.invalidResetToken,
        requestId,
      );
    }
    const mapped = apiField === null ? undefined : fields[apiField];
    if (mapped === undefined) {
      hasFormLevelDetail = true;
    } else {
      fieldErrors[mapped.field] ??= mapped.message;
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  return formLevel(
    "validation_error",
    hasFormLevelDetail || !hasFieldErrors
      ? authErrorMessages.invalidInput
      : null,
    requestId,
    fieldErrors,
  );
}

function rateLimitedMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null || retryAfterSeconds === 0) {
    return authErrorMessages.rateLimited;
  }
  return `Too many attempts. Try again in ${formatWait(retryAfterSeconds)}.`;
}

// "45 seconds", "2 minutes", "1 hour": rounded up to the largest whole unit.
function formatWait(seconds: number): string {
  if (seconds < 60) {
    return formatUnit(seconds, "second");
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return formatUnit(minutes, "minute");
  }
  return formatUnit(Math.ceil(minutes / 60), "hour");
}

function formatUnit(value: number, unit: "second" | "minute" | "hour") {
  return new Intl.NumberFormat("en", {
    style: "unit",
    unit,
    unitDisplay: "long",
  }).format(value);
}
