// @vitest-environment jsdom
import { ApiClientError, type Schemas } from "@app/api-client";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ChangeEvent, FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authErrorMessages, signInFields } from "../errors";
import { validationMessages } from "../model/messages";
import { type SignInValues, validateSignIn } from "../model/validation";
import { useAuthForm } from "./use-auth-form";

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

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// The hook reads only `target.value` from a change and calls only
// `preventDefault()` on a submit, so plain DOM events stand in for React's.
function changeEvent(value: string): ChangeEvent<HTMLInputElement> {
  const input = document.createElement("input");
  input.value = value;
  const event = { target: input };
  return event as unknown as ChangeEvent<HTMLInputElement>;
}

function submitEvent(): FormEvent<HTMLFormElement> {
  const event = new Event("submit", { cancelable: true });
  return event as unknown as FormEvent<HTMLFormElement>;
}

// A real form with the hook's fields, so focus can be checked.
function attachForm(formRef: { current: HTMLFormElement | null }) {
  const form = document.createElement("form");
  for (const name of ["email", "password"]) {
    const input = document.createElement("input");
    input.name = name;
    form.append(input);
  }
  document.body.append(form);
  formRef.current = form;
  return form;
}

function renderSignInHook() {
  const submit = vi.fn<(data: SignInValues) => Promise<void>>();
  const onSuccess = vi.fn<() => void>();
  const hook = renderHook(() =>
    useAuthForm({
      initialValues: { email: "", password: "" },
      validate: validateSignIn,
      apiFields: signInFields,
      submit,
      onSuccess,
    }),
  );
  const form = attachForm(hook.result.current.formRef);
  return { ...hook, submit, onSuccess, form };
}

function fill(
  result: {
    current: ReturnType<typeof useAuthForm<"email" | "password", SignInValues>>;
  },
  values: { email: string; password: string },
) {
  act(() => {
    result.current.fieldProps("email").onChange(changeEvent(values.email));
  });
  act(() => {
    result.current
      .fieldProps("password")
      .onChange(changeEvent(values.password));
  });
}

function submit(result: {
  current: { handleSubmit: (event: FormEvent<HTMLFormElement>) => void };
}) {
  act(() => {
    result.current.handleSubmit(submitEvent());
  });
}

// Lets every pending promise continuation run. Uses a real timeout, which the
// rate-limit tests leave unfaked.
function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

