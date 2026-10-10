import {
  ApiClientError,
  ApiNetworkError,
  createApiClient,
  type Schemas,
} from "@app/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  authErrorMessages,
  SignInAfterSignUpError,
  signInFields,
  toAuthFormError,
} from "../errors";
import {
  confirmPasswordReset,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  signUpAndSignIn,
} from "./auth-api";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);

vi.mock("@/lib/browser-api", () => ({
  getBrowserApiClient: () =>
    createApiClient({ baseUrl: "http://web.test", fetch: fetchMock }),
}));

const credentials = { email: "ana@example.com", password: "correct horse" };

function makeUserResource(
  overrides: Partial<Schemas["CurrentUser"]> = {},
): Schemas["CurrentUser"] {
  return {
    id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
    email: "ana@example.com",
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function errorResponse(
  status: number,
  code: string,
  {
    details = null,
    headers = {},
  }: {
    details?: Schemas["ErrorDetail"][] | null;
    headers?: Record<string, string>;
  } = {},
): Response {
  return jsonResponse(
    status,
    {
      error: {
        code,
        message: `API message for ${code}`,
        request_id: `req-${code}`,
        details,
      },
    },
    headers,
  );
}

function sentRequest(index = 0): Request {
  const request = fetchMock.mock.calls[index]?.[0];
  if (request === undefined) {
    throw new Error(`fetch call ${index} was not made`);
  }
  return request;
}

// Runs the call and returns what it threw, failing if it resolved or threw
// something other than an ApiClientError.
async function apiErrorFrom(call: Promise<unknown>): Promise<ApiClientError> {
  const error = await call.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ApiClientError)) {
    throw new Error(`Expected an ApiClientError, got ${String(error)}`);
  }
  return error;
}

// One case per error the API documents for the endpoint, plus a generic one.
type ErrorCase = {
  name: string;
  response: () => Response;
  status: number;
  code: string;
};

const rateLimited: ErrorCase = {
  name: "rate_limited",
  response: () =>
    errorResponse(429, "rate_limited", { headers: { "Retry-After": "30" } }),
  status: 429,
  code: "rate_limited",
};

const validationError = (field: string): ErrorCase => ({
  name: "validation_error",
  response: () =>
    errorResponse(422, "validation_error", {
      details: [{ field, code: "invalid_value", message: "Invalid value" }],
    }),
  status: 422,
  code: "validation_error",
});

const authorizationError: ErrorCase = {
  name: "authorization_error",
  response: () => errorResponse(403, "authorization_error"),
  status: 403,
  code: "authorization_error",
};

const internalServerError: ErrorCase = {
  name: "internal_server_error",
  response: () => errorResponse(500, "internal_server_error"),
  status: 500,
  code: "internal_server_error",
};

