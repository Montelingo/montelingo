# Montelingo

Minimal runnable monorepo where the frontend (`apps/web`) and backend
(`apps/api`) install, run, test, and build independently, while Docker
Compose provides shared local infrastructure (PostgreSQL).

The workspace uses pnpm workspaces (`apps/web`, `packages/*`) and a uv
workspace (`apps/api`) rather than a monorepo orchestrator such as Nx or
Turborepo; root `package.json` scripts wrap each app's commands (see
[ADR 0001](docs/adr/0001-monorepo-without-heavyweight-orchestrator.md)).

## Documentation

- [FastAPI modular-monolith boundaries and rules](docs/fastapi-modular-monolith.md)
- [Frontend architecture conventions](docs/frontend-architecture.md)
- [API conventions](docs/architecture/api-conventions.md)
- Architecture decision records:
  - [ADR 0001: Monorepo without a heavyweight orchestrator](docs/adr/0001-monorepo-without-heavyweight-orchestrator.md)
  - [ADR 0002: OpenAPI contract and client generation](docs/adr/0002-openapi-contract-and-client-generation.md)

All Markdown files are formatted with Prettier (`pnpm format:docs` to fix,
`pnpm format:check:docs` to check; CI runs the check).

## Repository structure

```
.
├── .github/
│   ├── workflows/          # ci.yml, containers.yml, e2e.yml
│   └── CODEOWNERS
├── apps/
│   ├── api/                # FastAPI backend (uv project)
│   │   ├── app/
│   │   │   ├── api/v1/     # /api/v1 router (aggregates module routers)
│   │   │   ├── core/       # settings, error codes/handlers, request IDs
│   │   │   ├── db/         # async SQLAlchemy engine/session, Base
│   │   │   ├── modules/    # business modules (health); see docs/fastapi-modular-monolith.md
│   │   │   ├── schemas/    # shared API schemas (error envelope, pagination)
│   │   │   └── main.py     # create_app() application factory
│   │   ├── alembic/        # Alembic env + versions
│   │   ├── scripts/        # export_openapi.py (writes packages/api-client/openapi.json)
│   │   ├── tests/          # pytest: contract/ and unit/ tests
│   │   ├── alembic.ini
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   └── web/                # Next.js frontend (pnpm project)
│       ├── public/
│       ├── src/
│       │   ├── app/        # App Router (layout, page, globals.css)
│       │   ├── features/   # feature slices (health: API adapter, model, UI, tests)
│       │   └── lib/        # shared utilities (API request options)
│       ├── Dockerfile
│       ├── eslint.config.mjs
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── vitest.config.ts
│       └── package.json
├── packages/
│   └── api-client/         # @app/api-client: generated OpenAPI types + openapi-fetch client
│       ├── openapi.json    # committed OpenAPI schema exported from apps/api
│       ├── scripts/        # check-generated.mjs (pnpm contract:check)
│       └── src/            # client.ts, index.ts, generated/schema.ts
├── tests/
│   └── e2e/                # smoke.sh: Docker Compose stack smoke test (pnpm e2e:smoke)
├── docs/
│   ├── adr/                # architecture decision records
│   ├── architecture/       # API conventions
│   ├── fastapi-modular-monolith.md
│   └── frontend-architecture.md
├── compose.yaml
├── package.json            # root scripts wrapping pnpm/uv commands; Prettier for Markdown
├── pnpm-workspace.yaml     # pnpm workspace (apps/web, packages/*)
├── pnpm-lock.yaml
├── pyproject.toml          # uv workspace root (apps/api member)
├── uv.lock
├── .python-version         # Python version for uv (local, CI, API image)
├── .env.example
├── .editorconfig
├── .dockerignore
└── .gitignore
```

## Prerequisites