const credentials = { email: "ana@example.com", password: "correct horse" };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("useAuthForm", () => {
  it("binds each field to its value and name", () => {
    const { result } = renderSignInHook();

    act(() => {
      result.current.fieldProps("email").onChange(changeEvent("ana@"));
    });

    expect(result.current.fieldProps("email")).toMatchObject({
      name: "email",
      value: "ana@",
      error: undefined,
    });
  });

  it("shows a field's client error once the field is blurred", () => {
    const { result } = renderSignInHook();

    act(() => {
      result.current.fieldProps("email").onBlur();
    });

    expect(result.current.fieldProps("email").error).toBe(
      validationMessages.emailRequired,
    );
    expect(result.current.fieldProps("password").error).toBeUndefined();
  });

  it("rejects an invalid submit without calling the API, and focuses the first invalid field", () => {
    const { result, submit: submitMock, form } = renderSignInHook();

    submit(result);

    expect(submitMock).not.toHaveBeenCalled();
    expect(result.current.fieldProps("email").error).toBe(
      validationMessages.emailRequired,
    );
    expect(result.current.fieldProps("password").error).toBe(
      validationMessages.passwordRequired,
    );
    expect(result.current.isPending).toBe(false);
    expect(document.activeElement).toBe(form.elements.namedItem("email"));
  });

  it("prevents the browser's own submit", () => {
    const { result } = renderSignInHook();
    const event = submitEvent();

    act(() => {
      result.current.handleSubmit(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("submits the validated data, stays pending, then calls onSuccess", async () => {
    const { result, submit: submitMock, onSuccess } = renderSignInHook();
    const response = deferred<undefined>();
    submitMock.mockReturnValue(response.promise);
    fill(result, { ...credentials, email: ` ${credentials.email} ` });

    submit(result);

    expect(submitMock).toHaveBeenCalledWith(credentials);
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      response.resolve(undefined);
      await response.promise;
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(true);
  });

  it("ignores a second submit while the first is in flight", () => {
    const { result, submit: submitMock } = renderSignInHook();
    submitMock.mockReturnValue(deferred<undefined>().promise);
    fill(result, credentials);

    submit(result);
    submit(result);

    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("maps a form-level failure", async () => {
    const { result, submit: submitMock, onSuccess } = renderSignInHook();
    submitMock.mockRejectedValue(makeApiError(401, "invalid_credentials"));
    fill(result, credentials);

    submit(result);

    await waitFor(() => {
      expect(result.current.failure).toEqual({
        code: "invalid_credentials",
        formError: authErrorMessages.invalidCredentials,
      });
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.attempt).toBe(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("maps the API's field error onto its field and focuses it", async () => {
    const { result, submit: submitMock, form } = renderSignInHook();
    submitMock.mockRejectedValue(
      makeApiError(422, "validation_error", {
        details: [{ field: "password", code: "too_long", message: "API" }],
      }),
    );
    fill(result, credentials);

    submit(result);

    await waitFor(() => {
      expect(result.current.fieldProps("password").error).toBe(
        validationMessages.signInPassword,
      );
    });
    expect(result.current.serverFieldErrors).toEqual({
      password: validationMessages.signInPassword,
    });
    expect(document.activeElement).toBe(form.elements.namedItem("password"));
  });

  it("drops the API's field error for a value edited while the call was in flight", async () => {
    const { result, submit: submitMock } = renderSignInHook();
    const response = deferred<undefined>();
    submitMock.mockReturnValue(response.promise);
    fill(result, credentials);
    submit(result);

    act(() => {
      result.current
        .fieldProps("email")
        .onChange(changeEvent("bo@example.com"));
    });
    await act(async () => {
      response.reject(
        makeApiError(422, "validation_error", {
          details: [{ field: "email", code: "invalid", message: "API" }],
        }),
      );
      await response.promise.catch(() => undefined);
    });

    expect(result.current.failure?.code).toBe("validation_error");
    expect(result.current.fieldProps("email").error).toBeUndefined();
  });

  it("does not call onSuccess or update after unmounting", async () => {
    const {
      result,
      submit: submitMock,
      onSuccess,
      unmount,
    } = renderSignInHook();
    const response = deferred<undefined>();
    submitMock.mockReturnValue(response.promise);
    fill(result, credentials);
    submit(result);

    unmount();
    response.resolve(undefined);
    await flushPromises();

    expect(onSuccess).not.toHaveBeenCalled();
  });

  describe("after rate_limited", () => {
    // The clock and the interval are faked; flushPromises keeps a real timeout.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    });

    async function rateLimited(retryAfter: string) {
      const hook = renderSignInHook();
      hook.submit.mockRejectedValueOnce(
        makeApiError(429, "rate_limited", {
          headers: { "Retry-After": retryAfter },
        }),
      );
      fill(hook.result, credentials);
      submit(hook.result);
      await act(flushPromises);
      return hook;
    }

    it("holds submitting until Retry-After has passed, counting down each second", async () => {
      const { result, submit: submitMock } = await rateLimited("2");
      expect(result.current.retryAfterSeconds).toBe(2);

      submit(result);
      expect(submitMock).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.retryAfterSeconds).toBe(1);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.retryAfterSeconds).toBeNull();
      expect(vi.getTimerCount()).toBe(0);

      submitMock.mockResolvedValueOnce(undefined);
      submit(result);
      expect(submitMock).toHaveBeenCalledTimes(2);
    });

    it("ends on time when the clock jumps past the deadline with fewer ticks than seconds", async () => {
      const { result } = await rateLimited("30");

      // A throttled background tab: 40 seconds pass, but only one tick fires.
      act(() => {
        vi.setSystemTime(Date.now() + 40_000);
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.retryAfterSeconds).toBeNull();
    });

    it("re-reads the clock when the tab becomes visible, without waiting for a tick", async () => {
      const { result } = await rateLimited("30");

      act(() => {
        vi.setSystemTime(Date.now() + 12_500);
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(result.current.retryAfterSeconds).toBe(18);

      act(() => {
        vi.setSystemTime(Date.now() + 20_000);
        window.dispatchEvent(new Event("focus"));
      });
      expect(result.current.retryAfterSeconds).toBeNull();
    });

    it("lets a submit through once the deadline has passed, before any check", async () => {
      const { result, submit: submitMock } = await rateLimited("30");
      submitMock.mockResolvedValueOnce(undefined);

      vi.setSystemTime(Date.now() + 30_000);
      submit(result);

      expect(submitMock).toHaveBeenCalledTimes(2);
    });

    it("clears its timer and listeners on unmount", async () => {
      const { unmount } = await rateLimited("60");
      expect(vi.getTimerCount()).toBe(1);
      const removeDocumentListener = vi.spyOn(document, "removeEventListener");
      const removeWindowListener = vi.spyOn(window, "removeEventListener");

      unmount();

      expect(vi.getTimerCount()).toBe(0);
      expect(removeDocumentListener).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function),
      );
      expect(removeWindowListener).toHaveBeenCalledWith(
        "focus",
        expect.any(Function),
      );
    });
  });
});
