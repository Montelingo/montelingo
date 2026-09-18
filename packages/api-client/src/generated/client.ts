import type { ErrorBody, ErrorDetail, ErrorEnvelope, ExampleCreate, ExampleResource, LocalizedText, PageInfo, PaginatedResponse_ExampleResource_ } from "./index";

export * from "./index";

export type ClientRequestOptions = {
  baseUrl?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export const DEFAULT_API_BASE_URL =
  typeof window !== "undefined" && typeof window.location !== "undefined"
    ? window.location.origin
    : "http://localhost:8000";

export class ApiClientError extends Error {
  readonly status: number;
  readonly error: ErrorEnvelope;

  constructor(status: number, error: ErrorEnvelope) {
    super(error.error.message || "Request failed with status " + status);
    this.name = "ApiClientError";
    this.status = status;
    this.error = error;
  }
}

function buildUrl(
  pathTemplate: string,
  pathParams: Record<string, string | number | boolean | null | undefined> = {},
  queryParams: Record<string, unknown> = {},
): string {
  let url = pathTemplate;

  for (const [key, value] of Object.entries(pathParams)) {
    if (value === undefined || value === null) {
      continue;
    }

    url = url.split("{" + key + "}").join(encodeURIComponent(String(value)));
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          search.append(key, String(item));
        }
      }
      continue;
    }

    search.append(key, String(value));
  }

  const queryString = search.toString();
  return queryString ? url + "?" + queryString : url;
}

async function requestJson<T>(url: string, init: RequestInit, baseUrl?: string): Promise<T> {
  const resolvedUrl = new URL(url, baseUrl ?? DEFAULT_API_BASE_URL).toString();
  const response = await fetch(resolvedUrl, init);
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const payload = text && contentType.includes("application/json") ? JSON.parse(text) : text ? text : undefined;

  if (!response.ok) {
    const errorEnvelope = (payload && typeof payload === "object" && "error" in payload ? payload : {
      error: {
        code: "request_failed",
        message: typeof payload === "string" ? payload : "Request failed with status " + response.status,
        request_id: "",
      },
    }) as ErrorEnvelope;

    throw new ApiClientError(response.status, errorEnvelope);
  }

  return payload as T;
}

export async function examples_list(query: {
  page_size?: number;
  cursor?: string | null;
} = {}, options: ClientRequestOptions = {}): Promise<PaginatedResponse_ExampleResource_> {
  const url = buildUrl("/api/v1/examples", {}, query ?? {});
  const init: RequestInit = {
    method: "GET",
    headers: { ...(options.headers ?? {}) },
    signal: options.signal,
  };

  return requestJson<PaginatedResponse_ExampleResource_>(buildUrl("/api/v1/examples", {}, query ?? {}), init, options.baseUrl ?? DEFAULT_API_BASE_URL);
}
export async function examples_create(body: ExampleCreate, options: ClientRequestOptions = {}): Promise<ExampleResource> {
  const url = buildUrl("/api/v1/examples", {}, {});
  const init: RequestInit = {
    method: "POST",
    headers: { ...(options.headers ?? {}) },
    signal: options.signal,
  };

  if (body !== undefined) {
    init.headers = {
      ...(init.headers ?? {}),
      "Content-Type": "application/json",
    };
    init.body = JSON.stringify(body);
  }
  return requestJson<ExampleResource>(buildUrl("/api/v1/examples", {}, {}), init, options.baseUrl ?? DEFAULT_API_BASE_URL);
}
export async function health_get(options: ClientRequestOptions = {}): Promise<Record<string, unknown>> {
  const url = buildUrl("/api/v1/health", {}, {});
  const init: RequestInit = {
    method: "GET",
    headers: { ...(options.headers ?? {}) },
    signal: options.signal,
  };

  return requestJson<Record<string, unknown>>(buildUrl("/api/v1/health", {}, {}), init, options.baseUrl ?? DEFAULT_API_BASE_URL);
}
export async function live_api_v1_health_live_get(options: ClientRequestOptions = {}): Promise<Record<string, unknown>> {
  const url = buildUrl("/api/v1/health/live", {}, {});
  const init: RequestInit = {
    method: "GET",
    headers: { ...(options.headers ?? {}) },
    signal: options.signal,
  };

  return requestJson<Record<string, unknown>>(buildUrl("/api/v1/health/live", {}, {}), init, options.baseUrl ?? DEFAULT_API_BASE_URL);
}
export async function ready_api_v1_health_ready_get(options: ClientRequestOptions = {}): Promise<void> {
  const url = buildUrl("/api/v1/health/ready", {}, {});
  const init: RequestInit = {
    method: "GET",
    headers: { ...(options.headers ?? {}) },
    signal: options.signal,
  };

  return requestJson<void>(buildUrl("/api/v1/health/ready", {}, {}), init, options.baseUrl ?? DEFAULT_API_BASE_URL);
}
export async function not_found_example(options: ClientRequestOptions = {}): Promise<void> {
  const url = buildUrl("/api/v1/not-found", {}, {});
  const init: RequestInit = {
    method: "GET",
    headers: { ...(options.headers ?? {}) },
    signal: options.signal,
  };

  return requestJson<void>(buildUrl("/api/v1/not-found", {}, {}), init, options.baseUrl ?? DEFAULT_API_BASE_URL);
}

