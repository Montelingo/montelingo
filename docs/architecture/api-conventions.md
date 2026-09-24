# API conventions

## Versioning

- All product endpoints live under `/api/v1`.
- Health checks use `/api/v1/health` for consistency.
- Breaking changes require `/api/v2` or a migration plan documented in the ADR.

## Identifiers, timestamps, and field naming

- Public identifiers are UUID strings.
- Sequential database identifiers are never exposed in public APIs.
- Timestamps are UTC and serialized as RFC 3339 strings using `Z` when supported.
- JSON and generated contract fields use `snake_case`.

## Success response shape

- Single-resource endpoints return the resource representation directly.
- Collection endpoints return a paginated envelope with `items` and `page`.
- Pagination must include a maximum page size and an opaque cursor.

## Error envelope

All API errors share the same envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "request_id": "e4c6b3d8-5d39-4d4a-9e5c-d4af6900d9fc",
    "details": null
  }
}
```

Validation errors normalize field-level details and never expose raw framework internals.

## OpenAPI and generated client

- OpenAPI operation IDs are explicit and stable.
- Every public endpoint documents the shared error envelope in responses.
- Generated frontend types are checked against the FastAPI schema to prevent drift.
