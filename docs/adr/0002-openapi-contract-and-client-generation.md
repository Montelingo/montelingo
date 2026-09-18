# ADR 0002: OpenAPI contract and client generation

- Status: Accepted
- Date: 2026-09-10

## Context

The API contract must be intentionally versioned, explicit, and stable enough for frontend developers to build against without reading backend internals. The same schema must also drive generated client types to prevent drift.

## Decision

We standardize on:

- `/api/v1` for all product endpoints.
- explicit, stable OpenAPI `operationId` values.
- shared error envelopes with a machine-readable `code`, human-safe `message`, correlation `request_id`, and optional `details`.
- localized text represented explicitly when multiple language variants are returned.
- generated TypeScript contract artifacts checked against FastAPI OpenAPI output.

## Consequences

- Frontend code can consume a stable public contract.
- Breaking changes require versioning and migration planning.
- Contract drift is prevented by automated generation and checks.