describe("auth API adapters", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe("signUp", () => {
    it("posts the credentials to the sign-up endpoint", async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, makeUserResource()));

      await signUp(credentials);

      const request = sentRequest();
      expect(request.method).toBe("POST");
      expect(request.url).toBe("http://web.test/api/v1/auth/sign-up");
      expect(await request.json()).toEqual({
        email: "ana@example.com",
        password: "correct horse",
      });
    });

    it("returns the created user", async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, makeUserResource()));

      await expect(signUp(credentials)).resolves.toEqual({
        id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
        email: "ana@example.com",
        createdAt: "2026-09-01T10:00:00Z",
      });
    });

    it.each<ErrorCase>([
      {
        name: "email_taken",
        response: () => errorResponse(409, "email_taken"),
        status: 409,
        code: "email_taken",
      },
      rateLimited,
      validationError("password"),
      authorizationError,
      internalServerError,
    ])("throws an ApiClientError on $name", async (errorCase) => {
      fetchMock.mockResolvedValue(errorCase.response());

      const error = await apiErrorFrom(signUp(credentials));

      expect(error.status).toBe(errorCase.status);
      expect(error.error.error.code).toBe(errorCase.code);
    });
  });

  describe("signIn", () => {
    it("posts the credentials to the sign-in endpoint", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, makeUserResource()));

      await signIn(credentials);

      const request = sentRequest();
      expect(request.method).toBe("POST");
      expect(request.url).toBe("http://web.test/api/v1/auth/sign-in");
      expect(await request.json()).toEqual({
        email: "ana@example.com",
        password: "correct horse",
      });
    });

    it("returns the signed-in user", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, makeUserResource({ email: "ana@example.com" })),
      );

      await expect(signIn(credentials)).resolves.toEqual({
        id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
        email: "ana@example.com",
        createdAt: "2026-09-01T10:00:00Z",
      });
    });

    it.each<ErrorCase>([
      {
        name: "invalid_credentials",
        response: () => errorResponse(401, "invalid_credentials"),
        status: 401,
        code: "invalid_credentials",
      },
      rateLimited,
      validationError("email"),
      authorizationError,
      internalServerError,
    ])("throws an ApiClientError on $name", async (errorCase) => {
      fetchMock.mockResolvedValue(errorCase.response());

      const error = await apiErrorFrom(signIn(credentials));

      expect(error.status).toBe(errorCase.status);
      expect(error.error.error.code).toBe(errorCase.code);
    });

    it("keeps the Retry-After header of a rate_limited response", async () => {
      fetchMock.mockResolvedValue(rateLimited.response());

      const error = await apiErrorFrom(signIn(credentials));

      expect(error.headers.get("retry-after")).toBe("30");
    });

    it("keeps the validation_error details", async () => {
      fetchMock.mockResolvedValue(validationError("email").response());

      const error = await apiErrorFrom(signIn(credentials));

      expect(error.error.error.details).toEqual([
        { field: "email", code: "invalid_value", message: "Invalid value" },
      ]);
    });

    it("lets toAuthFormError read Retry-After from a real 429 response", async () => {
      const now = new Date("2026-10-08T12:00:00Z");
      fetchMock.mockResolvedValue(
        errorResponse(429, "rate_limited", {
          headers: { "Retry-After": "Thu, 08 Oct 2026 12:02:00 GMT" },
        }),
      );

      const error: unknown = await signIn(credentials).catch(
        (reason: unknown) => reason,
      );

      expect(toAuthFormError(error, { fields: signInFields, now })).toEqual({
        code: "rate_limited",
        formError: "Too many attempts. Try again in 2 minutes.",
        fieldErrors: {},
        retryAfterSeconds: 120,
        requestId: "req-rate_limited",
      });
    });

    it("throws ApiNetworkError when the request gets no response", async () => {
      const networkError = new TypeError("fetch failed");
      fetchMock.mockRejectedValue(networkError);

      const error: unknown = await signIn(credentials).catch(
        (reason: unknown) => reason,
      );

      expect(error).toBeInstanceOf(ApiNetworkError);
      expect(error).toHaveProperty("cause", networkError);
      expect(toAuthFormError(error)).toMatchObject({
        code: "network_error",
        formError: authErrorMessages.unreachable,
      });
    });

    it("rethrows an abort unchanged", async () => {
      const abort = new DOMException(
        "The operation was aborted.",
        "AbortError",
      );
      fetchMock.mockRejectedValue(abort);

      await expect(signIn(credentials)).rejects.toBe(abort);
    });

    it("does not report a broken success body as a network failure", async () => {
      fetchMock.mockResolvedValue(noContent());

      const error: unknown = await signIn(credentials).catch(
        (reason: unknown) => reason,
      );

      expect(error).toBeInstanceOf(TypeError);
      expect(toAuthFormError(error)).toMatchObject({
        code: "unexpected_error",
      });
    });
  });

  describe("signUpAndSignIn", () => {
    it("signs up, then signs in with the same credentials", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse(201, makeUserResource({ email: "new@example.com" })),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            200,
            makeUserResource({ email: "signed-in@example.com" }),
          ),
        );

      const user = await signUpAndSignIn(credentials);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sentRequest(0).url).toBe("http://web.test/api/v1/auth/sign-up");
      expect(await sentRequest(0).json()).toEqual(credentials);
      expect(sentRequest(1).url).toBe("http://web.test/api/v1/auth/sign-in");
      expect(await sentRequest(1).json()).toEqual(credentials);
      expect(user.email).toBe("signed-in@example.com");
    });

    it("throws a sign-up failure as is and never signs in", async () => {
      fetchMock.mockResolvedValue(errorResponse(409, "email_taken"));

      const error = await apiErrorFrom(signUpAndSignIn(credentials));

      expect(error.status).toBe(409);
      expect(error.error.error.code).toBe("email_taken");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("wraps a sign-in failure after sign-up in SignInAfterSignUpError", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(201, makeUserResource()))
        .mockResolvedValueOnce(
          errorResponse(429, "rate_limited", {
            headers: { "Retry-After": "30" },
          }),
        );

      const error: unknown = await signUpAndSignIn(credentials).catch(
        (reason: unknown) => reason,
      );

      expect(error).toBeInstanceOf(SignInAfterSignUpError);
      const cause = error instanceof Error ? error.cause : undefined;
      expect(cause).toBeInstanceOf(ApiClientError);
      expect(cause).toMatchObject({
        status: 429,
        error: { error: { code: "rate_limited" } },
      });
      expect(toAuthFormError(error)).toMatchObject({
        code: "sign_in_after_sign_up_failed",
        formError: authErrorMessages.signInAfterSignUp,
        retryAfterSeconds: 30,
      });
    });
  });

  describe("signOut", () => {
    it("posts to the sign-out endpoint without a body", async () => {
      fetchMock.mockResolvedValue(noContent());

      await signOut();

      const request = sentRequest();
      expect(request.method).toBe("POST");
      expect(request.url).toBe("http://web.test/api/v1/auth/sign-out");
      expect(request.body).toBeNull();
    });

    it("resolves on 204", async () => {
      fetchMock.mockResolvedValue(noContent());

      await expect(signOut()).resolves.toBeUndefined();
    });

    it("resolves on 401, because the session has already ended", async () => {
      fetchMock.mockResolvedValue(errorResponse(401, "authentication_error"));

      await expect(signOut()).resolves.toBeUndefined();
    });

    it.each<ErrorCase>([authorizationError, internalServerError])(
      "throws an ApiClientError on $name",
      async (errorCase) => {
        fetchMock.mockResolvedValue(errorCase.response());

        const error = await apiErrorFrom(signOut());

        expect(error.status).toBe(errorCase.status);
        expect(error.error.error.code).toBe(errorCase.code);
      },
    );

    it("throws ApiNetworkError when the request gets no response", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      await expect(signOut()).rejects.toBeInstanceOf(ApiNetworkError);
    });
  });

  describe("requestPasswordReset", () => {
    it("posts the email to the password-reset endpoint", async () => {
      fetchMock.mockResolvedValue(noContent());

      await expect(
        requestPasswordReset({ email: "ana@example.com" }),
      ).resolves.toBeUndefined();

      const request = sentRequest();
      expect(request.method).toBe("POST");
      expect(request.url).toBe("http://web.test/api/v1/auth/password-reset");
      expect(await request.json()).toEqual({ email: "ana@example.com" });
    });

    it.each<ErrorCase>([
      rateLimited,
      validationError("email"),
      authorizationError,
      internalServerError,
    ])("throws an ApiClientError on $name", async (errorCase) => {
      fetchMock.mockResolvedValue(errorCase.response());

      const error = await apiErrorFrom(
        requestPasswordReset({ email: "ana@example.com" }),
      );

      expect(error.status).toBe(errorCase.status);
      expect(error.error.error.code).toBe(errorCase.code);
    });

    it("keeps the Retry-After header of a rate_limited response", async () => {
      fetchMock.mockResolvedValue(rateLimited.response());

      const error = await apiErrorFrom(
        requestPasswordReset({ email: "ana@example.com" }),
      );

      expect(error.headers.get("retry-after")).toBe("30");
    });
  });

  describe("confirmPasswordReset", () => {
    const confirmation = {
      token: "reset-token-123",
      newPassword: "new secret",
    };

    it("posts the token and new_password to the confirm endpoint", async () => {
      fetchMock.mockResolvedValue(noContent());

      await expect(confirmPasswordReset(confirmation)).resolves.toBeUndefined();

      const request = sentRequest();
      expect(request.method).toBe("POST");
      expect(request.url).toBe(
        "http://web.test/api/v1/auth/password-reset/confirm",
      );
      expect(await request.json()).toEqual({
        token: "reset-token-123",
        new_password: "new secret",
      });
    });

    it.each<ErrorCase>([
      {
        name: "invalid_reset_token",
        response: () => errorResponse(400, "invalid_reset_token"),
        status: 400,
        code: "invalid_reset_token",
      },
      validationError("new_password"),
      authorizationError,
      internalServerError,
    ])("throws an ApiClientError on $name", async (errorCase) => {
      fetchMock.mockResolvedValue(errorCase.response());

      const error = await apiErrorFrom(confirmPasswordReset(confirmation));

      expect(error.status).toBe(errorCase.status);
      expect(error.error.error.code).toBe(errorCase.code);
    });
  });
});
