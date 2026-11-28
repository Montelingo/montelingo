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
  type FieldValue,
  initialAuthFormState,
  visibleFieldErrors,
} from "../model/form-state";
import type { ValidationResult } from "../model/validation";

type FormValues = Readonly<Record<string, FieldValue>>;

type FieldOf<Values extends FormValues> = Extract<keyof Values, string>;

/** The fields holding text, for `fieldProps()`. */
type TextFieldOf<Values extends FormValues> = {
  [Field in FieldOf<Values>]: Values[Field] extends string ? Field : never;
}[FieldOf<Values>];

/** The fields holding a checkbox's state, for `checkboxProps()`. */
type CheckboxFieldOf<Values extends FormValues> = {
  [Field in FieldOf<Values>]: Values[Field] extends boolean ? Field : never;
}[FieldOf<Values>];

type UseAuthFormOptions<Values extends FormValues, Data> = {
  /** The form's fields, in the order they appear, with their starting values. */
  initialValues: Values;
  validate: (values: Values) => ValidationResult<Data, FieldOf<Values>>;
  /**
   * Maps the API's `validation_error` fields onto this form's fields. It may
   * cover only some of them, so the fields are inferred from `initialValues`.
   */
  apiFields: ApiFieldMap<NoInfer<FieldOf<Values>>>;
  /** Calls the API. A thrown error is mapped with `toAuthFormError()`. */
  submit: (data: Data) => Promise<void>;
  /** Runs once the API call succeeds, unless the form has unmounted meanwhile. */
  onSuccess: () => void;
  /** Reads the clock, in epoch milliseconds, for the Retry-After deadline. */
  now?: () => number;
  /**
   * Where focus goes after a rejected submit: the first field with an error
   * (the default), or the error summary attached to `summaryRef`, which then
   * also takes focus for an error of the whole form.
   */
  focusOnError?: "field" | "summary";
};

const CLOCK_CHECK_INTERVAL_MS = 1000;

/**
 * Runs an auth form: controlled values, client validation shown on blur and on
 * submit, the API call, and its errors mapped onto fields or the whole form.
 * After a rejected submit, focus moves to the first field with an error, or to
 * the error summary (`focusOnError: "summary"`). After
 * `rate_limited`, submitting is held until the API's `Retry-After` has passed.
 *
 * Attach `formRef` to the `<form>`, so focus can move to its fields by name,
 * and `summaryRef` to the error summary when focus goes there.
 */
export function useAuthForm<Values extends FormValues, Data>({
  initialValues,
  validate,
  apiFields,
  submit,
  onSuccess,
  now = Date.now,
  focusOnError = "field",
}: UseAuthFormOptions<Values, Data>) {
  type Field = FieldOf<Values>;
  const [state, dispatch] = useReducer(
    authFormReducer<Field>,
    initialValues,
    initialAuthFormState<Field>,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  // A response that arrives after the user has left (for example through the
  // "Sign up" link) must not navigate them somewhere else.
  const isMountedRef = useRef(false);

  // The reducer only knows each value is text or a checkbox's state. Each field
  // keeps the kind it started with, because fieldProps() writes only text
  // fields and checkboxProps() only checkboxes.
  const validation = validate(state.values as Values);
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

  // Runs after the errors are rendered, so the field or the summary is
  // announced with them.
  useEffect(() => {
    if (focusOnError === "summary") {
      if (state.rejectedFieldCount > 0 || state.failure?.formError) {
        summaryRef.current?.focus();
      }
      return;
    }
    if (state.focusTarget === null) {
      return;
    }
    const element = formRef.current?.elements.namedItem(state.focusTarget);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  }, [
    focusOnError,
    state.attempt,
    state.failure,
    state.focusTarget,
    state.rejectedFieldCount,
  ]);

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

  /** Props for a text input: its value, error and handlers. */
  function fieldProps(field: TextFieldOf<Values>) {
    return {
      name: field,
      value: String(state.values[field]),
      error: fieldErrors[field],
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        dispatch({ type: "changed", field, value: event.target.value }),
      onBlur: () => dispatch({ type: "blurred", field }),
    };
  }

  /** Props for a checkbox: whether it is ticked, its error and handlers. */
  function checkboxProps(field: CheckboxFieldOf<Values>) {
    return {
      name: field,
      checked: state.values[field] === true,
      error: fieldErrors[field],
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        dispatch({ type: "changed", field, value: event.target.checked }),
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
    summaryRef,
    fieldProps,
    checkboxProps,
    /** The API's field errors from the last submit, until their field changes. */
    serverFieldErrors: state.serverFieldErrors,
    failure: state.failure,
    /** How many fields the last attempt rejected, for the error summary. */
    rejectedFieldCount: state.rejectedFieldCount,
    /** Changes on every submit: use it as the alert's `key` to announce it again. */
    attempt: state.attempt,
    /** True while the API call is in flight, and after it succeeds. */
    isPending,
    /** Seconds left before another attempt is allowed, or `null`. */
    retryAfterSeconds: state.retryAfterSeconds,
    handleSubmit,
  };
}
