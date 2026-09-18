# Montelingo

Minimal runnable monorepo where the frontend (`apps/web`) and backend
(`apps/api`) install, run, test, and build independently, while Docker
Compose provides shared local infrastructure (PostgreSQL).

See [docs/adr/0001-monorepo-without-heavyweight-orchestrator.md](docs/adr/0001-monorepo-without-heavyweight-orchestrator.md)
for why this repo does not use Nx/Turborepo.

## Repository structure

```
.
├── apps/
│   ├── api/                # FastAPI backend (uv project)
│   │   ├── app/
│   │   │   ├── api/v1/     # /api/v1 router + endpoints (health)
│   │   │   ├── core/       # settings (pydantic-settings)
│   │   │   ├── db/         # async SQLAlchemy engine/session, Base
│   │   │   └── main.py     # create_app() application factory
│   │   ├── alembic/        # Alembic env + versions
│   │   ├── tests/          # pytest tests
│   │   ├── alembic.ini
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   └── web/                # Next.js frontend (pnpm project)
│       ├── src/
│       │   ├── app/        # App Router (layout, page, globals.css)
│       │   └── lib/        # health state helper + unit test
│       ├── Dockerfile
│       ├── eslint.config.mjs
│       ├── next.config.ts
│       └── package.json
├── packages/                # Placeholder for shared packages
├── tests/e2e/                # Placeholder for end-to-end tests
├── docs/adr/                 # Architecture decision records
├── compose.yaml
├── pnpm-workspace.yaml
├── package.json
├── pyproject.toml            # uv workspace root (apps/api member)
├── .env.example
├── .editorconfig
└── .gitignore
```

## Prerequisites

- Node.js 22+, `pnpm` (pinned via `packageManager` in [package.json](package.json))
- Python 3.12+, [`uv`](https://docs.astral.sh/uv/)
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
uv run --project apps/api ruff check apps/api
uv run --project apps/api ruff format --check apps/api
uv run --project apps/api mypy apps/api/app
uv run --project apps/api pytest apps/api/tests
uv run --project apps/api alembic -c apps/api/alembic.ini upgrade head
uv run --project apps/api alembic -c apps/api/alembic.ini check
```

Health endpoints (under the central `/api/v1` router):

- `GET /api/v1/health/live` — always returns `{"status": "ok"}` when the process is up.
- `GET /api/v1/health/ready` — returns `200 {"status": "ready"}` when PostgreSQL
  is reachable, or `503 {"status": "not_ready"}` otherwise (fails safe).

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

## Validation performed

The following was run and verified locally:

- `pnpm install`, `pnpm lint:web`, `pnpm typecheck:web`, `pnpm test:web`,
  `pnpm build:web` — all pass (2 vitest tests, production build with
  `output: "standalone"`, Tailwind CSS compiled via PostCSS).
- `uv sync --project apps/api --all-groups`, `ruff check`, `ruff format
  --check`, `mypy`, `pytest apps/api/tests` — all pass (2 tests: live health,
  ready-without-database).
- `alembic upgrade head` and `alembic check` against a local PostgreSQL
  container — succeed with no drift (empty baseline migration only).
- Frontend started alone (`pnpm dev:web`) without the backend running;
  page renders "API live state: unavailable".
- Backend started alone (`fastapi dev`) without the frontend running;
  `/api/v1/health/live` returns 200 while PostgreSQL was stopped, and
  `/api/v1/health/ready` returned 503 `not_ready`. After restarting
  PostgreSQL and re-running the Alembic upgrade, `/api/v1/health/ready`
  returned 200 `ready`.
- `docker compose up --build` started `postgres`, `api`, and `web`; all
  reported healthy, `http://localhost:3000` rendered "API live state:
  healthy", and both `http://localhost:8000/api/v1/health/live` and
  `/api/v1/health/ready` returned 200. `docker compose down` cleanly
  removed containers and the network.