- Node.js 22+, `pnpm` (pinned via `packageManager` in [package.json](package.json))
- Python 3.12 (pinned in [.python-version](.python-version); `uv` downloads it if
  missing), [`uv`](https://docs.astral.sh/uv/)
- Docker + Docker Compose

Copy `.env.example` to `.env` (or export the variables) before running Compose.

## Frontend (`apps/web`)

```bash
pnpm install
pnpm dev:web         # next dev
pnpm test:web        # vitest run
pnpm lint:web        # eslint .
pnpm typecheck:web   # tsc --noEmit
pnpm build:web       # next build (output: "standalone")
```

Styling: Tailwind CSS v3 (`tailwind.config.ts`, `postcss.config.mjs`,
`@tailwind` directives in `src/app/globals.css`), styled with utility classes
directly in components.

## Backend (`apps/api`)

```bash
uv sync --project apps/api --all-groups
uv run --project apps/api fastapi dev apps/api/app/main.py
pnpm run format:check:api   # ruff format --check
pnpm run lint:api           # ruff check
pnpm run typecheck:api      # mypy
pnpm run test:api           # pytest
pnpm run db:upgrade         # alembic upgrade head
pnpm run db:check           # alembic check (drift detection)
```

All `pnpm run *:api` / `db:*` scripts are thin wrappers around `uv run
--project apps/api ...` (see [package.json](package.json)) so the exact same
commands run locally and in CI. Alembic's `script_location` is relative to
the current working directory, so `-c apps/api/alembic.ini` must always be
invoked from the repository root (not from inside `apps/api/`).

Health endpoints (under the central `/api/v1` router):

- `GET /api/v1/health/live` — always returns `{"status": "ok"}` when the process is up.
- `GET /api/v1/health/ready` — returns `200 {"status": "ready"}` when PostgreSQL
  is reachable, or `503` with the shared error envelope
  (`code: "service_unavailable"`) otherwise (fails safe).

## Local Docker Compose

```bash
docker compose up --build   # postgres + api + web (production-style images)
docker compose down
```

- PostgreSQL is only reachable from `api` through the Compose network
  (`internal`); a nonproduction host port (`5433:5432`) is exposed only for
  local developer tooling (e.g. running Alembic from the host).
- `web` and `api` support live-reload only via the `dev` profile
  (`api-dev`, `web-dev` services): `docker compose --profile dev up --build`.
- All build contexts are project-relative (`context: .` with app-specific
  Dockerfiles), and a root `.dockerignore` keeps the build context small.
- No secrets are committed; `.env.example` only contains safe local placeholders.
- The API image runs Alembic migrations then starts the server; it does not
  run the test suite on container startup.

## Continuous Integration

CI runs the same commands documented above: the root-level `pnpm run

<script>` wrappers, or (in jobs that only install uv) the exact `uv run
--project apps/api ...` commands those wrappers call. Nothing in CI runs
bespoke validation logic that isn't also reproducible on a developer machine. Workflows live in
[.github/workflows](.github/workflows) and run on every pull request, on
pushes to `main`, and on demand (`workflow_dispatch`):

- **`ci.yml`** — the required status check for pull requests. Five
  independent jobs:
  - `frontend`: `pnpm run format:check:web`, `lint:web`, `typecheck:web`,
    `test:web`, `build:web`.
  - `backend`: the commands behind `format:check:api`, `lint:api`,
    `typecheck:api`, `db:upgrade` (against a Postgres service container),
    then `test:api` (JUnit results uploaded as an artifact).
  - `database`: applies Alembic migrations to a fresh Postgres service
    container and runs the `db:check` command to catch model/migration drift.
  - `contract`: regenerates and diffs the OpenAPI spec / TypeScript client
    (`pnpm run contract:check`) and type-checks the generated client
    (`pnpm run typecheck:api-client`), so `packages/api-client` can never
    silently drift from `apps/api`.
  - `docs`: `pnpm run format:check:docs` (Prettier over every Markdown file).
- **`containers.yml`** — builds the production `apps/api` and `apps/web`
  Docker images, scans them with Trivy (fails on CRITICAL/HIGH
  vulnerabilities), and, only on pushes to `main`, pushes the images to the
  GitHub Container Registry tagged by commit SHA, branch, and semver (when
  applicable).
- **`e2e.yml`** — runs `docker compose up --build` for the full production
  stack (`postgres` + `api` + `web`) and then `pnpm run e2e:smoke`
  ([tests/e2e/smoke.sh](tests/e2e/smoke.sh)), which polls both services'
  health endpoints and asserts they return `200`. Compose logs are uploaded
  as an artifact on failure, and the stack is always torn down
  (`docker compose down -v`) at the end of the job.

## Validation performed

The following was run and verified locally:

- `pnpm run format:check:web`, `lint:web`, `typecheck:web`, `test:web`,
  `build:web` — all pass (production build with `output: "standalone"`,
  Tailwind CSS compiled via PostCSS).
- `pnpm run format:check:api`, `lint:api`, `typecheck:api`, `test:api` — all
  pass (health endpoints plus OpenAPI contract checks).
- `pnpm run db:upgrade` and `pnpm run db:check` against a local PostgreSQL
  container — succeed with no drift.
- `pnpm run contract:check` and `pnpm run typecheck:api-client` — pass,
  confirming `packages/api-client` matches the live OpenAPI schema.
- Both `apps/api/Dockerfile` and `apps/web/Dockerfile` build successfully
  (`runtime` target) with `uv.lock` / `pnpm-lock.yaml` respected
  (`uv sync --locked`, matching lockfiles).
- `docker compose up --build` started `postgres`, `api`, and `web`; all
  reported healthy, and `pnpm run e2e:smoke` passed against the running
  stack. `docker compose down` cleanly removed containers and the network.
- All three workflow YAML files (`ci.yml`, `containers.yml`, `e2e.yml`)
  parse successfully and their lockfile-dependent steps
  (`uv sync --locked`, `pnpm install --frozen-lockfile`) succeed against the
  committed lockfiles.
