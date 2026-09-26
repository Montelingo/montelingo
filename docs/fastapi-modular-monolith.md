# FastAPI modular-monolith boundaries and rules

`apps/api` is a modular monolith: a single FastAPI application split into modules with clear boundaries. The goal is to keep the system cohesive and easy to evolve without turning it into a "god service" or mixing transport, domain, persistence, and infrastructure concerns.

This document describes the code as it is. `app/modules/health` is the reference module. Examples that use an `accounts` module are **illustrative**: no such module exists yet. They show how the rules apply to layers that `health` does not need (domain models, persistence models, transactions, account scoping).

## 1. Architectural boundaries

### 1.1 Layer responsibilities

The codebase is organized into clear layers with one-way dependencies:

- API layer: routers, request/response schemas, dependency injection, HTTP-specific validation
- Application layer: use cases, orchestration, business rules, transaction boundaries
- Domain layer: entities, value objects, domain rules, repository interfaces, invariants
- Persistence layer: SQLAlchemy models, repository implementations, query logic, migrations
- Infrastructure layer: auth, providers, external APIs, file storage, caching, email, etc.

Dependencies always move inward:

- routers depend on services
- services depend on repositories and domain interfaces
- repositories depend on SQLAlchemy and persistence models
- infrastructure implements interfaces defined by the domain or application layer

The API layer must never contain business rules, persistence queries, or cross-account authorization logic.

### 1.2 Directory layout

```text
apps/api/
  app/
    main.py                  # create_app(): middleware, exception handlers, /api/v1 router
    api/
      responses.py           # error_responses(): documents ErrorEnvelope in OpenAPI
      v1/
        router.py            # aggregates module routers; defines no endpoints
    core/
      config.py              # Settings (pydantic-settings), get_settings()
      errors.py              # ErrorCode, ApiError
      exception_handlers.py  # maps every exception to the ErrorEnvelope contract
      request_id.py          # X-Request-Id resolution and middleware
    db/
      base.py                # SQLAlchemy DeclarativeBase (Alembic target metadata)
      session.py             # async engine, get_db_session()
    schemas/
      common.py              # shared API schemas: ApiSchema, ErrorEnvelope, PaginatedResponse
    modules/
      health/
        router.py            # GET /health/live, GET /health/ready
        schemas.py           # LiveHealth, ReadyHealth
        service.py           # HealthService
        repository.py        # DatabaseProbe, SqlAlchemyDatabaseProbe
  alembic/                   # migration environment and versions
  scripts/
    export_openapi.py        # writes packages/api-client/openapi.json
  tests/
    conftest.py              # shared `app` and `client` fixtures
    contract/                # OpenAPI and error-envelope contract tests
    unit/
      core/                  # exception mapping, request ID
      modules/
        health/              # router and service tests
```

`app/core`, `app/db`, `app/schemas`, and `app/api` are shared infrastructure. They contain no business logic and never import from `app/modules`.

### 1.3 Module structure

Every business capability is a module under `app/modules/<name>/`. A module creates only the files for the layers it actually has:

| File            | Contents                                                      | In `health` |
| --------------- | ------------------------------------------------------------- | ----------- |
| `router.py`     | `APIRouter`, endpoints, `get_<name>_service` dependency       | yes         |
| `schemas.py`    | Pydantic request/response schemas (inherit `ApiSchema`)       | yes         |
| `service.py`    | use cases, transaction boundaries, authorization decisions    | yes         |
| `repository.py` | repository protocol and SQLAlchemy implementation             | yes         |
| `domain.py`     | domain entities, value objects, invariants                    | no          |
| `models.py`     | SQLAlchemy persistence models                                 | no          |
| `errors.py`     | typed domain errors                                           | no          |

Each module owns its own `router.py`; there is no shared, flat `routers/` directory. `app/api/v1/router.py` is the only exception. It is not a module router but the top-level aggregator that registers each module's router under the versioned API:

