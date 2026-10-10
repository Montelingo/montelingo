import { describe, expect, it } from "vitest";

import {
  type AuthFormAction,
  type AuthFormState,
  authFormReducer,
  firstFieldWithError,
  formatCountdown,
  initialAuthFormState,
  visibleFieldErrors,
} from "./form-state";

type Field = "email" | "password";

function makeState(
  overrides: Partial<AuthFormState<Field>> = {},
): AuthFormState<Field> {
  return {
    ...initialAuthFormState<Field>({ email: "", password: "" }),
    ...overrides,
  };
}

function reduce(
  state: AuthFormState<Field>,
  ...actions: AuthFormAction<Field>[]
): AuthFormState<Field> {
  return actions.reduce(authFormReducer<Field>, state);
}

function changed(field: Field, value: string): AuthFormAction<Field> {
  return { type: "changed", field, value };
}

const NOW = Date.parse("2026-10-09T12:00:00Z");

function submit(now = NOW): AuthFormAction<Field> {
  return { type: "submitted", isValid: true, clientErrors: {}, now };
}

const validSubmit = submit();

function clockChecked(now: number): AuthFormAction<Field> {
  return { type: "clock-checked", now };
}

function failed(
  overrides: Partial<Extract<AuthFormAction<Field>, { type: "failed" }>> = {},
): AuthFormAction<Field> {
  return {
    type: "failed",
    code: "invalid_credentials",
    formError: "Incorrect email or password.",
    fieldErrors: {},
    retryAfterSeconds: null,
    now: NOW,
    ...overrides,
  };
}

const emailTaken = failed({
  code: "email_taken",
  formError: null,
  fieldErrors: { email: "An account with this email already exists." },
});

// A filled-in form whose submit is in flight.
function submitting(): AuthFormState<Field> {
  return reduce(
    makeState(),
    changed("email", "ana@example.com"),
    changed("password", "correct horse"),
    validSubmit,
  );
}

describe("initialAuthFormState", () => {
  it("starts untouched, idle, and without errors", () => {
    expect(initialAuthFormState({ email: "a", password: "b" })).toEqual({
      values: { email: "a", password: "b" },
      touched: {},
      submittedValues: null,
      serverFieldErrors: {},
      failure: null,
      status: "editing",
      retryAt: null,
      retryAfterSeconds: null,
      attempt: 0,
      focusTarget: null,
    });
  });
});

