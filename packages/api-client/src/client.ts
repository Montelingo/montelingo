import createClient, { type Client, type ClientOptions, type Middleware } from "openapi-fetch";

import type { components, paths } from "./generated/schema";

export type Schemas = components["schemas"];
export type ErrorEnvelope = Schemas["ErrorEnvelope"];
export type ApiClient = Client<paths>;
export type ApiClientOptions = ClientOptions & { baseUrl: string };

/**
 * Creates a client whose paths, params, and responses are typed from the OpenAPI schema.
 * The caller supplies the base URL: the consuming app owns where the API lives.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>(options);
  client.use(networkErrors);
  return client;
}

/**
 * The request never got a response: the network or server is unreachable, or
 * the response could not be read. `cause` holds the error `fetch` threw.
 */
export class ApiNetworkError extends Error {
  constructor(options: { cause: unknown }) {
    super("The request did not reach the server.", options);
    this.name = "ApiNetworkError";
  }
}

// openapi-fetch calls onError only when fetch itself rejects, so this tells a
// network failure apart from an error thrown while handling a response. An
// abort is the caller's own cancellation and is rethrown unchanged.
const networkErrors: Middleware = {
  onError({ error }) {
    if (error instanceof Error && error.name === "AbortError") {
      return undefined;
    }
    return new ApiNetworkError({ cause: error });
  },
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly error: ErrorEnvelope;
  /** The error response's headers, such as `Retry-After` on a `429`. */
  readonly headers: Headers;

  constructor(status: number, error: ErrorEnvelope, headers: Headers = new Headers()) {
    super(error.error.message || `Request failed with status ${status}`);
    this.name = "ApiClientError";
    this.status = status;
    this.error = error;
    this.headers = headers;
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
    throw new ApiClientError(
      result.response.status,
      toErrorEnvelope(result.error, result.response),
      result.response.headers,
    );
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