```python
# app/api/v1/router.py
from fastapi import APIRouter

from app.modules.health.router import router as health_router

router = APIRouter()
router.include_router(health_router, prefix="/health", tags=["health"])
```

Adding a module means creating `app/modules/<name>/` and adding one `include_router` line here. The module's router does not set its own prefix; the aggregator does.

Because every module keeps its `router.py` inside its own directory, filenames never collide across modules: `modules/health/router.py` and `modules/accounts/router.py` are distinct files, so no module-name prefix is needed. If a shared, flat router directory is ever introduced, it must come with a prefix convention to avoid collisions.

If a module grows, split by bounded context, not by technical convenience. A bounded context should own its domain rules and data model.

---

## 2. Hard rules

### 2.1 Routers validate transport concerns only

Routers are responsible for:

- parsing HTTP requests
- verifying request body/params/headers
- converting results and errors into the API contract
- delegating work to a service
- returning serialized response schemas

Routers must not:

- execute SQL queries directly
- contain business validation that is not transport-driven
- mutate domain state without a service call
- read global FastAPI state or request-local hidden mutation

Example, from `app/modules/health/router.py`:

```python
def get_health_service(session: AsyncSession = Depends(get_db_session)) -> HealthService:
    return HealthService(database=SqlAlchemyDatabaseProbe(session))


@router.get(
    "/ready",
    operation_id="health_ready",
    summary="Readiness probe",
    response_model=ReadyHealth,
    responses=error_responses(500, 503),
)
async def ready(service: HealthService = Depends(get_health_service)) -> ReadyHealth:
    if not await service.is_ready():
        raise ApiError(ErrorCode.SERVICE_UNAVAILABLE, "Service is not ready.", status_code=503)
    return ReadyHealth()
```

The router does not run the database check. It asks the service and translates the answer into the API contract (a `ReadyHealth` body or a 503 error envelope). Operation IDs, response models, and documented error responses follow [API conventions](architecture/api-conventions.md).

### 2.2 Schemas, domain models, and persistence models are separate

The codebase must distinguish among three different representations of data:

- Pydantic API schema: transport contract for requests and responses
- Domain model: business object with invariants and behavior
- SQLAlchemy persistence model: database mapping and storage representation

They are not interchangeable.

Illustrative example (`accounts`):

```python
# modules/accounts/schemas.py: API schema
class CreateAccountRequest(ApiSchema):
    name: str
    email: EmailStr


# modules/accounts/domain.py: domain model
@dataclass(slots=True)
class Account:
    id: UUID
    owner_id: UUID
    name: str
    email: str

    @classmethod
    def new(cls, *, owner_id: UUID, name: str, email: str) -> "Account":
        if not name.strip():
            raise ValueError("Account name cannot be empty")
        return cls(id=uuid4(), owner_id=owner_id, name=name.strip(), email=email)

    def rename(self, new_name: str) -> None:
        if not new_name.strip():
            raise ValueError("Account name cannot be empty")
        self.name = new_name.strip()


# modules/accounts/models.py: SQLAlchemy model
class AccountORM(Base):
    __tablename__ = "accounts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
```

Rules:

- Pydantic schemas are not used as domain objects
- ORM models are not returned directly from services or routers
- domain models validate invariant rules independent of HTTP or SQLAlchemy
- conversion between representations happens at module boundaries, never deep inside a router
- persistence models inherit `app.db.base.Base` so Alembic sees them

### 2.3 Repository owns persistence; service owns use cases

Repositories own query logic and fetching/storing persistence details. Services own use cases and workflow orchestration.

Repository responsibilities:

- SQLAlchemy queries
- row-to-domain mapping
- database constraint handling where appropriate
- persistence of aggregates or root entities

Service responsibilities:

- use-case orchestration
- transaction boundaries
- validation of domain rules
- authorization decisions
- coordination between multiple repositories or providers

