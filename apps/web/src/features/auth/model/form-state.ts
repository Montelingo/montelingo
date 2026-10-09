import type { FieldErrors } from "./validation";

// The state of an auth form (sign-in, sign-up, password reset) between the
// user's input and the API's answer. Client validation is not stored: it is
// recomputed from `values` on every render, and `visibleFieldErrors()` decides
// which of its messages the user has earned the right to see.

export type AuthFormStatus = "editing" | "submitting" | "succeeded";

/** A failed submit: the error code and the message for the whole form, if any. */
export type AuthFormFailure = {
  code: string;
  formError: string | null;
};

type FormValues<Field extends string> = Readonly<Record<Field, string>>;

export type AuthFormState<Field extends string> = {
  values: FormValues<Field>;
  /** Fields whose client validation is shown: blurred once, or all after a submit. */
  touched: Partial<Record<Field, true>>;
  /** The values sent with the submit in flight or last answered. */
  submittedValues: FormValues<Field> | null;
  /** The API's field errors from the last submit, each cleared when its field changes. */
  serverFieldErrors: FieldErrors<Field>;
  failure: AuthFormFailure | null;
  status: AuthFormStatus;
  /**
   * When the API accepts another attempt (`Retry-After` on `rate_limited`), as
   * epoch milliseconds, or `null` when the form may be submitted. An absolute
   * deadline, so a throttled background tab cannot stretch the wait.
   */
  retryAt: number | null;
  /** Whole seconds left until `retryAt` at the last clock check, for display. */
  retryAfterSeconds: number | null;
  /** Counts submit attempts, so the same alert can be announced again. */
  attempt: number;
  /** The field to focus after this attempt was rejected, if any. */
  focusTarget: Field | null;
};

export type AuthFormAction<Field extends string> =
  | { type: "changed"; field: Field; value: string }
  | { type: "blurred"; field: Field }
  | {
      type: "submitted";
      isValid: boolean;
      clientErrors: FieldErrors<Field>;
      /** The current time, in epoch milliseconds. */
      now: number;
    }
  | {
      type: "failed";
      code: string;
      formError: string | null;
      fieldErrors: FieldErrors<Field>;
      retryAfterSeconds: number | null;
      /** The current time, in epoch milliseconds. */
      now: number;
    }
  | { type: "succeeded" }
  /** Re-reads the clock while a Retry-After wait runs. */
  | { type: "clock-checked"; now: number };

export function initialAuthFormState<Field extends string>(
  values: FormValues<Field>,
): AuthFormState<Field> {
  return {
    values,
    touched: {},
    submittedValues: null,
    serverFieldErrors: {},
    failure: null,
    status: "editing",
    retryAt: null,
    retryAfterSeconds: null,
    attempt: 0,
    focusTarget: null,
  };
}

export function authFormReducer<Field extends string>(
  state: AuthFormState<Field>,
  action: AuthFormAction<Field>,
): AuthFormState<Field> {
  switch (action.type) {
    case "changed": {
      // The API judged the old value, so its message no longer applies.
      const serverFieldErrors = { ...state.serverFieldErrors };
      delete serverFieldErrors[action.field];
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        serverFieldErrors,
      };
    }
    case "blurred":
      if (state.touched[action.field]) {
        return state;
      }
      return { ...state, touched: { ...state.touched, [action.field]: true } };
    case "submitted": {
      // Nothing can be sent while a submit is in flight or finished, or while
      // the API has asked the user to wait.
      if (
        state.status !== "editing" ||
        (state.retryAt !== null && action.now < state.retryAt)
      ) {
        return state;
      }
      const touched: Partial<Record<Field, true>> = {};
      for (const field of fieldsOf(state.values)) {
        touched[field] = true;
      }
      return {
        ...state,
        touched,
        submittedValues: action.isValid ? state.values : null,
        serverFieldErrors: {},
        failure: null,
        status: action.isValid ? "submitting" : "editing",
        retryAt: null,
        retryAfterSeconds: null,
        attempt: state.attempt + 1,
        focusTarget: action.isValid
          ? null
          : (firstFieldWithError(state.values, action.clientErrors) ?? null),
      };
    }
    case "failed": {
      if (state.status !== "submitting") {
        return state;
      }
      // A field edited while the request was in flight no longer holds the
      // value the API judged, so its error would describe the wrong value.
      const serverFieldErrors: FieldErrors<Field> = {};
      for (const field of fieldsOf(state.values)) {
        const message = action.fieldErrors[field];
        if (
          message !== undefined &&
          state.values[field] === state.submittedValues?.[field]
        ) {
          serverFieldErrors[field] = message;
        }
      }
      return {
        ...state,
        serverFieldErrors,
        failure: { code: action.code, formError: action.formError },
        status: "editing",
        ...retryHold(
          action.retryAfterSeconds !== null && action.retryAfterSeconds > 0
            ? action.now + action.retryAfterSeconds * 1000
            : null,
          action.now,
        ),
        focusTarget:
          firstFieldWithError(state.values, serverFieldErrors) ?? null,
      };
    }
    case "succeeded":
      if (state.status !== "submitting") {
        return state;
      }
      // Stays pending until the navigation that follows unmounts the form.
      return { ...state, status: "succeeded" };
    case "clock-checked": {
      if (state.retryAt === null) {
        return state;
      }
      const hold = retryHold(state.retryAt, action.now);
      if (hold.retryAfterSeconds === state.retryAfterSeconds) {
        return state;
      }
      return { ...state, ...hold };
    }
  }
}

// The hold at `now`: released once the deadline has passed, otherwise the
// remaining time rounded up, so "0:00" is never shown while still held.
function retryHold(
  retryAt: number | null,
  now: number,
): Pick<AuthFormState<string>, "retryAt" | "retryAfterSeconds"> {
  if (retryAt === null || now >= retryAt) {
    return { retryAt: null, retryAfterSeconds: null };
  }
  return { retryAt, retryAfterSeconds: Math.ceil((retryAt - now) / 1000) };
}

/**
 * The message shown on each field: its client validation error once the field
 * is touched, otherwise the API's error for it from the last submit.
 */
export function visibleFieldErrors<Field extends string>(
  state: AuthFormState<Field>,
  clientErrors: FieldErrors<Field>,
): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {};
  for (const field of fieldsOf(state.values)) {
    const message =
      (state.touched[field] ? clientErrors[field] : undefined) ??
      state.serverFieldErrors[field];
    if (message !== undefined) {
      errors[field] = message;
    }
  }
  return errors;
}

/**
 * The first field with an error, in form order (the order of the form's
 * values), so focus can move to it.
 */
export function firstFieldWithError<Field extends string>(
  values: FormValues<Field>,
  errors: FieldErrors<Field>,
): Field | undefined {
  return fieldsOf(values).find((field) => errors[field] !== undefined);
}

/** A wait as a clock, for a countdown: `0:45`, `2:00`, `1:00:00`. */
export function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

// Object.keys loses the key type; every key of `values` is a Field by construction.
function fieldsOf<Field extends string>(values: FormValues<Field>): Field[] {
  return Object.keys(values) as Field[];
}
