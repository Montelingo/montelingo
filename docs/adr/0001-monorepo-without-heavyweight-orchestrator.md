# ADR 0001: Monorepo without a heavyweight orchestrator

- Status: Accepted
- Date: 2026-09-27 (records the workspace structure established in #3)

## Context

Montelingo has a Next.js frontend (`apps/web`), a FastAPI backend (`apps/api`), and a generated TypeScript API client (`packages/api-client`). They live in one repository so that a contract change, the backend change behind it, and the frontend change that consumes it can ship in one pull request.

The two ecosystems already have first-class workspace tooling:

- **pnpm workspaces** link JavaScript packages (`apps/web` depends on `@app/api-client` via `workspace:*`) and share one `pnpm-lock.yaml`.
- **uv workspaces** manage the Python project (`apps/api`) with one `uv.lock`.

Monorepo orchestrators such as Nx or Turborepo add task graphs, remote caching, and affected-project detection. With two apps and one package, those features solve problems we do not have yet. They would also add configuration, plugins, and a layer between developers and the underlying tools, and neither orchestrator handles Python natively.

## Decision

- Use a **pnpm workspace** (`pnpm-workspace.yaml`: `apps/web`, `packages/*`) for JavaScript and a **uv workspace** (root `pyproject.toml`: `apps/api`) for Python. Do not adopt Nx, Turborepo, or a similar orchestrator.
- Each app installs, runs, tests, and builds independently with its own native tooling (`pnpm --filter ...`, `uv run --project apps/api ...`).
- The root `package.json` provides thin, named scripts (`test:web`, `lint:api`, `db:check`, `contract:check`, ...) that wrap those native commands. They give developers and CI one set of entry points and no extra logic.
- The Python version is pinned once in the root `.python-version`, which uv reads locally, in CI, and in the API image. `apps/api/pyproject.toml` (`requires-python`, ruff `target-version`, mypy `python_version`) and the `python:<version>-slim` base image in `apps/api/Dockerfile` match it.
- CI runs one independent job per concern (frontend, backend, database, contract, docs) instead of relying on affected-project detection.

## Consequences

- Onboarding needs only pnpm, uv, and Docker. Every command in the README is a plain pnpm or uv invocation that can be run and debugged directly.
- Nothing is cached across tasks or machines beyond the package-manager caches in CI. Every CI run rebuilds and retests every app. This is acceptable at the current size.
- Cross-app ordering (for example, regenerating `packages/api-client` after an API change) is an explicit step, not an inferred task graph. `pnpm contract:check` re-exports `openapi.json` from FastAPI, regenerates the client types, and fails if the result differs from what is committed.
- Revisit this decision if CI time or the number of apps and packages grows enough that affected-only builds or remote caching would pay for the added tooling.
