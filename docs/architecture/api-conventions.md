# API conventions

## Versioning

- All product endpoints live under `/api/v1`.
- Health checks live under `/api/v1/health`:
  - `GET /api/v1/health/live` (`health_live`) returns `200 {"status": "ok"}` while the process is up.
  - `GET /api/v1/health/ready` (`health_ready`) returns `200 {"status": "ready"}` when dependencies are reachable, or `503` with the shared error envelope (`code: "service_unavailable"`).
- Breaking changes require `/api/v2` or a migration plan documented in the ADR.

## Identifiers, timestamps, and field naming

- Public identifiers are UUID strings.
- Sequential database identifiers are never exposed in public APIs.
- Timestamps are UTC and serialized as RFC 3339 strings using `Z` when supported.
- JSON and generated contract fields use `snake_case`.

## Success response shape

- Every JSON response declares a Pydantic `response_model`. Never return `dict`, `JSONResponse`, or `response_model=dict`.
- Response schemas inherit from `app.schemas.common.ApiSchema`. Fields with defaults are always serialized, so they are marked required in the response schema and typed as present in the client.
- Use `Literal[...]` or `Enum` for fixed value sets so the client gets a union type rather than `string`.
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

Validation errors normalize field-level details and never expose raw framework internals. Endpoints raise `ApiError` (or let the central handlers convert framework errors) instead of building error payloads themselves.

## OpenAPI and generated client

### Operation IDs

Every route declares `operation_id` explicitly. Never rely on FastAPI's auto-generated IDs.

- Format: `<resource>_<action>` in `snake_case`, matching `^[a-z][a-z0-9]*(_[a-z0-9]+)+$`.
- `<resource>` is the plural resource or module name (`lessons`, `health`). `<action>` is the verb or sub-resource (`list`, `get`, `create`, `update`, `delete`, `live`, `ready`).
- Examples: `lessons_list`, `lessons_get`, `lessons_create`, `health_live`, `health_ready`.
- IDs are unique across the API and never change once published. Renaming one is a breaking change.

`apps/api/tests/contract/test_contract.py` enforces explicit IDs, uniqueness, and the format.

### Documented responses

- Document every error status an endpoint can return with `responses=error_responses(...)` from `app.api.responses`. This attaches `ErrorEnvelope`.
- Endpoints with parameters or a body document `422` this way. That replaces FastAPI's default `HTTPValidationError`, which does not match the real response.
- Contract tests fail if any JSON response has no schema or an untyped object schema, or if an error status does not use `ErrorEnvelope`.

### Generated client

- `packages/api-client/openapi.json` is exported from the FastAPI app (`apps/api/scripts/export_openapi.py`).
- `openapi-typescript` generates `packages/api-client/src/generated/schema.ts` from it. Never edit generated files by hand.
- The frontend uses `openapi-fetch` through `createApiClient()` and `unwrap()` from `@app/api-client`. See [ADR 0002](../adr/0002-openapi-contract-and-client-generation.md).
- After changing an endpoint, run `pnpm contract:check`. It regenerates both files. Review and commit the result. CI fails on any drift between FastAPI and the committed client.

### Test-only routes

Demo endpoints do not ship in the production router. Tests that need routes to exercise shared contract behavior mount them on an app created with `create_app()` inside the test module.
