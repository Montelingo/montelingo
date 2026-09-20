# FastAPI modular-monolith boundaries and rules

This repository follows a modular-monolith layout inside a single FastAPI application. The goal is to keep the system cohesive and easy to evolve without turning it into a "god service" or mixing transport, domain, persistence, and infrastructure concerns.

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

### 1.2 Module structure

A typical module should look like this:

```text
apps/api/app/
  api/
    v1/
      routers/
        account_router.py
      deps.py
  modules/
    accounts/
      __init__.py
      domain.py
      service.py
      repository.py
      schemas.py
      models.py
      errors.py
  core/
    config.py
    logging.py
    errors.py
    db/
      session.py
      base.py
  tests/
    unit/
      test_account_domain.py
      test_account_service.py
    integration/
      postgres/
        test_account_repository.py
        test_account_constraints.py
        test_migrations.py
        test_authorization.py
        test_account_concurrency.py
```

If a module grows, split by bounded context, not by technical convenience. A bounded context should own its domain rules and data model.

---

## 2. Hard rules

### 2.1 Routers validate transport concerns only

Routers are responsible for:

- parsing HTTP requests
- verifying request body/params/headers
- converting external errors into the API contract
- delegating work to a service
- returning serialized response schemas

Routers must not:

- execute SQL queries directly
- contain business validation that is not transport-driven
- mutate domain state without a service call
- read global FastAPI state or request-local hidden mutation

Example:

```python
from fastapi import APIRouter, Depends

from app.api.v1.deps import get_current_account
from app.modules.accounts.schemas import CreateAccountRequest, AccountResponse
from app.modules.accounts.service import AccountService

router = APIRouter(prefix="/accounts", tags=["accounts"])

@router.post("", response_model=AccountResponse)
async def create_account(
    payload: CreateAccountRequest,
    account_service: AccountService = Depends(get_account_service),
    current_account: AccountContext = Depends(get_current_account),
):
    return await account_service.create_account(
        owner_id=current_account.id,
        name=payload.name,
        email=payload.email,
    )
```

The router does not make domain decisions. It enriches the external input and passes it to the application service.

### 2.2 Schemas, domain models, and persistence models are separate

The codebase must distinguish among three different representations of data:

- Pydantic API schema: transport contract for requests and responses
- Domain model: business object with invariants and behavior
- SQLAlchemy persistence model: database mapping and storage representation

They are not interchangeable.

Example:

```python
# API schema
class CreateAccountRequest(BaseModel):
    name: str
    email: EmailStr

# Domain model
@dataclass(slots=True)
class Account:
    id: UUID
    owner_id: UUID
    name: str
    email: EmailStr

    @classmethod
    def new(cls, *, owner_id: UUID, name: str, email: EmailStr) -> "Account":
        if not name.strip():
            raise ValueError("Account name cannot be empty")
        return cls(id=uuid4(), owner_id=owner_id, name=name.strip(), email=email)

    def rename(self, new_name: str) -> None:
        if not new_name.strip():
            raise ValueError("Account name cannot be empty")
        self.name = new_name.strip()

# SQLAlchemy model
class AccountORM(Base):
    __tablename__ = "accounts"

    id = mapped_column(UUID, primary_key=True, default=uuid4)
    owner_id = mapped_column(UUID, nullable=False, index=True)
    name = mapped_column(String(255), nullable=False)
    email = mapped_column(String(255), unique=True, nullable=False)
```

Rules:

- Pydantic schemas are not used as domain objects
- ORM models are not returned directly from services or routers
- domain models validate invariant rules independent of HTTP or SQLAlchemy
- conversion between representations happens at module boundaries, never deep inside a router

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

Example:

```python
class AccountRepository(Protocol):
    async def get_by_id(self, account_id: UUID) -> Account | None: ...
    async def save(self, account: Account) -> None: ...

class AuthorizationService(Protocol):
    async def ensure_can_create_account(self, owner_id: UUID) -> None: ...

class AccountService:
    def __init__(
        self,
        repo: AccountRepository,
        tx: TransactionManager,
        authz: AuthorizationService,
    ):
        self.repo = repo
        self.tx = tx
        self.authz = authz

    async def create_account(
        self, *, owner_id: UUID, name: str, email: EmailStr
    ) -> Account:
        await self.authz.ensure_can_create_account(owner_id)
        account = Account.new(owner_id=owner_id, name=name, email=email)
        async with self.tx.begin():
            await self.repo.save(account)
        return account
```

This is the canonical `AccountService` shape used throughout this document — it owns both the transaction boundary and the authorization decision, matching the two responsibilities listed above. Do not introduce a second, differently-shaped constructor for the same service elsewhere; extend this one.

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

Use protocol / interface + implementation pairs. The service depends on the interface, not the concrete provider.

```python
class NotificationClient(Protocol):
    async def send_welcome_email(self, *, user_email: str) -> None: ...

class SendGridNotificationClient:
    async def send_welcome_email(self, *, user_email: str) -> None: ...
```

This keeps vendor-specific code out of the business layer and makes testing easier.

### 2.5 Dependencies are explicit and injected

Do not use FastAPI globals, mutable singleton state, or implicit request context as a business dependency. All dependencies must be provided explicitly via constructor injection or FastAPI `Depends` functions.

Rules:

- pass repositories and clients into services through constructors
- keep `Depends` only at the API boundary
- avoid module-level mutable state for configuration values or per-request data
- never reach into `request.app.state` for domain logic

Example:

```python
def get_account_service(
    session: AsyncSession = Depends(get_db_session),
) -> AccountService:
    repo = SqlAlchemyAccountRepository(session)
    return AccountService(
        repo=repo,
        tx=SessionTransactionManager(session),
        authz=DefaultAuthorizationService(),
    )
```

If a module needs runtime configuration, inject a typed configuration object rather than reading environment variables directly from global state.

### 2.6 Database access is account-scoped where required

When the application requires account or tenant isolation, the database session or repository must be scoped to the active account. The access boundary must be explicit and not accidental.

Rules:

- every query that depends on the active account must include the account context at the boundary
- repository methods should accept the active account ID or scoped context as an explicit argument when required
- do not allow a service to silently read data from other accounts
- ensure transaction ownership is unambiguous; a service or repository should declare whether it owns the transaction or receives one from the caller

Example — extending the canonical `AccountService` from §2.3 with an account-scoped read:

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

The scoping check happens explicitly in the service, using the `owner_id` already carried on the domain object — not by threading a raw `session` through a generic repository call. This prevents cross-account queries hidden behind a generic repository method.

### 2.7 Transactions are explicit and owned by one layer

Transactions must be obvious in code and ownership must be clear.

Rules:

- the service owns the business transaction boundary
- repositories do not manage global transactions in hidden ways
- if a transaction spans multiple repositories, the service starts and commits it
- a transaction must not be started inside a router, except as a thin API boundary if the router is orchestrating a single service call and the service already owns the transaction

Example:

```python
class SessionTransactionManager:
    def __init__(self, session: AsyncSession):
        self.session = session

    @asynccontextmanager
    async def begin(self):
        async with self.session.begin():
            yield
```

This keeps transaction flow deterministic and testable.

---

## 3. Error handling and API contract

### 3.1 One place maps domain and infrastructure exceptions to the API contract

All business exceptions must be translated in a single place. This is usually a shared error mapping module.

Rules:

- domain and service exceptions are typed and specific
- infrastructure errors are wrapped before they reach the API layer
- the HTTP layer translates domain exceptions to the public error contract
- the mapping is centralized to avoid duplicate `try/except` blocks across routers

Example:

```python
class DomainError(Exception):
    pass

class AccountAlreadyExistsError(DomainError):
    pass

class AuthorizationError(DomainError):
    pass

ERROR_MAP = {
    AccountAlreadyExistsError: HTTPException(status_code=409, detail="account.already_exists"),
    AuthorizationError: HTTPException(status_code=403, detail="forbidden"),
}
```

