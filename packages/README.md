# Shared packages

pnpm workspace packages shared by the apps (`packages/*` in `pnpm-workspace.yaml`).

- [`api-client`](api-client) (`@app/api-client`): TypeScript types generated from the API's OpenAPI schema, plus a small `openapi-fetch` client. `apps/web` consumes it through `workspace:*`. See [ADR 0002](../docs/adr/0002-openapi-contract-and-client-generation.md) and [API conventions](../docs/architecture/api-conventions.md).
