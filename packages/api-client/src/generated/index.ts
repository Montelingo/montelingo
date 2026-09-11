export type ErrorBody = {
  code: string;
  details?: ErrorDetail[] | null;
  message: string;
  request_id: string;
};

export type ErrorDetail = {
  code?: string;
  field?: string | null;
  message?: string;
};

export type ErrorEnvelope = {
  error: ErrorBody;
};

export type ExampleCreate = {
  language?: LocalizedText | null;
  name: string;
};

export type ExampleResource = {
  id: string;
  language?: LocalizedText | null;
  name: string;
};

export type LocalizedText = {
  language_code: string;
  value: string;
};

export type PageInfo = {
  has_more?: boolean;
  next_cursor?: string | null;
};

export type PaginatedResponse_ExampleResource_ = {
  items: ExampleResource[];
  page: PageInfo;
};
