# ADR 0002: OpenAPI contract and client generation

- Status: Accepted
- Date: 2026-09-10
- Amended: 2026-09-24 (#15: generator choice, operation ID rule, typed responses)

## Context

The API contract must be intentionally versioned, explicit, and stable enough for frontend developers to build against without reading backend internals. The same schema must also drive generated client types to prevent drift.

The first iteration used a hand-written generator (`generate-client.mjs`). It emitted one function per operation but had several problems:

- It built each URL twice and returned unvalidated `JSON.parse` output cast to the expected type.
- It had no real support for enums, nullable `$ref`s, or `allOf`.
- Untyped responses (`dict`, `JSONResponse`) came out as `Record<string, unknown>` or `void`.
- Operations without an explicit `operation_id` got FastAPI's auto-generated names (`live_api_v1_health_live_get`). Those names change whenever a route is renamed or moved.

## Decision

We standardize on:

- `/api/v1` for all product endpoints.
- **Explicit, stable OpenAPI `operationId` values** on every operation, following the naming rule in [API conventions](../architecture/api-conventions.md#operation-ids). A backend contract test fails if any route relies on an auto-generated ID.
- **Typed Pydantic response models** for every JSON response. A contract test fails if any documented JSON response is untyped.
- Shared error envelopes with a machine-readable `code`, human-safe `message`, correlation `request_id`, and optional `details`. Every error status is documented with that envelope, including 422, which replaces FastAPI's default `HTTPValidationError`.
- Localized text represented explicitly when multiple language variants are returned.
- **Maintained generator tooling instead of a custom generator:**
  - [`openapi-typescript`](https://openapi-ts.dev/) generates `packages/api-client/src/generated/schema.ts` (`paths`, `components`, `operations`) from the committed `openapi.json`.
  - [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) provides the runtime client. Its path, parameters, request body, and success/error bodies are all inferred from `paths`.
  - A small hand-written layer (`packages/api-client/src/client.ts`) adds `createApiClient` (default base URL), `unwrap` (returns the typed body or throws `ApiClientError` with the error envelope), and `Schemas` / `ErrorEnvelope` type aliases.
- `pnpm contract:check` regenerates `openapi.json` from FastAPI and `schema.ts` from `openapi.json`. It fails on any difference from the committed files, and the `contract` CI job runs it.

The frontend calls endpoints by path (`client.GET("/api/v1/health/live")`) rather than by generated function name. Operation IDs remain the stable, typed handles in `operations["health_live"]` and in the published schema.

## Consequences

- Frontend code consumes a stable public contract with exact types. Generated types are never `Record<string, unknown>` or `void` for a JSON body.
- Enums, nullable references, `allOf`, `oneOf`, and discriminators are handled by `openapi-typescript` rather than by code we maintain.
- Renaming a Python handler or moving a route no longer silently renames a client operation.
- Response bodies are not validated at runtime. Their correctness relies on FastAPI's `response_model` serialization and on the drift check.
- Breaking changes require versioning and migration planning.
- Demo endpoints do not ship in the production router. Contract behavior (error envelope, validation normalization, pagination) is exercised through test-only routes in `apps/api/tests/contract`.