describe("authFormReducer", () => {
  describe("changed", () => {
    it("updates the changed field only", () => {
      const state = reduce(makeState(), changed("email", "ana@example.com"));

      expect(state.values).toEqual({ email: "ana@example.com", password: "" });
    });

    it("clears the API's error on a field when that field changes", () => {
      const state = reduce(
        submitting(),
        failed({ fieldErrors: { email: "Taken.", password: "Too short." } }),
        changed("email", "bo@example.com"),
      );

      expect(state.serverFieldErrors).toEqual({ password: "Too short." });
    });

    it("keeps the form-level failure while the user edits", () => {
      const state = reduce(
        submitting(),
        failed(),
        changed("password", "another try"),
      );

      expect(state.failure).toEqual({
        code: "invalid_credentials",
        formError: "Incorrect email or password.",
      });
    });
  });

  describe("blurred", () => {
    it("marks the field as touched", () => {
      const state = reduce(makeState(), { type: "blurred", field: "email" });

      expect(state.touched).toEqual({ email: true });
    });

    it("returns the same state when the field is already touched", () => {
      const state = makeState({ touched: { email: true } });

      expect(authFormReducer(state, { type: "blurred", field: "email" })).toBe(
        state,
      );
    });
  });

  describe("submitted", () => {
    it("touches every field, stays editable, and targets the first invalid field", () => {
      const state = reduce(makeState(), {
        type: "submitted",
        isValid: false,
        clientErrors: { password: "Required.", email: "Required." },
        now: NOW,
      });

      expect(state).toMatchObject({
        touched: { email: true, password: true },
        status: "editing",
        submittedValues: null,
        attempt: 1,
        focusTarget: "email",
      });
    });

    it("starts submitting, records the values sent, and clears the last failure", () => {
      const state = reduce(submitting(), emailTaken, validSubmit);

      expect(state).toMatchObject({
        status: "submitting",
        submittedValues: {
          email: "ana@example.com",
          password: "correct horse",
        },
        failure: null,
        serverFieldErrors: {},
        attempt: 2,
        focusTarget: null,
      });
    });

    it.each(["submitting", "succeeded"] as const)(
      "is ignored while %s",
      (status) => {
        const state = makeState({ status, attempt: 1 });

        expect(authFormReducer(state, validSubmit)).toBe(state);
      },
    );

    it("is ignored before the API's Retry-After deadline", () => {
      const state = makeState({ retryAt: NOW + 5000, retryAfterSeconds: 5 });

      expect(authFormReducer(state, submit(NOW + 4999))).toBe(state);
    });

    it("goes ahead once the deadline has passed, even without a clock check", () => {
      const state = reduce(
        makeState({ retryAt: NOW + 5000, retryAfterSeconds: 5 }),
        submit(NOW + 5000),
      );

      expect(state).toMatchObject({
        status: "submitting",
        retryAt: null,
        retryAfterSeconds: null,
      });
    });
  });

  describe("failed", () => {
    it("records the failure, returns to editing, and targets the field in error", () => {
      const state = reduce(submitting(), emailTaken);

      expect(state).toMatchObject({
        status: "editing",
        failure: { code: "email_taken", formError: null },
        serverFieldErrors: {
          email: "An account with this email already exists.",
        },
        focusTarget: "email",
      });
    });

    it("targets no field for a form-level failure", () => {
      expect(reduce(submitting(), failed()).focusTarget).toBeNull();
    });

    it("drops a field error whose value changed while the request was in flight", () => {
      const state = reduce(
        submitting(),
        changed("email", "bo@example.com"),
        failed({
          code: "validation_error",
          formError: null,
          fieldErrors: { email: "Taken.", password: "Too long." },
        }),
      );

      expect(state.serverFieldErrors).toEqual({ password: "Too long." });
      expect(state.focusTarget).toBe("password");
    });

    it("keeps a field error when the field was changed back to the value sent", () => {
      const state = reduce(
        submitting(),
        changed("email", "ana@example.co"),
        changed("email", "ana@example.com"),
        emailTaken,
      );

      expect(state.serverFieldErrors).toEqual({
        email: "An account with this email already exists.",
      });
    });

    it("keeps the failure code when its field error is dropped", () => {
      const state = reduce(
        submitting(),
        changed("email", "bo@example.com"),
        emailTaken,
      );

      expect(state.serverFieldErrors).toEqual({});
      expect(state.focusTarget).toBeNull();
      expect(state.failure).toEqual({ code: "email_taken", formError: null });
    });

    it("holds submitting until the API's Retry-After deadline", () => {
      const state = reduce(
        submitting(),
        failed({ code: "rate_limited", retryAfterSeconds: 30 }),
      );

      expect(state).toMatchObject({
        retryAt: NOW + 30_000,
        retryAfterSeconds: 30,
      });
    });

    it.each([null, 0])("does not hold submitting for a wait of %j", (wait) => {
      const state = reduce(
        submitting(),
        failed({ code: "rate_limited", retryAfterSeconds: wait }),
      );

      expect(state).toMatchObject({ retryAt: null, retryAfterSeconds: null });
    });

    it("is ignored when no submit is in flight", () => {
      const state = makeState();

      expect(authFormReducer(state, failed())).toBe(state);
    });
  });

  describe("succeeded", () => {
    it("stays pending", () => {
      expect(reduce(submitting(), { type: "succeeded" }).status).toBe(
        "succeeded",
      );
    });

    it("is ignored when no submit is in flight", () => {
      const state = makeState();

      expect(authFormReducer(state, { type: "succeeded" })).toBe(state);
    });
  });

  describe("clock-checked", () => {
    const held = () =>
      reduce(
        submitting(),
        failed({ code: "rate_limited", retryAfterSeconds: 3 }),
      );

    it("counts the remaining whole seconds down from the clock", () => {
      expect(reduce(held(), clockChecked(NOW + 1000)).retryAfterSeconds).toBe(
        2,
      );
      expect(reduce(held(), clockChecked(NOW + 1001)).retryAfterSeconds).toBe(
        2,
      );
      expect(reduce(held(), clockChecked(NOW + 2999)).retryAfterSeconds).toBe(
        1,
      );
    });

    it("releases the hold at the deadline", () => {
      const state = reduce(held(), clockChecked(NOW + 3000));

      expect(state).toMatchObject({ retryAt: null, retryAfterSeconds: null });
      expect(reduce(state, submit(NOW + 3000)).status).toBe("submitting");
    });

    it("releases the hold in one check when the clock jumps past the deadline", () => {
      // A throttled background tab: one late tick, long after the deadline.
      const state = reduce(held(), clockChecked(NOW + 60_000));

      expect(state).toMatchObject({ retryAt: null, retryAfterSeconds: null });
    });

    it("returns the same state when the shown seconds do not change", () => {
      const state = held();

      expect(authFormReducer(state, clockChecked(NOW + 200))).toBe(state);
    });

    it("is ignored when nothing is held", () => {
      const state = makeState();

      expect(authFormReducer(state, clockChecked(NOW))).toBe(state);
    });
  });
});

describe("visibleFieldErrors", () => {
  const clientErrors = {
    email: "Enter your email address.",
    password: "Enter your password.",
  };

  it("hides client errors on untouched fields", () => {
    expect(visibleFieldErrors(makeState(), clientErrors)).toEqual({});
  });

  it("shows client errors on touched fields", () => {
    expect(
      visibleFieldErrors(makeState({ touched: { email: true } }), clientErrors),
    ).toEqual({ email: "Enter your email address." });
  });

  it("shows the API's error on a field without a client error", () => {
    const state = makeState({
      touched: { email: true, password: true },
      serverFieldErrors: { email: "Taken." },
    });

    expect(visibleFieldErrors(state, {})).toEqual({ email: "Taken." });
  });

  it("prefers the client error, which describes the current value", () => {
    const state = makeState({
      touched: { email: true },
      serverFieldErrors: { email: "Taken." },
    });

    expect(
      visibleFieldErrors(state, { email: "Enter your email address." }),
    ).toEqual({ email: "Enter your email address." });
  });
});

describe("firstFieldWithError", () => {
  it("returns the first field in form order", () => {
    expect(
      firstFieldWithError<Field>(
        { email: "", password: "" },
        { password: "Required.", email: "Required." },
      ),
    ).toBe("email");
  });

  it("returns undefined when no field has an error", () => {
    expect(
      firstFieldWithError<Field>({ email: "", password: "" }, {}),
    ).toBeUndefined();
  });
});

describe("formatCountdown", () => {
  it.each([
    [1, "0:01"],
    [45, "0:45"],
    [60, "1:00"],
    [125, "2:05"],
    [3600, "1:00:00"],
    [3725, "1:02:05"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});
