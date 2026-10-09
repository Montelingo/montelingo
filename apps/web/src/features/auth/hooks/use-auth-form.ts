"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useReducer,
  useRef,
} from "react";

import { type ApiFieldMap, toAuthFormError } from "../errors";
import {
  authFormReducer,
  initialAuthFormState,
  visibleFieldErrors,
} from "../model/form-state";
import type { ValidationResult } from "../model/validation";

type FormValues<Field extends string> = Readonly<Record<Field, string>>;

type UseAuthFormOptions<Field extends string, Data> = {
  /** The form's fields, in the order they appear, with their starting values. */
  initialValues: FormValues<Field>;
  validate: (values: FormValues<Field>) => ValidationResult<Data, Field>;
  /**
   * Maps the API's `validation_error` fields onto this form's fields. It may
   * cover only some of them, so the fields are inferred from `initialValues`.
   */
  apiFields: ApiFieldMap<NoInfer<Field>>;
  /** Calls the API. A thrown error is mapped with `toAuthFormError()`. */
  submit: (data: Data) => Promise<void>;
  /** Runs once the API call succeeds, unless the form has unmounted meanwhile. */
  onSuccess: () => void;
  /** Reads the clock, in epoch milliseconds, for the Retry-After deadline. */
  now?: () => number;
};

const CLOCK_CHECK_INTERVAL_MS = 1000;

/**
 * Runs an auth form: controlled values, client validation shown on blur and on
 * submit, the API call, and its errors mapped onto fields or the whole form.
 * After a rejected submit, focus moves to the first field with an error. After
 * `rate_limited`, submitting is held until the API's `Retry-After` has passed.
 *
 * Attach `formRef` to the `<form>`, so focus can move to its fields by name.
 */
export function useAuthForm<Field extends string, Data>({
  initialValues,
  validate,
  apiFields,
  submit,
  onSuccess,
  now = Date.now,
}: UseAuthFormOptions<Field, Data>) {
  const [state, dispatch] = useReducer(
    authFormReducer<Field>,
    initialValues,
    initialAuthFormState<Field>,
  );
  const formRef = useRef<HTMLFormElement>(null);
  // A response that arrives after the user has left (for example through the
  // "Sign up" link) must not navigate them somewhere else.
  const isMountedRef = useRef(false);

  const validation = validate(state.values);
  const fieldErrors = visibleFieldErrors(
    state,
    validation.ok ? {} : validation.fieldErrors,
  );
  const isPending = state.status !== "editing";
  const isRetryHeld = state.retryAt !== null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Runs after the errors are rendered, so the field is announced with its error.
  useEffect(() => {
    if (state.focusTarget === null) {
      return;
    }
    const element = formRef.current?.elements.namedItem(state.focusTarget);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  }, [state.attempt, state.focusTarget]);

  // The wait is a deadline: each check re-reads the clock, so it ends on time
  // even when a background tab throttles the interval. Coming back to the tab
  // or window checks at once instead of waiting for the next tick.
  useEffect(() => {
    if (!isRetryHeld) {
      return;
    }
    const checkClock = () => dispatch({ type: "clock-checked", now: now() });
    const timer = setInterval(checkClock, CLOCK_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", checkClock);
    window.addEventListener("focus", checkClock);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", checkClock);
      window.removeEventListener("focus", checkClock);
    };
  }, [isRetryHeld, now]);

  function fieldProps(field: Field) {
    return {
      name: field,
      value: state.values[field],
      error: fieldErrors[field],
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        dispatch({ type: "changed", field, value: event.target.value }),
      onBlur: () => dispatch({ type: "blurred", field }),
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedAt = now();
    // Same rule as the reducer, so an ignored submit never reaches the API.
    if (isPending || (state.retryAt !== null && submittedAt < state.retryAt)) {
      return;
    }
    dispatch({
      type: "submitted",
      isValid: validation.ok,
      clientErrors: validation.ok ? {} : validation.fieldErrors,
      now: submittedAt,
    });
    if (validation.ok) {
      void submitValidForm(validation.data);
    }
  }

  async function submitValidForm(data: Data) {
    try {
      await submit(data);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }
      const failedAt = now();
      const { code, formError, fieldErrors, retryAfterSeconds } =
        toAuthFormError(error, { fields: apiFields, now: new Date(failedAt) });
      dispatch({
        type: "failed",
        code,
        formError,
        fieldErrors,
        retryAfterSeconds,
        now: failedAt,
      });
      return;
    }
    if (!isMountedRef.current) {
      return;
    }
    dispatch({ type: "succeeded" });
    onSuccess();
  }

  return {
    formRef,
    fieldProps,
    /** The API's field errors from the last submit, until their field changes. */
    serverFieldErrors: state.serverFieldErrors,
    failure: state.failure,
    /** Changes on every submit: use it as the alert's `key` to announce it again. */
    attempt: state.attempt,
    /** True while the API call is in flight, and after it succeeds. */
    isPending,
    /** Seconds left before another attempt is allowed, or `null`. */
    retryAfterSeconds: state.retryAfterSeconds,
    handleSubmit,
  };
}
