import createClient, { type Client, type ClientOptions } from "openapi-fetch";

import type { components, paths } from "./generated/schema";

export type Schemas = components["schemas"];
export type ErrorEnvelope = Schemas["ErrorEnvelope"];
export type ApiClient = Client<paths>;
export type ApiClientOptions = ClientOptions;

export const DEFAULT_API_BASE_URL =
  typeof window !== "undefined" && typeof window.location !== "undefined"
    ? window.location.origin
    : "http://localhost:8000";

/** Creates a client whose paths, params, and responses are typed from the OpenAPI schema. */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return createClient<paths>({ ...options, baseUrl: options.baseUrl ?? DEFAULT_API_BASE_URL });
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly error: ErrorEnvelope;

  constructor(status: number, error: ErrorEnvelope) {
    super(error.error.message || `Request failed with status ${status}`);
    this.name = "ApiClientError";
    this.status = status;
    this.error = error;
  }
}

type ApiResult = { data?: unknown; error?: unknown; response: Response };
type ApiSuccess<Result extends ApiResult> = Extract<Result, { error?: never }>;

/**
 * Resolves to the typed success body, or throws `ApiClientError` carrying the
 * shared error envelope for any non-2xx response.
 */
export async function unwrap<Result extends ApiResult>(
  request: Promise<Result>,
): Promise<ApiSuccess<Result>["data"]> {
  const result = await request;
  if (!isSuccess(result)) {
    throw new ApiClientError(result.response.status, toErrorEnvelope(result.error, result.response));
  }
  return result.data;
}

function isSuccess<Result extends ApiResult>(result: Result): result is ApiSuccess<Result> {
  return result.error === undefined && result.response.ok;
}

function toErrorEnvelope(error: unknown, response: Response): ErrorEnvelope {
  if (isErrorEnvelope(error)) {
    return error;
  }
  return {
    error: {
      code: "request_failed",
      message:
        typeof error === "string" && error ? error : `Request failed with status ${response.status}`,
      request_id: response.headers.get("X-Request-Id") ?? "",
      details: null,
    },
  };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const body: unknown = value.error;
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string" &&
    "message" in body &&
    typeof body.message === "string"
  );
}