The service depends on a repository `Protocol`, and the router's dependency function supplies the SQLAlchemy implementation. From `app/modules/health`:

```python
# repository.py
class DatabaseProbe(Protocol):
    async def ping(self) -> None: ...


class SqlAlchemyDatabaseProbe:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ping(self) -> None:
        await self.session.execute(text("SELECT 1"))


# service.py
class HealthService:
    def __init__(self, database: DatabaseProbe) -> None:
        self.database = database

    async def is_ready(self) -> bool:
        try:
            await self.database.ping()
        except Exception:
            # Any failure to reach the database means "not ready"; fail safe.
            logger.warning("readiness_check_failed", exc_info=True)
            return False
        return True
```

A service that writes data also owns the transaction and the authorization decision. Illustrative example (`accounts`):

```python
class AccountRepository(Protocol):
    async def get_by_id(self, account_id: UUID) -> Account | None: ...
    async def save(self, account: Account) -> None: ...


class AccountService:
    def __init__(
        self,
        repo: AccountRepository,
        tx: TransactionManager,
        authz: AuthorizationService,
    ) -> None:
        self.repo = repo
        self.tx = tx
        self.authz = authz

    async def create_account(self, *, owner_id: UUID, name: str, email: str) -> Account:
        await self.authz.ensure_can_create_account(owner_id)
        account = Account.new(owner_id=owner_id, name=name, email=email)
        async with self.tx.begin():
            await self.repo.save(account)
        return account
```

A service may coordinate a database transaction, but the repository still contains the SQL logic.

### 2.4 Provider-specific details stay behind interfaces

Anything external to the domain should be abstracted behind interfaces.

Examples:

- auth provider
- email delivery client
- payment gateway
- object storage
- cache backend
- notification bus

Use protocol / interface + implementation pairs. The service depends on the interface, not the concrete provider (as `HealthService` depends on `DatabaseProbe`, not on `AsyncSession`).

```python
class NotificationClient(Protocol):
    async def send_welcome_email(self, *, user_email: str) -> None: ...


class SendGridNotificationClient:
    async def send_welcome_email(self, *, user_email: str) -> None: ...
```

This keeps vendor-specific code out of the business layer and makes testing easier: `tests/unit/modules/health/test_service.py` tests `HealthService` with a fake probe and no database.

### 2.5 Dependencies are explicit and injected

Do not use FastAPI globals, mutable singleton state, or implicit request context as a business dependency. All dependencies must be provided explicitly via constructor injection or FastAPI `Depends` functions.

Rules:

- pass repositories and clients into services through constructors
- keep `Depends` only at the API boundary, in the module's `router.py`
- avoid module-level mutable state for configuration values or per-request data
- never reach into `request.app.state` for domain logic

Each module's router defines a `get_<name>_service` function that builds the service from its dependencies, as `get_health_service` does in §2.1. A module with more collaborators wires them the same way (illustrative):

```python
def get_account_service(session: AsyncSession = Depends(get_db_session)) -> AccountService:
    return AccountService(
        repo=SqlAlchemyAccountRepository(session),
        tx=SessionTransactionManager(session),
        authz=DefaultAuthorizationService(),
    )
```

If a module needs runtime configuration, inject `Settings` (§4.5) rather than reading environment variables directly.

### 2.6 Database access is account-scoped where required

When the application requires account or tenant isolation, the database session or repository must be scoped to the active account. The access boundary must be explicit and not accidental.

Rules:

- every query that depends on the active account must include the account context at the boundary
- repository methods should accept the active account ID or scoped context as an explicit argument when required
- do not allow a service to silently read data from other accounts
- ensure transaction ownership is unambiguous; a service or repository should declare whether it owns the transaction or receives one from the caller

Illustrative example, extending `AccountService` from §2.3 with an account-scoped read:

```python
class AccountService:
    # ... __init__ as in §2.3 ...

    async def get_account_for_owner(
        self, *, requester_id: UUID, account_id: UUID
    ) -> Account | None:
        account = await self.repo.get_by_id(account_id)
        if account is None or account.owner_id != requester_id:
            return None
        return account
```

The scoping check happens explicitly in the service, using the `owner_id` already carried on the domain object, not by threading a raw `session` through a generic repository call. This prevents cross-account queries hidden behind a generic repository method.

### 2.7 Transactions are explicit and owned by one layer

Transactions must be obvious in code and ownership must be clear.

Rules:

- the service owns the business transaction boundary
- repositories do not manage global transactions in hidden ways
- if a transaction spans multiple repositories, the service starts and commits it
- a transaction must not be started inside a router

`get_db_session()` yields a session without starting a transaction. The service opens one through a transaction manager (illustrative):

```python
class SessionTransactionManager:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @asynccontextmanager
    async def begin(self) -> AsyncIterator[None]:
        async with self.session.begin():
            yield
```

This keeps transaction flow deterministic and testable.

---

## 3. Error handling and API contract

### 3.1 One place maps exceptions to the API contract

`app/core/exception_handlers.py` is the single place that turns exceptions into HTTP error responses. Every error, whether raised by our code or by FastAPI/Starlette, leaves the API as the shared error envelope.

| Raised                                   | Response                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `ApiError(code, message, status_code)`   | `status_code` with `code` and `message` as given                   |
| `RequestValidationError`                 | 422 `validation_error`, with one `details` entry per invalid field |
| `HTTPException` 401                      | `authentication_error`                                             |
| `HTTPException` 403                      | `authorization_error`                                              |
| `HTTPException` 404 (also unknown routes) | `not_found`                                                       |
| `HTTPException` 405                      | `method_not_allowed` (keeps the `Allow` header)                    |
| `HTTPException` 429                      | `rate_limited` (keeps the `Retry-After` header)                    |
| `HTTPException`, any other 4xx           | `bad_request`                                                      |
| `HTTPException`, any 5xx                 | `internal_server_error`                                            |
| any other exception                      | 500 `internal_server_error`; details are logged, never returned    |

Codes are the values of `ErrorCode` in `app/core/errors.py`. Each mapping has a test in `tests/unit/core/test_exception_handlers.py`.

Rules:

- routers raise `ApiError` with an `ErrorCode`; they never build error payloads or return `JSONResponse` for errors
- a router should not wrap calls in `try/except` just to produce an error response
- when a module introduces typed domain errors (`modules/<name>/errors.py`), register a handler for them in `exception_handlers.py` rather than catching them in each router
- infrastructure errors are handled or wrapped before they reach the API layer. For example, `HealthService` turns a database failure into `is_ready() == False`.

### 3.2 Public error model

All errors share one envelope, defined in `app/schemas/common.py`:

```python
class ErrorDetail(ApiSchema):
    field: str | None = None
    code: str = "invalid_value"
    message: str = "Invalid value"


class ErrorBody(ApiSchema):
    code: str
    message: str
    request_id: str
    details: list[ErrorDetail] | None = None


class ErrorEnvelope(ApiSchema):
    error: ErrorBody
```

`code` is a stable, machine-readable `snake_case` value from `ErrorCode` (for example `not_found`, `validation_error`, `service_unavailable`). Raw database exceptions and stack traces are never exposed. `request_id` matches the `X-Request-Id` response header (§4.7).

---

## 4. Configuration, logging, migrations, and async rules

### 4.1 Type hints and async rules

- use type hints everywhere in function signatures and return values. mypy runs with `disallow_untyped_defs` and `check_untyped_defs` over `app/` and `scripts/` (`pnpm typecheck:api`, enforced in CI).
- prefer `AsyncSession`, `AsyncClient`, and `async def` for I/O-bound work
- use synchronous functions for CPU-bound logic and simple deterministic domain logic
- never use `async def` when the function is only doing synchronous local work
- avoid `Any` unless it is a deliberate boundary; use typed protocols and well-defined DTOs instead