The API response contract should remain stable across modules. A router should not invent ad hoc error payloads for each endpoint.

### 3.2 Public error model

The API contract should use a single standard shape:

```python
class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
```

Where possible, the contract should expose stable machine-readable codes (for example `account.not_found`, `auth.unauthorized`, `validation.failed`) instead of leaking raw database exceptions or stack traces.

---

## 4. Configuration, logging, migrations, and async rules

### 4.1 Type hints and async rules

- use type hints everywhere in function signatures and return values
- prefer `AsyncSession`, `AsyncClient`, and `async def` for I/O-bound work
- use synchronous functions for CPU-bound logic and simple deterministic domain logic
- never use `async def` when the function is only doing synchronous local work
- avoid `Any` unless it is a deliberate boundary; use typed protocols and well-defined DTOs instead

Example:

```python
async def get_account(
    *, account_id: UUID, repo: AccountRepository
) -> Account | None:
    return await repo.get_by_id(account_id)
```

### 4.2 Naming rules

Use consistent names by layer:

- router: `account_router.py`
- schema: `account_schema.py` or `schemas.py` inside the module
- service: `account_service.py`
- repository: `account_repository.py`
- model: `account_model.py` or database-specific naming in the module
- domain: `account.py` or `domain.py` with the entity and invariants

Prefer explicit names over generic names like `utils.py` or `helpers.py` inside a business module.

Example — the `accounts` module:

```text
modules/accounts/
  account_router.py     # or api/v1/routers/account_router.py
  schemas.py             # CreateAccountRequest, AccountResponse
  domain.py               # Account, Account.new(), Account.rename()
  service.py               # AccountService
  repository.py             # AccountRepository, SqlAlchemyAccountRepository
  models.py                  # AccountORM
  errors.py                   # AccountAlreadyExistsError, AuthorizationError
```

```python
# Avoid — generic, tells the reader nothing about the responsibility:
modules/accounts/utils.py
modules/accounts/helpers.py
```

### 4.3 Imports and dependency order

Import ordering should be standardized:

1. standard library
2. third-party packages
3. application domain imports
4. local module imports

Use absolute imports for application modules and avoid circular imports. Domain logic must not import FastAPI classes directly.

Example — `account_router.py`:

```python
# 1. standard library
from uuid import UUID

# 2. third-party packages
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

# 3. application domain imports
from app.modules.accounts.domain import Account
from app.modules.accounts.errors import AccountAlreadyExistsError

# 4. local module imports
from .schemas import CreateAccountRequest, AccountResponse
from .service import AccountService
```

### 4.4 Logging

Logging is a cross-cutting concern and should happen at the correct boundary:

- routers log request-level lifecycle events only when useful for observability
- services log business events and decision points
- repositories log persistence-level issues only if they add diagnostic value
- do not log sensitive data such as tokens, passwords, or account secrets

Example:

```python
logger = logging.getLogger(__name__)

async def create_account(...):
    logger.info("Creating account for owner=%s", owner_id)
```

Prefer structured logging fields over free-form string concatenation, and keep logs actionable.

### 4.5 Configuration

Use a typed configuration object loaded once at startup, not scattered environment access across modules.

```python
@dataclass(frozen=True)
class Settings:
    database_url: str
    app_env: str
    log_level: str
```

Modules should depend on `Settings` or a narrower config interface, not on global environment variables or dynamic mutation.

### 4.6 Migrations and schema evolution

Database schema changes must be managed with migrations and not by ad hoc `CREATE TABLE` scripts.

Rules:

- all schema changes in PostgreSQL must be represented as Alembic migrations
- migrations must be reviewed for constraints, indexes, and data safety
- repository and domain code must assume schema changes are explicit and versioned
- do not create migrations from ORM metadata alone without verifying the generated SQL

Migration discipline:

- add new constraints with backward-compatible migration patterns when possible
- account for indexes and concurrency implications
- include data backfills or validation separately when required

---

## 5. Test strategy

