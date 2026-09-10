export type ErrorCode = "validation_error" | "authentication_error" | "authorization_error" | "not_found" | "conflict" | "rate_limited" | "internal_server_error" | "bad_request";

export type ErrorDetail = {
  field?: string | null;
  code: string;
  message: string;
};

export type ErrorEnvelope = {
  error: {
    code: ErrorCode;
    message: string;
    request_id: string;
    details?: ErrorDetail[] | null;
  };
};

export type ErrorBody = {
  code?: string;
  details?: unknown;
  message?: string;
  request_id?: string;
};
export type ErrorDetail = {
  code?: string;
  field?: unknown;
  message?: string;
};
export type ErrorEnvelope = {
  error?: unknown;
};
export type ExampleCreate = {
  language?: unknown;
  name?: string;
};
export type ExampleResource = {
  id?: string;
  language?: unknown;
  name?: string;
};
export type LocalizedText = {
  language_code?: string;
  value?: string;
};
export type PageInfo = {
  has_more?: boolean;
  next_cursor?: unknown;
};
export type PaginatedResponseExampleResource = {
  items?: unknown[];
  page?: unknown;
};