### 4.2 Naming rules

Use one generic filename per layer, inside each module's own directory (see the table in §1.3). The directory, not a filename prefix, tells one module's router or service apart from another's:

```text
modules/health/
  router.py       # health endpoints and get_health_service
  schemas.py      # LiveHealth, ReadyHealth
  service.py      # HealthService
  repository.py   # DatabaseProbe, SqlAlchemyDatabaseProbe
```

Do not add a module-name prefix (`health_router.py`, `health_service.py`, ...). It duplicates information the directory already carries. Avoid generic names such as `utils.py` or `helpers.py` inside a business module; they tell the reader nothing about the responsibility.

Operation IDs follow the `<resource>_<action>` rule in [API conventions](architecture/api-conventions.md#operation-ids).

### 4.3 Imports and dependency order

Import ordering (enforced by Ruff's `I` rules):

1. standard library
2. third-party packages
3. absolute application imports (`app.core`, `app.db`, other shared code)
4. relative imports from the same module

Use absolute imports for anything outside the module and relative imports for files inside it. Avoid circular imports. Domain logic must not import FastAPI classes. Modules must not import another module's internals; if two modules need to collaborate, one exposes a service the other depends on through an interface.

Example: `app/modules/health/router.py`:

```python
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.responses import error_responses
from app.core.errors import ApiError, ErrorCode
from app.db.session import get_db_session

from .repository import SqlAlchemyDatabaseProbe
from .schemas import LiveHealth, ReadyHealth
from .service import HealthService
```

### 4.4 Logging

Logging is a cross-cutting concern and should happen at the correct boundary:

- routers log request-level lifecycle events only when useful for observability
- services log business events and decision points
- repositories log persistence-level issues only if they add diagnostic value
- do not log sensitive data such as tokens, passwords, or account secrets

Use a module-level logger and pass values as arguments, not by string concatenation:

```python
logger = logging.getLogger(__name__)

logger.warning("readiness_check_failed", exc_info=True)
```

Every error response is logged once by `exception_handlers.py` with its status, code, and request ID.

### 4.5 Configuration

Configuration is a typed `Settings` object (pydantic-settings) in `app/core/config.py`, read from `MONTELINGO_*` environment variables and cached by `get_settings()`:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MONTELINGO_", case_sensitive=False)

    env: str = Field(default="development")
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/montelingo"
    )
```

Add new settings as typed fields here. Modules depend on `Settings` (through `Depends(get_settings)` at the API boundary), never on `os.environ`.

### 4.6 Migrations and schema evolution

Database schema changes must be managed with migrations and not by ad hoc `CREATE TABLE` scripts.

Rules:

- all schema changes in PostgreSQL must be represented as Alembic migrations in `apps/api/alembic/versions/`
- migrations must be reviewed for constraints, indexes, and data safety
- repository and domain code must assume schema changes are explicit and versioned
- do not create migrations from ORM metadata alone without verifying the generated SQL
- CI applies all migrations to a clean database and runs `pnpm db:check` to catch model/migration drift

Migration discipline:

- add new constraints with backward-compatible migration patterns when possible
- account for indexes and concurrency implications
- include data backfills or validation separately when required

### 4.7 Request IDs

`request_id_middleware` (`app/core/request_id.py`) resolves the request ID once per request. It reuses a safe incoming `X-Request-Id` header or generates a UUID, stores the ID on `request.state.request_id`, and echoes it in the `X-Request-Id` response header. Code that needs the ID calls `get_request_id(request)`, which returns the stored value and never generates a second one.

---

## 5. Test strategy

### 5.1 Layout and fixtures

```text
apps/api/tests/
  conftest.py            # `app` (fresh create_app(), unreachable DB) and `client` fixtures
  contract/              # OpenAPI rules and error-envelope behaviour
  unit/
    core/                # exception mapping, request IDs
    modules/<name>/      # per-module router and service tests
```

Tests use the shared `client` fixture and never import the module-level `app.main.app`. A test module that needs test-only routes overrides the `app` fixture and includes them:

```python
@pytest.fixture
def app(app: FastAPI) -> FastAPI:
    app.include_router(test_only_router)
    return app
```

Demo endpoints are never added to the production router for testing. Pytest runs with `--import-mode=importlib`, so test files in different module folders can share names such as `test_router.py`.

### 5.2 Unit tests

Unit tests verify business behavior in the domain and application layers. They must be fast and must not require a live PostgreSQL instance.

Coverage should include:

- domain invariants and validation rules
- application service orchestration
- authorization decisions
- business exception mapping
- edge cases and failure paths

Example, from `tests/unit/modules/health/test_service.py`:

```python
@pytest.mark.asyncio
async def test_not_ready_when_database_fails() -> None:
    probe = _FakeProbe(error=ConnectionRefusedError("connection refused"))
    assert await HealthService(database=probe).is_ready() is False
```

### 5.3 PostgreSQL integration tests

Integration tests run against PostgreSQL and cover persistence behavior, not a mocked repository. They go in `apps/api/tests/integration/postgres/`, created alongside the first persistence module. The CI `backend` job already provides a migrated PostgreSQL service through `MONTELINGO_DATABASE_URL`.

Required coverage includes:

- repository queries and joins
- database constraints and unique indexes
- migration correctness
- authorization rules under real data access paths
- concurrent updates and locking behavior
- transaction boundaries and rollback correctness

Do not place repository integration tests in the unit layer and do not mock away PostgreSQL behavior when testing persistence or concurrency.

### 5.4 Test principles

- test real behavior, not mock structure
- prefer fake implementations for unit tests when the boundary is important
- use PostgreSQL integration tests for actual SQL, constraints, and transactions
- keep tests deterministic and isolated by account or tenant
- make authorization tests prove the data cannot cross account boundaries

---

## 6. Putting it together: a compliant request flow

`GET /api/v1/health/ready` passes through every layer:

1. `request_id_middleware` resolves the request ID and stores it on `request.state` (§4.7).
2. `app/api/v1/router.py` routes `/health/*` to `app/modules/health/router.py`.
3. FastAPI resolves `get_health_service`, which opens a session with `get_db_session()` and builds `HealthService(database=SqlAlchemyDatabaseProbe(session))` (§2.5).
4. The `ready` endpoint calls `service.is_ready()`. The service calls the probe through the `DatabaseProbe` protocol and turns any failure into `False` (§2.3).
5. On success the router returns `ReadyHealth()`, serialized through `response_model` as `{"status": "ready"}`.
6. On failure the router raises `ApiError(ErrorCode.SERVICE_UNAVAILABLE, ...)`. `exception_handlers.py` turns it into a 503 `ErrorEnvelope` carrying the same request ID (§3).
7. The operation is published as `health_ready` in the OpenAPI schema, so the generated client types both responses (see [ADR 0002](adr/0002-openapi-contract-and-client-generation.md)).

This layout keeps HTTP concerns on the outside, business rules in the service/domain, and persistence in the repository layer, with a single, unambiguous definition of each type.

---

## 7. Summary

The project should behave like a modular monolith, not a loosely organized web app. Every module should have a single responsibility and clear boundaries:

- routers accept and validate transport requests
- services own use cases and transaction scopes
- repositories own queries and persistence
- domain logic owns invariants and business behavior
- interfaces isolate external providers
- database access is explicit and account-aware
- exceptions are mapped centrally to one API contract
- tests separate real domain behavior from PostgreSQL-backed integration guarantees

If a change crosses these boundaries without a clear reason, it is a design smell and should be refactored before it becomes permanent.