### 5.1 Unit tests

Unit tests verify business behavior in the domain and application layers. They must be fast and should not require a live PostgreSQL instance.

Coverage should include:

- domain invariants and validation rules
- application service orchestration
- authorization decisions
- business exception mapping
- edge cases and failure paths

Example:

```python
def test_account_rename_rejects_blank_name():
    account = Account.new(owner_id=uuid4(), name="Example", email="user@example.com")

    with pytest.raises(ValueError, match="cannot be empty"):
        account.rename("   ")
```

### 5.2 PostgreSQL integration tests

Integration tests are run against PostgreSQL and cover persistence behavior, not a mocked repository.

Required coverage includes:

- repository queries and joins
- database constraints and unique indexes
- migration correctness
- authorization rules under real data access paths
- concurrent updates and locking behavior
- transaction boundaries and rollback correctness

Recommended placement (same tree as §1.2):

```text
apps/api/app/tests/
  unit/
    test_account_domain.py
    test_account_service.py
  integration/
    postgres/
      test_account_repository.py
      test_account_constraints.py
      test_migrations.py
      test_authorization.py
      test_account_concurrency.py
```

Do not place repository integration tests in the unit layer and do not mock away PostgreSQL behavior when testing persistence or concurrency.

### 5.3 Test principles

- test real behavior, not mock structure
- prefer fake implementations for unit tests when the boundary is important
- use PostgreSQL integration tests for actual SQL, constraints, and transactions
- keep tests deterministic and isolated by account or tenant
- make authorization tests prove the data cannot cross account boundaries

---

## 6. Putting it together: a compliant request flow

This section traces one request end to end. The `AccountService` is not redefined here — see §2.3 for the canonical implementation; redefining it a second time is exactly what caused the constructor to drift in an earlier revision of this document.

```python
# app/modules/accounts/repository.py
class SqlAlchemyAccountRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, account_id: UUID) -> Account | None:
        orm = await self.session.get(AccountORM, account_id)
        if orm is None:
            return None
        return Account(id=orm.id, owner_id=orm.owner_id, name=orm.name, email=orm.email)

    async def save(self, account: Account) -> None:
        orm = AccountORM(
            id=account.id,
            owner_id=account.owner_id,
            name=account.name,
            email=str(account.email),
        )
        self.session.add(orm)
```

```python
# app/api/v1/routers/account_router.py
@router.post("/accounts", response_model=AccountResponse)
async def create_account(
    payload: CreateAccountRequest,
    current_account: AccountContext = Depends(get_current_account),
    service: AccountService = Depends(get_account_service),
):
    account = await service.create_account(
        owner_id=current_account.id,
        name=payload.name,
        email=payload.email,
    )
    return AccountResponse.model_validate(account)
```

This layout keeps HTTP concerns on the outside, business rules in the service/domain, and persistence in the repository layer — with a single, unambiguous definition of each type.

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

---

## Revision notes

This revision resolves six cross-referential inconsistencies found in the previous draft:

1. `AccountService` had two different constructors (§2.3 vs §6) — unified into one canonical constructor (`repo`, `tx`, `authz`) in §2.3; §6 now references it instead of redefining it.
2. `Account.new(...)` was called in §2.3 and §6 but never defined — added `owner_id` field and a `new()` classmethod to the `Account` domain model in §2.2.
3. The §2.6 example called `repo.get_by_id(session=session, ...)` against a `AccountRepository` protocol with no `session` parameter, and referenced an undefined `repo` — rewritten as an `AccountService` method using the already-injected repository and the domain object's own `owner_id`.
4. The §6 router example called `service.create_account(...)` without `await` — fixed.
5. Test directory structure differed between §1.2 (`apps/api/app/tests/...`) and §5.2 (`tests/...`) — both now show the same `apps/api/app/tests/unit/` and `apps/api/app/tests/integration/postgres/` tree.
6. §4.2 (naming) and §4.3 (imports) had no code examples, unlike the rest of §4 — added a file-listing example and an import-order example to each.
