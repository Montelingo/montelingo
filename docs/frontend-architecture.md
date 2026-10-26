# Frontend architecture conventions

This document defines how `apps/web` (Next.js 15 App Router, React 19, TypeScript, Tailwind) is organized. It is the frontend counterpart to [FastAPI modular-monolith boundaries and rules](fastapi-modular-monolith.md): features are the frontend equivalent of backend modules, routes are the equivalent of routers, and `@app/api-client` is the only bridge between the two.

Rules marked **(enforced)** fail CI through `pnpm lint:web` or `pnpm typecheck:web`. `pnpm lint:web` runs with `--max-warnings 0`, so lint warnings fail CI too. Everything else is enforced in code review.

## 1. Folder structure

### 1.1 Layout

```text
apps/web/src/
  middleware.ts                     # runs before matched requests; protected-route fast path (§5.4)
  app/                              # routing only: pages, layouts, loading/error/not-found files
    layout.tsx                      # <html>, <body>, and the skip link; no header (§5.4)
    globals.css
    error.tsx
    not-found.tsx                   # renders the site header itself (§5.4)
    (site)/                         # the site's pages, under the site header
      layout.tsx
      page.tsx
      (auth)/
      account/
    (learner)/                      # the learner area: full screen, its own chrome (§8)
      layout.tsx
      loading.tsx
      error.tsx
      not-found.tsx
      play/
        layout.tsx                  # the area's session check (§5.4)
        loading.tsx
        page.tsx                    # the map: every region (§8.2)
        [regionId]/
          page.tsx                  # a region: its locations
          loading.tsx
    api/
      [...path]/
        route.ts                    # same-origin proxy to the API (§5.3); the only route under app/api
    lessons/
      page.tsx
      loading.tsx
      [lessonId]/
        page.tsx
        error.tsx
  features/                         # one folder per feature/domain
    lessons/
      api/
        lessons-api.ts              # typed adapter over @app/api-client
        lessons-api.test.ts
      components/
        LessonCard.tsx
        LessonCard.test.tsx
        LessonList.tsx
        LessonListSkeleton.tsx
      hooks/
        use-answer-input.ts
        use-answer-input.test.ts
      model/
        lesson.ts                   # domain types + pure business logic
        lesson.test.ts
        scoring.ts
        scoring.test.ts
      schemas.ts                    # runtime validation of API data and form input
      errors.ts                     # feature-specific error → message mapping
      index.ts                      # the feature's public API
      server.ts                     # the feature's server-only public API (only if it has server-only code)
      edge.ts                       # the feature's middleware API (only if the middleware needs it)
  components/
    ui/                             # shared, domain-free primitives (TextField, SubmitButton, TileCard)
  hooks/                            # shared, domain-free hooks (use-media-query)
  lib/                              # shared utilities: API clients and proxy (§5.3), cn
```

`lib/` holds domain-free utilities. Most are framework-agnostic, but the API modules are tied to where they run: `api.ts` and `api-config.ts` are server-only (`import "server-only"`, which fails the build if a Client Component imports them), and `browser-api.ts` is browser-only.

### 1.2 Feature folders own their vertical slice

A feature folder (`src/features/<feature>/`) owns everything that exists because of that feature: UI, hooks, schemas, API adapters, domain logic, and tests. When you delete a feature folder, the feature should be gone and nothing else should break except the routes that composed it.

Name features after domain concepts (`lessons`, `vocabulary`, `progress`, `accounts`), not after technical layers (`forms`, `modals`, `tables`).

### 1.3 Shared folders contain only genuinely reusable primitives

Something belongs in `src/components/ui`, `src/hooks`, or `src/lib` only if **all** of these hold:

- it has no knowledge of any domain concept (no lessons, scores, accounts, and no API response types)
- at least two features use it, or it is a design-system primitive (button, input, dialog)
- its props and arguments make sense without reading any feature's code

```tsx
// ✅ src/components/ui/Button.tsx: domain-free primitive
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

// ❌ src/components/ui/LessonButton.tsx: knows about lessons, so it belongs in features/lessons
```

When in doubt, keep the code in the feature. Move it to a shared folder when a second feature actually needs it, not in anticipation.

### 1.4 Dependency direction **(enforced)**

```text
app/  ──▶  features/<x>/index.ts  ──▶  components/ui, hooks, lib, @app/api-client
```

- `app/` may import from features and shared folders.
- A feature may import shared folders and **another feature's public API only** (`@/features/progress`, `@/features/progress/server`, or `@/features/progress/edge`, never `@/features/progress/model/streak`).
- Shared folders (`components/`, `hooks/`, `lib/`) must never import from `features/` or `app/`.
- Inside a feature, use relative imports (`../model/scoring`).

- `src/middleware.ts` follows the rules for `app/`.

ESLint (`no-restricted-imports`) rejects deep imports into another feature (anything under `@/features/<name>/` except `server` and `edge`) and any import from `@/features` in shared folders.

## 2. Routes and pages orchestrate, features decide

`page.tsx` and `layout.tsx` files do only four things:

1. read route params and search params
2. call feature entry points (loaders or adapters) to fetch data
3. compose feature components
4. decide route-level concerns: metadata, `notFound()`, `redirect()`

They contain **no game or domain business logic**: no scoring, no answer checking, no progression rules, no response mapping.

```tsx
// ✅ src/app/lessons/[lessonId]/page.tsx
import { notFound } from "next/navigation";

import { LessonPlayer, getLesson } from "@/features/lessons";

type LessonPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params;
  const lesson = await getLesson(lessonId);

  if (lesson === null) {
    notFound();
  }

  return <LessonPlayer lesson={lesson} />;
}
```

```tsx
// ❌ business logic in the route
export default async function LessonPage({ params }: LessonPageProps) {
  const raw = await unwrap(getApiClient().GET("/api/v1/lessons"));
  const passed = raw.items.filter((item) => item.score >= 0.8).length; // scoring rule in a page
  // ...
}
```

Game and domain rules live in `features/<x>/model/` as **pure functions** (no React, no fetch, no `Date.now()` without injection). Pure functions can be unit-tested exhaustively without rendering anything:

```ts
// src/features/lessons/model/scoring.ts
export type AnswerResult = { correct: boolean; attempts: number };

export function scoreLesson(results: readonly AnswerResult[]): number {
  if (results.length === 0) {
    return 0;
  }
  const firstTry = results.filter((r) => r.correct && r.attempts === 1).length;
  return firstTry / results.length;
}
```

## 3. Components

### 3.1 Presentational components take typed domain props

Presentational components receive **feature domain types** (defined in `model/`), never API response types. The adapter (§5) is the only place where the API shape is converted to the domain shape. As a result, a renamed backend field changes one adapter, not every component.

```tsx
// ✅ src/features/lessons/components/LessonCard.tsx
import type { LessonSummary } from "../model/lesson";

type LessonCardProps = {
  lesson: LessonSummary;
  onStart: (lessonId: string) => void;
};

export function LessonCard({ lesson, onStart }: LessonCardProps) {
  return (
    <article aria-labelledby={`lesson-${lesson.id}-title`}>
      <h2 id={`lesson-${lesson.id}-title`}>{lesson.title}</h2>
      <p>{lesson.wordCount} words</p>
      <button type="button" onClick={() => onStart(lesson.id)}>
        Start lesson
      </button>
    </article>
  );
}
```

```tsx
// ❌ coupled to the wire format
import type { Schemas } from "@app/api-client";

export function LessonCard({
  resource,
}: {
  resource: Schemas["LessonResource"];
}) {
  return <h2>{resource.title.en}</h2>; // knows about snake_case, localization envelope, etc.
}
```

Rules:

- Declare props with a named `type <Component>Props`. Avoid `React.FC`.
- Pass callbacks (`onStart`) instead of having presentational components call adapters or routers.
- Keep components small. If a component needs a comment to explain a section, extract that section.

### 3.2 Server and client component boundaries

Components are **Server Components by default**. Add `"use client"` only when a component needs at least one of:

- state or effects (`useState`, `useReducer`, `useEffect`)
- event handlers (`onClick`, `onChange`, …)
- browser-only APIs (`window`, `localStorage`, `IntersectionObserver`, audio playback)
- a client-only library

Push the boundary as far down the tree as possible. Mark the interactive leaf, not the page:

```tsx
// src/features/lessons/components/LessonPlayer.tsx: server component, renders static content
import { AnswerForm } from "./AnswerForm";

export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  return (
    <section aria-labelledby="lesson-title">
      <h1 id="lesson-title">{lesson.title}</h1>
      <AnswerForm exercises={lesson.exercises} />
    </section>
  );
}
```

```tsx
// src/features/lessons/components/AnswerForm.tsx: client component, owns interaction
"use client";

import { useAnswerInput } from "../hooks/use-answer-input";
// ...
```

Rules:

- Never put `"use client"` on `page.tsx` or `layout.tsx`. If a page needs interactivity, extract a client component. The one exception is `error.tsx`, which Next.js requires to be a client component.
- Props that cross from server to client must be serializable: plain objects, arrays, strings, numbers, booleans, `null`. No class instances, functions, or `Date` objects (pass ISO strings).
- Server-only values (`API_INTERNAL_BASE_URL`, secrets) are read only in server code. Modules that read them start with `import "server-only"`. Client-visible configuration must use the `NEXT_PUBLIC_` prefix.

## 4. Hooks and state

### 4.1 Where state lives

| Kind of state                                  | Where it lives                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Server data (lessons, progress, account)       | Fetched in Server Components via feature adapters, passed down as props |
| Shareable UI state (filters, tab, page cursor) | URL search params, read in the page and passed to the feature           |
| Local interaction state (current answer, open) | `useState` / `useReducer` inside the feature's client component or hook |
| Game session state (current exercise, streak)  | A `useReducer` whose reducer is a pure function in `model/`             |
| Cross-feature client state                     | Avoid. Needs an ADR before introducing a global store or context        |

Do not add a global state library or cross-feature React context without an ADR in `docs/adr/`.

### 4.2 Hooks

- A hook is named `useXxx`, lives in `features/<x>/hooks/use-xxx.ts` (or `src/hooks/` if domain-free), and has a single responsibility.
- Hooks orchestrate React state and call into `model/` for decisions. They do not contain business rules:

```ts
// src/features/lessons/hooks/use-lesson-session.ts
"use client";

import { useReducer } from "react";

import { initialSession, lessonSessionReducer } from "../model/session";
import type { Lesson } from "../model/lesson";

export function useLessonSession(lesson: Lesson) {
  const [state, dispatch] = useReducer(
    lessonSessionReducer,
    lesson,
    initialSession,
  );

  return {
    state,
    submitAnswer: (answer: string) =>
      dispatch({ type: "answer-submitted", answer }),
    skip: () => dispatch({ type: "exercise-skipped" }),
  };
}
```

`lessonSessionReducer` is a pure function in `model/session.ts` and has its own unit tests, so the hook stays thin.

- Hooks never return raw API responses. They return domain types.
- Hooks follow the rules of hooks, and React Compiler-aware checks (no mutating props or state, no reading refs during render, no `setState` directly in an effect) are enforced by `eslint-plugin-react-hooks` **(enforced)**.
- `useEffect` is for synchronizing with external systems (timers, audio, subscriptions). It is never used to derive state from props (compute it during render instead) or to fetch data that a Server Component can fetch.

## 5. Data access

### 5.1 One path to the API

All HTTP access to the FastAPI backend goes through `@app/api-client`: a typed [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) client whose paths, parameters, and response bodies are **generated from the FastAPI OpenAPI schema** by `openapi-typescript` (see [ADR 0002](adr/0002-openapi-contract-and-client-generation.md) and [API conventions](architecture/api-conventions.md)). CI (`pnpm contract:check`) fails if the generated client drifts from the backend.

Components, hooks, and pages never call `fetch` against the API directly and never hand-write API response types.

```text
page.tsx ──▶ features/<x>/api/<x>-api.ts ──▶ @app/api-client (generated) ──▶ FastAPI
                     │
                     └── maps API types → model/ domain types, validates where needed
```

### 5.2 Feature adapters

Each feature has an adapter module in `api/` that:

1. calls the typed client (`getApiClient().GET("/api/v1/...")`) and passes the result to `unwrap()`, which returns the typed success body or throws `ApiClientError`
2. maps the API shape (`snake_case`, localization envelopes, cursors) to the feature's domain type
3. lets `ApiClientError` propagate, or converts expected cases (such as 404 → `null`) into typed results. A feature whose `errors.ts` owns a not-found code may call `notFound()` there instead, as `features/map` does for `content_not_found`

```ts
// src/features/lessons/api/lessons-api.ts
import { ApiClientError, type Schemas, unwrap } from "@app/api-client";

import { getApiClient } from "@/lib/api";
import type { Lesson } from "../model/lesson";

function toLesson(resource: Schemas["LessonResource"]): Lesson {
  return {
    id: resource.id,
    title: resource.title.en,
    wordCount: resource.word_count,
    publishedAt: resource.published_at,
  };
}

export async function getLesson(lessonId: string): Promise<Lesson | null> {
  try {
    const resource = await unwrap(
      getApiClient().GET("/api/v1/lessons/{lesson_id}", {
        params: { path: { lesson_id: lessonId } },
      }),
    );
    return toLesson(resource);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
```

The API contract guarantees every documented JSON response has a precise generated type (a backend contract test enforces it), so adapters do not re-validate API responses. If a response type is ever imprecise, fix the FastAPI response model instead of adding a schema on the frontend.

The exception is `src/features/map`: the map draws and links places from content ids and server-decided states, so its adapters parse every content and progress response with the Zod schemas in `features/map/schemas.ts` before `model/` maps them to domain types. A response that breaks the contract fails there, in one place. Each schema `satisfies` its generated type, so the generated types stay the only response types and the schemas only add what TypeScript cannot check (the slug format, UUIDs, integer bounds).

Use runtime validation (a Zod schema in `schemas.ts`) when data crosses a boundary TypeScript cannot check:

- data comes from `localStorage`, URL params, `postMessage`, or form input

`src/features/auth/schemas.ts` (the sign-in, sign-up, and password-reset forms) is the reference. The schema mirrors the API's request rules so most mistakes are caught before a round trip. A pure function in `model/` runs it and returns `{ ok: true, data }` or `{ ok: false, fieldErrors }`. The API stays authoritative, and `errors.ts` maps its `validation_error` details onto the same fields. Do not duplicate types the generator already provides.

### 5.3 Server-side and browser-side calls

There are two clients, one per runtime. Adapters take the client from one of them and never read `process.env` or build URLs themselves.

| Where the code runs                                          | Client                                                        | How it reaches the API                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Server Components, route handlers (`src/lib/api.ts`)         | `getApiClient()`, or `getApiClient({ forwardCookies: true })` | Directly over the internal network, at `API_INTERNAL_BASE_URL`               |
| Client Components, event handlers (`src/lib/browser-api.ts`) | `getBrowserApiClient()`                                       | The same-origin proxy: `/api/*` on the web origin, which forwards to the API |

Use a **server-side call** to read data while rendering. It is the default (§4.1), and it keeps the round trip on the internal network. Server-side calls are reads only. Pass `forwardCookies: true` when the API must see the signed-in user. The client then sends the incoming request's `Cookie` header to the API.

Use a **browser-side call** for mutations and anything else triggered by the user (sign-in, sign-out, submitting an answer). The browser sends the session cookie itself, the API sees the real `Origin` for its CSRF check ([ADR 0004](adr/0004-session-based-authentication.md)), and every `Set-Cookie` the API returns reaches the browser.

Rules:

- Server-side calls (`getApiClient()`) are reads only (`GET`, `HEAD`). They send no `Origin` or `Referer`, so the API's Origin check (#37) rejects any `POST`, `PUT`, `PATCH`, or `DELETE` from server code, and a `Set-Cookie` the API returns to server code never reaches the browser. They also send no `X-Forwarded-For`, so the API sees the web container's address, not the user's (see [Client IP](#client-ip)).
- Never call `getApiClient({ forwardCookies: true })` inside a cached scope (`unstable_cache`, `"use cache"`). The response depends on the user's cookies, so caching it would serve one user's data to another.
- `src/lib/api.ts` is server-only, so a Client Component cannot import it (the build fails). An adapter that runs in the browser takes its client from `getBrowserApiClient()`.
- A feature exports its server-side adapters (the ones built on `getApiClient()`) from `server.ts`, never from `index.ts` (§7.3).

#### Base URL

`src/lib/api-config.ts` is the only place that knows the API's internal address and the only place that parses it. `getApiInternalBase()` returns its origin and path prefix (used by the proxy), and `getApiInternalBaseUrl()` returns the same value as one URL string (used by `getApiClient()`). Both read `API_INTERNAL_BASE_URL` on every call, so one built image can target any API, and fall back to `http://localhost:8000` for local `pnpm dev`. The parsed value is reused until the variable changes. They throw on a value that is not an absolute `http(s)` URL, or that contains credentials, a query string, or a fragment. `@app/api-client` has no default: `createApiClient()` requires a `baseUrl`, and the browser client passes `window.location.origin`.

#### The same-origin proxy

`src/app/api/[...path]/route.ts` forwards every `/api/*` request on the web origin to `API_INTERNAL_BASE_URL`. The forwarding logic is a pure function, `proxyApiRequest()` in `src/lib/api-proxy.ts`, with unit tests over a mocked `fetch`. `/api/*` on the web origin belongs to the proxy. Do not add other route handlers under `src/app/api/`.

- **Target:** the raw request path and query string are appended to the base URL, so a base path prefix (`http://api:8000/backend`) is kept. Paths that leave `/api/` after decoding (`/api/%2e%2e/…`, `..%2f`, `%5c`) get a local `404 not_found` envelope and never reach the API.
- **Request:** the method, body, query string, and only these headers are forwarded: `Accept`, `Accept-Language`, `Content-Type`, `Cookie`, `Origin`, `Referer` (the API's CSRF fallback when `Origin` is absent), `If-None-Match` and `If-Modified-Since` (so the API can answer `304`), `User-Agent`, and `X-Request-Id`. The proxy sets `X-Forwarded-For` itself, to the one client IP it resolved, or sends none (see [Client IP](#client-ip)). Everything else is dropped, including hop-by-hop headers, `Host`, the client's `X-Forwarded-*` (clients can spoof it), and `Authorization`, because authentication is the session cookie only ([ADR 0004](adr/0004-session-based-authentication.md)). An `X-Request-Id` that does not match the API's format (`^[A-Za-z0-9._:-]{1,128}$`) is replaced with a new UUID.
- **Request body:** bodies are buffered, which suits the API's small JSON payloads, up to 1 MiB (`API_PROXY_MAX_BODY_BYTES`). A larger `Content-Length` gets `413 bad_request` (the code the API uses for `413`) before anything is read. Bodies without one (chunked) are counted as they arrive, and the proxy stops reading and answers `413` as soon as they cross the limit. In both cases the API is never called. A body stream that fails gets `400 bad_request`.
- **Response:** the status, body, every `Set-Cookie` header (one header per cookie), `X-Request-Id`, and the other API headers are returned. Hop-by-hop headers, headers named in `Connection`, and `Content-Encoding`/`Content-Length` are stripped, because `fetch` has already decompressed the body. A `304` is returned with no body, like `204`, `205`, and any `HEAD` response. Redirects are passed through, not followed. A `Location` is resolved against the upstream URL, as the browser would resolve it. If it lands on the API origin, it becomes a web-origin path (with query and fragment), and a path into the API (`<base path>/api/…`) also loses the base path, so the internal host never reaches the browser and the browser stays on the proxy. A `Location` on any other origin, or one that does not parse, is passed through unchanged.
- **Failures:** when the API is unreachable the proxy answers `502`, and when the API's response headers do not arrive within 30 seconds (`API_PROXY_TIMEOUT_MS`) it answers `504`. Both use code `service_unavailable`. The timeout starts after the request body has been read and ends once the headers arrive, so a slow upload is not counted and a response body still streaming back is never cut off. An invalid `API_INTERNAL_BASE_URL` or `TRUSTED_PROXY_HOPS` makes the proxy answer `500 internal_server_error` instead of Next's HTML error page. Every proxy failure uses the shared error envelope and the request's `X-Request-Id`, so `unwrap()` throws `ApiClientError` exactly as it does for API errors. The unreachable, timeout, and misconfiguration failures are logged on the server. A client that disconnects, during the upload or while the response streams, cancels the API call and is not logged.
- Next.js redirects `/api/...` paths with a trailing slash (`308`) before the proxy runs. API routes never end in a slash, so this has no effect.

A route handler is used instead of `rewrites` or middleware because it reads the base URL at runtime, controls which headers cross in each direction, returns the error envelope when the API is down, and can be unit-tested. A middleware rewrite exposes the internal URL in its `x-middleware-rewrite` response header.

#### Client IP

The API's per-IP rate limits (#37) need the user's address, but the API's TCP peer is the web container. The proxy therefore sends the client IP in `X-Forwarded-For`, as exactly one address that replaces whatever the client sent, never appended to it. When it cannot resolve a trustworthy address, it sends no `X-Forwarded-For` at all.

- **Source:** in production, a TLS-terminating edge or load balancer sits in front of the web container and appends the address of its peer to `X-Forwarded-For`. `TRUSTED_PROXY_HOPS` is the number of such proxies: `1` for a single load balancer, `2` for a CDN in front of a load balancer. Each one appends one entry, so the proxy takes the entry `TRUSTED_PROXY_HOPS` positions from the right. Everything to its left was written by the client and is ignored.
- **Parsing:** IPv6 brackets and an IPv4 `:port` are stripped, an IPv4-mapped IPv6 address (`::ffff:203.0.113.7`) becomes IPv4, and IPv6 is written in canonical form, so one client is one rate-limit key. If the header has fewer entries than `TRUSTED_PROXY_HOPS`, or the entry is not a valid IP address, no `X-Forwarded-For` is sent.
- **Configuration:** `getTrustedProxyHops()` in `src/lib/api-config.ts` reads `TRUSTED_PROXY_HOPS` on every call and defaults to `0` when it is unset or blank. Any value other than an integer from 0 to 10 throws, and the proxy answers `500 internal_server_error` as it does for an invalid `API_INTERNAL_BASE_URL`.
- **Deployment requirements:** every trusted proxy must append its peer's address to `X-Forwarded-For`, not pass the client's value through unchanged. nginx's `$proxy_add_x_forwarded_for` appends, and so does AWS ALB in its default `append` mode (not `preserve`). The web container must be reachable only through that edge. A request that reaches it directly can plant any address at the trusted position.
- **API side:** the API (#37) trusts `X-Forwarded-For` only on connections from the web container's address, so a client that reaches the API directly cannot set it either.
- **Local development:** `pnpm dev` and Docker Compose have no edge and use `0`. The proxy sends no `X-Forwarded-For`, the API sees the web server's address, and all local requests share one rate-limit bucket. That is expected.

The proxy cannot use the socket address instead. Before a route handler runs, Next.js fills in a missing `X-Forwarded-For` with the TCP peer's address (`req.headers['x-forwarded-for'] ??= socket.remoteAddress`), and the handler only sees the resulting header. It cannot tell that value from one the client sent, so with no trusted proxy in front there is no address the proxy can vouch for.

### 5.4 Authentication

Authentication is the API's session cookie, `montelingo_session` by default ([ADR 0004](adr/0004-session-based-authentication.md)). It is HttpOnly, so only the API sets and clears it. The web app never reads its value: it checks that the browser sent it and forwards it to `GET /api/v1/auth/me` to learn who is signed in. `src/features/auth` owns all of it.

#### The cookie name

The API lets `MONTELINGO_SESSION_COOKIE_NAME` rename the cookie (`session_cookie_name` in `apps/api/app/core/config.py`). The web app reads the same variable, with the same default, through `getSessionCookieName()`, at runtime on every call. It is not a `NEXT_PUBLIC_` variable, so the build does not inline it, and the middleware sees the running server's environment. Set it for both apps or for neither: in Docker Compose both read the shared `.env`. If only the API had it, the middleware would never find the session and every protected page would loop back to sign-in. `session-cookie.test.ts` checks that the web default matches the API's default and variable name.

#### Reading the current user on the server

Two server-only functions from `@/features/auth/server` answer "who is signed in?". Both are wrapped in React `cache()` and share one `/auth/me` call per request, so the header and a page can each ask. The call skips the API when there is no session cookie and gives up after `CURRENT_USER_TIMEOUT_MS` (3 seconds).

| Function           | Signed in     | Signed out (no cookie, or `401`) | Lookup failed (API error, unreachable, timeout) | Use it for                                                                               |
| ------------------ | ------------- | -------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `getCurrentUser()` | `CurrentUser` | `null`                           | throws to the route's `error.tsx`               | Protected pages: a failure must not look like "signed out"                               |
| `getAuthState()`   | `signed-in`   | `signed-out`                     | `{ status: "unavailable" }`, logged once        | UI that must render anyway (the site header), and pages where unknown means "signed out" |

A lookup only happens when the browser sent a session cookie, so `unavailable` always means "there is a cookie the API could not check".

- **The site header** (`SiteHeader`, in `(site)/layout.tsx` and the root `not-found.tsx`) renders its shell and brand at once. Only the account controls wait for `getAuthState()`, inside their own `<Suspense>` boundary with a same-size placeholder, so a slow API never holds the page and nothing shifts when they arrive. Signed out, the controls are "Sign in" and "Sign up". Signed in, they are the email (linking to `/account`) and "Sign out". When the lookup fails they are "Sign out" alone: "Sign in" would tell a signed-in user they are signed out (and could leave a live session behind on a shared device), and the email is not verified.
- **Sign-in and sign-up** use `getAuthState()` and treat `unavailable` as signed out, so a visitor with a stale cookie still gets the form. If the API is down, submitting the form says so. Sign-in with a known notice (`?notice=password-updated`) skips the check and shows the form even to a signed-in user (§12).
- **Protected pages** use `getCurrentUser()`. A failed lookup reaches the error boundary, which offers a retry. Treating it as signed out would send a signed-in user to sign in.

`getAuthState()` logs a failure with `console.error("auth_current_user_unavailable reason=… request_id=…")`, where the reason is `status_<code>`, `unreachable`, `timeout`, or `unexpected`. It lets Next.js's own control-flow errors through (`unstable_rethrow`), such as the one `cookies()` throws to mark a route dynamic.

#### Every page is rendered per request

**Every route is dynamic.** The site's pages (in `src/app/(site)/`) and the 404 page render the header, which reads the request's cookies; the learner area (`src/app/(learner)/play/`) checks the session in its layout. Do not use `export const dynamic = "force-static"`, `revalidate` (ISR), or other static rendering on a page: the header, or the learner area's sign-in check, would be rendered once, for nobody, and served to everyone. A new route group outside both must decide this for itself, and is dynamic as soon as anything in it reads cookies or headers. The cost is one `/auth/me` call per page view from a browser with a session cookie (none without one), shared by the header or layout and the page.

#### Reading the current user on the client

Client Components do not fetch the user. A Server Component reads it and passes `CurrentUser` (or the fields needed) down as props. It is serializable, with `createdAt` as an ISO string. There is no client-side user context (§4.1). After a mutation that changes who is signed in, the page must render again on the server: `SignInForm` calls `router.replace()` then `router.refresh()`, `SignOutButton` loads the home page afresh (see below), and `ResetPasswordForm`, whose reset revoked every session, loads the sign-in page afresh (§12). Layouts do not re-render on client navigation, so the header (in `(site)/layout.tsx`) changes only on a refresh or a full load.

#### Protecting a page

Protection has two layers, and a protected page needs both:

1. **Middleware (fast path).** `src/middleware.ts` sends a request without a session cookie to `/sign-in?next=<path and query>` with a `307`. Its decision is the pure function `signInRedirectFor()` in `src/features/auth/model/protected-routes.ts`, with unit tests. It only checks that the cookie is there, because the middleware cannot afford an API call per request, so a stale (expired or revoked) cookie gets through.
2. **The page (authoritative).** The page calls `getCurrentUser()` and redirects on `null`, using `signInHref()` so the destination is checked like every other `next`. Because the page streams (it has a `loading.tsx`), this redirect is not a `307`: the response is a `200` whose HTML carries a `<meta http-equiv="refresh">` to the sign-in page, and client-side navigations follow the redirect in the RSC payload.

To protect a new section:

1. Add its path to `PROTECTED_PATH_PREFIXES` in `src/features/auth/model/protected-routes.ts`. A prefix covers the path and everything under it (`/account`, `/account/email`), not lookalikes (`/accounting`). This list is the single source of truth.
2. Add the same path as `<path>/:path*` to `config.matcher` in `src/middleware.ts`. Next.js reads the matcher at build time, so it must be a literal. `middleware.test.ts` fails when it and the list disagree.
3. In each page, check the session itself. `src/app/(site)/account/page.tsx` is the reference (or, for a whole section, its layout; see below):

```tsx
import { redirect } from "next/navigation";

import { ACCOUNT_PATH, AccountOverview, signInHref } from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (user === null) {
    redirect(signInHref(ACCOUNT_PATH));
  }

  return <AccountOverview user={user} />;
}
```

4. Give the segment an `error.tsx` (with a retry) and a `loading.tsx` (§9), and its `<main>` the `id="main-content"` the skip link targets (§8).

##### Protecting a whole section from a layout

The learner area checks the session once, for everything under `/play`, in `src/app/(learner)/play/layout.tsx` rather than in each page:

- **One level below the group's layout.** An `error.tsx` never catches errors thrown by the layout of its own segment, and the root has no error boundary. With the check in `play/layout.tsx`, a failed lookup reaches `(learner)/error.tsx` and the wait shows `(learner)/loading.tsx` (a neutral skeleton, §9.2), both inside the learner chrome. `(learner)/layout.tsx` itself is chrome only and loads no data.
- **The requested path comes from the middleware.** A layout is not told its URL, so the middleware hands every request it lets through its path and query string in the `x-montelingo-path` request header (`REQUESTED_PATH_HEADER`, set with `withRequestedPath()` through `NextResponse.next({ request: { headers } })`). It always overwrites the header, so on the paths it runs for a client cannot set it, and it is sent upstream only, never to the browser. The layout passes it through `requestedPathWithin(PLAY_PATH, …)`, which accepts only a safe path inside `/play` and otherwise returns `/play`, then redirects to `signInHref()` of the result. It decides "inside" with `isPathWithin()` (`model/url-path.ts`), the same decoding check `isProtectedPath()` uses, so every path the middleware protects as part of `/play` (`/%70lay/kotor`, which the router reads as `/play/kotor`) returns there too. A stale cookie on `/play/kotor?step=2` returns there after signing in, like the middleware's own redirect.
- **Full loads only.** Layouts do not run again on client-side navigation between pages under them, so the layout is the gate when a learner page is loaded or refreshed, not on every navigation. The learner pages' data (#67, #68) comes from server adapters that send the session cookie, and they must treat a `401` as signed out, never as data. The map's loaders do: a `401` from any of their calls redirects to `signInHref()` of the loader's own screen (`redirectOnSignedOut()` in `features/map/errors.ts`), so a session that ends mid-visit returns there after signing in.

The middleware imports from `@/features/auth/edge`, never `@/features/auth`. It runs in the Edge runtime before every matched request, and the main entry would pull the API client and the forms into its bundle. `edge.ts` exports only pure functions and constants. `edge.test.ts` follows its imports and fails if any of them reaches `server-only`, `next/headers`, `@/lib/api`, `@/lib/api-config`, `@/lib/browser-api`, or `@app/api-client`.

#### Signing out

`SignOutButton` calls `signOut()` from the browser. A session that has already expired (`401`) counts as signed out. On success it loads the home page as a new document with `location.replace("/")` (`replaceDocument()` in `src/lib/navigation.ts`) rather than `router.replace()` and `router.refresh()`:

- it drops all of the signed-in user's client state, including the router cache, which would otherwise serve protected pages on Back, and the replaced history entry keeps Back off the page the user signed out from;
- the button cannot be left stuck on "Signing out…" by a soft refresh that fails;
- focus starts over at the top of the new page, where the first Tab reaches "Skip to content", instead of falling to `<body>` when the button disappears.

Any other failure (`403`, `5xx`, network) leaves it unknown whether the session ended: the API may have revoked it and the response got lost. The button says "We couldn’t confirm you were signed out. Try again." and stays put. A retry on a session that did end gets `401`, which succeeds. While the call is in flight the button is `aria-disabled` (still focusable) and ignores further clicks.

## 6. TypeScript

### 6.1 Compiler settings **(enforced)**

`apps/web/tsconfig.json` runs with `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noFallthroughCasesInSwitch`. `pnpm typecheck:web` runs in CI.

### 6.2 Escape hatches **(enforced)**

| Rule                                                        | What it forbids                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any`                        | `any` in annotations                                                      |
| `@typescript-eslint/no-unsafe-*` (recommended-type-checked) | using values typed `any` (assign, call, member access, return)            |
| `@typescript-eslint/ban-ts-comment`                         | `@ts-ignore`, `@ts-nocheck`, and `@ts-expect-error` without a description |
| `@typescript-eslint/no-non-null-assertion`                  | `value!`                                                                  |
| `@typescript-eslint/consistent-type-assertions`             | `{ ... } as Foo` object-literal assertions and `<Foo>x` syntax            |
| `reportUnusedDisableDirectives`                             | stale `eslint-disable` comments                                           |

When an escape hatch is genuinely required, suppress one line with an explanation after `--`:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party typings for audio-lib declare `any` for callbacks
```

```ts
// @ts-expect-error -- audio-lib@2 types omit `playbackRate`; remove after upgrading to audio-lib@3
player.playbackRate = 0.75;
```

A suppression without a reason is rejected in review. Prefer these alternatives:

- `unknown` plus narrowing (`typeof`, `in`, `instanceof`, or a Zod `parse`) instead of `any`
- `satisfies` instead of `as` when you want checking without widening:

```ts
const levels = { a1: "Beginner", a2: "Elementary" } satisfies Record<
  string,
  string
>;
```

- an explicit `if (x === undefined) throw …` or early return instead of `x!`

`as` on values returned by `JSON.parse`, `response.json()`, or storage reads is an unsafe assertion. Validate the value with a schema instead (§5.2).

### 6.3 Types

- Prefer `type` aliases for props and domain shapes. Use `interface` only when declaration merging is needed.
- Use discriminated unions for states and actions (`{ status: "loading" } | { status: "ready"; lesson: Lesson }`) instead of optional-field bags.
- Mark data that should not be mutated as `readonly` / `ReadonlyArray`.

## 7. Naming, imports, and exports

### 7.1 Naming

| Thing                          | Convention                                                         | Example                                              |
| ------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------- |
| Component file and component   | `PascalCase.tsx`                                                   | `LessonCard.tsx` → `export function LessonCard`      |
| Hook file and hook             | `use-kebab-case.ts`, `useCamelCase`                                | `use-lesson-session.ts` → `useLessonSession`         |
| Other modules                  | `kebab-case.ts`                                                    | `lessons-api.ts`, `scoring.ts`                       |
| Tests                          | same name + `.test.ts(x)`                                          | `LessonCard.test.tsx`                                |
| Feature folders                | `kebab-case`, domain noun                                          | `features/lessons`, `features/word-review`           |
| Types                          | `PascalCase`                                                       | `Lesson`, `LessonCardProps`                          |
| Constants                      | `camelCase`, or `UPPER_SNAKE_CASE` for true module-level constants | `MAX_ATTEMPTS`                                       |
| Event-handler props / handlers | `onX` props, `handleX` functions                                   | `onStart`, `handleSubmit`                            |
| Booleans                       | `is`/`has`/`can`/`should` prefix                                   | `isCorrect`, `hasFinished`                           |
| Next.js special files          | framework names                                                    | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` |

### 7.2 Imports **(partially enforced)**

- Use the `@/` alias (maps to `apps/web/src/`) for anything outside the current feature. Use relative imports inside a feature.
- Use `import type` for type-only imports (enforced by `consistent-type-imports`).
- Order imports in three groups separated by a blank line:

```ts
// 1. external packages and workspace packages
import { notFound } from "next/navigation";
import { ApiClientError } from "@app/api-client";

// 2. app-level absolute imports
import { Button } from "@/components/ui/Button";
import { LessonCard } from "@/features/lessons";

// 3. relative imports within the feature
import { scoreLesson } from "../model/scoring";
```

### 7.3 Exports

- Use **named exports** everywhere. Default exports are used only where Next.js requires them (`page`, `layout`, `loading`, `error`, `global-error`, `not-found`, `template`, `default`) and in config files (`next.config.ts`, `vitest.config.ts`, `tailwind.config.ts`).
- Each feature has one `index.ts` that re-exports its public API: the components routes compose, loaders/adapters routes call, and domain types other features need. Everything not exported from `index.ts` (or `server.ts`, below) is private to the feature.
- `src/middleware.ts` imports a feature through its `edge.ts`: pure functions and constants that are safe in the Edge runtime, with no API client, React components, or `server-only` code. Add one only when the middleware needs something from the feature (§5.4).
- `index.ts` must be safe to import from a Client Component. Anything that is server-only (it imports `server-only`, `next/headers`, or `@/lib/api`) is exported from the feature's `server.ts` instead, which starts with `import "server-only"`. Routes import it as `@/features/<name>/server`. Next.js fails the client build as soon as `server-only` is anywhere in a Client Component's import graph. Tree-shaking runs too late to remove it, so a single server-only re-export in `index.ts` would break every Client Component that imports the feature.
- `apps/web/package.json` declares `"sideEffects": ["*.css"]`, so the bundler drops whatever a Client Component does not use from a feature's `index.ts`. A button that imports only `signOut` from `@/features/auth` does not ship `zod` or the form schemas. As a result, a module must never rely on being imported for its side effects, except stylesheets and packages such as `server-only`. Because a re-export can be skipped, every module that is server-only starts with `import "server-only"` itself, not only the `server.ts` that re-exports it.
- Do not add `index.ts` barrels inside a feature's subfolders or in `components/ui`. Import primitives by file path.

```ts
// src/features/lessons/index.ts
export { LessonList } from "./components/LessonList";
export { LessonPlayer } from "./components/LessonPlayer";
export { getLesson, listLessons } from "./api/lessons-api";
export type { Lesson, LessonSummary } from "./model/lesson";
```

## 8. Styling

- Style with Tailwind utility classes in the component's `className`.
- `src/app/globals.css` holds only Tailwind directives, base element styles, and design tokens (CSS custom properties). Feature styles never go there.
- Design tokens (colors, spacing, radii beyond Tailwind defaults) are added to `tailwind.config.ts` `theme.extend`, not hard-coded as arbitrary values (`bg-[#1e40af]`) in components.
- Inline `style={{}}` is only for values computed at runtime (such as a progress bar width).
- Compose conditional classes with a `cn()` helper in `src/lib/cn.ts` rather than string concatenation.
- Shared primitives expose variants through props (`variant="primary"`), not by accepting arbitrary `className` overrides for their core look. `className` is accepted for layout (margin, width) only.
- Static accessibility rules (`alt` text, labelled controls, keyboard support for click handlers, valid ARIA) are enforced by `eslint-plugin-jsx-a11y` **(enforced)**. `vitest-axe` checks the rendered DOM (roles, accessible names, landmarks, ARIA) in component tests. It cannot check contrast, because jsdom does not apply styles, so contrast is checked in review.
- Every page's `<main>` has `id="main-content"`, the target of the root layout's "Skip to content" link. Route groups with a shared layout set it there (`(auth)/layout.tsx`, `account/layout.tsx`, and `LearnerShell` for `(learner)/layout.tsx`).
- Styling must not remove accessibility affordances: never `outline-none` without a visible `focus-visible:` replacement. Text must meet WCAG AA contrast.
- Pick state-dependent classes from a static map of full class names (`TileCard`'s `STATE_STYLES`), never by building them from strings (`` `border-tile-${state}-edge` ``): Tailwind only generates classes it finds written out in the source.

### 8.1 Tokens

`tailwind.config.ts` holds a small semantic set. Its header comment lists the text pairs that meet WCAG AA, so a new pairing is checked before it is used.

| Token                                                            | Use                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ink`, `ink-muted`, `surface`, `surface-muted`, `surface-sunken` | Text, card and page surfaces, skeleton blocks                                                  |
| `focus`, `action`, `action-hover`, `action-ink`                  | Focus outlines; primary buttons and button-like links                                          |
| `tile-<state>-edge`, `-badge`, `-ink`                            | `TileCard`: the card's edge, and the badge's background and text, per state                    |
| `next`, `next-edge`, `next-ink`                                  | The "next place to go" ribbon and edge                                                         |
| `art-<1…8>-bg`, `-pattern`, `-ink`                               | `PlaceholderArt` palettes                                                                      |
| `touch` (3rem), `touch-lg` (3.5rem)                              | Touch targets, as `size-`, `min-h-`, `min-w-`, and spacing                                     |
| `gutter`, `safe-t`, `safe-r`, `safe-b`, `safe-l`                 | The learner gutter, and padding that is the gutter or the safe-area inset, whichever is larger |
| `max-w-learner`, `rounded-tile`, `rounded-badge`, `aspect-tile`  | The learner content width, card and badge radii, the card picture's shape                      |
| `grid-cols-tiles`                                                | `CardGrid`'s columns (the column math is in a comment next to it)                              |
| `animate-wiggle`, `animate-locked-flash`                         | A locked card's answer to a tap, with and without motion                                       |

There are no custom font sizes. `cn()` uses a `tailwind-merge` configured with the custom names that could conflict with Tailwind's own (spacing, padding, radii, animations, aspect ratio, maximum width), so a later `p-4` still replaces `p-gutter`. Add a new non-colour token there too.

### 8.2 The learner area

The learner area (`src/app/(learner)/`, today `/play`) is tablet-first and full screen. The smallest supported device is the iPad mini 6, 744 × 1133 CSS px, in portrait and landscape.

- **No site header.** `(learner)/layout.tsx` renders `LearnerShell` (`src/features/learner`): a bar with a large Back and Home control (each `size-touch-lg`, 56 px), then the `<main>`. Home goes to the map (`/play`) and is `aria-current="page"` there. Back goes one level up the URL (a place to its region, a region to the map), not back through the browser history, and from the map leads out to `/`, where adults find their account.
- **Safe areas.** The layout exports `viewport = { viewportFit: "cover" }` (Next.js merges it with its default `width=device-width, initial-scale=1`; never limit zoom), so `env(safe-area-inset-*)` is non-zero on devices with a notch or rounded corners, and the shell pads itself with the `safe-*` padding tokens. The viewport meta tag follows client-side navigation in and out of the area.
- **Height and scrolling.** `<body>` is at least `100dvh` (`100vh` where `dvh` is unsupported) and a flex column; the shell and its `<main>` grow to fill it. Pages scroll vertically only.
- **Breakpoints.** Tailwind's `md` (768 px) is wider than the portrait tablet, so learner layouts do not rely on `md` for tablets; `CardGrid` sizes its columns from the container instead.
- **Screens.** `/play` is the map (`MapHome`: every region, `RegionPicker`) and `/play/<region>` a region (`RegionScreen`: its locations, `LocationPicker`, with the next place marked), both from `src/features/map`. Locked regions and places stay on screen. Every open card is a real link, so Back, reload, and deep links work. Opening a locked region by URL redirects to `/play?notice=region-locked`, and a locked place to its region with `?notice=location-locked`; the screen shows the notice (`MAP_NOTICES`, known keys only, like the sign-in notice) in a calm, neutral `ScreenNotice` that a polite status region announces after mount. An unknown region renders `(learner)/not-found.tsx`. On the map and a region's screen, only `locked` sends the learner back: when progress failed (`error`) or does not cover a place (`loading`), the screen still renders, since its cards are unopenable and reveal nothing, and adds a "Try again" that refreshes the route (`needsProgressRetry()`). The notice stays mounted across the refresh, so a retry that finishes with progress still missing says "Still not loaded. Try again in a moment.", shown and announced anew each time. A place shows its words, so its gate is stricter: only the server opens a place (ADR 0005), and it renders only when the place and its region are both open (`available`, `in-progress`, `completed`, or `active`, `isOpenState()`). A state that is not known (`loading` or `error`) sends the learner to the region without a notice, since its screen already says progress did not load and offers the retry. The rules live in pure functions in `model/screens.ts` (`lockedRegionRedirect()` and `closedLocationRedirect()`), applied by the server-only loaders: `loadRegionScreen()` redirects a locked region itself, and the place gate `assertLocationOpen()` (`@/features/map/server`), which the place page (#68) calls before rendering, redirects a place that is not open. `RegionPicker` and `LocationPicker` are only the grid: they take the items (`id`, `state`, `name`, `href`, and `isNext` for places) and an optional `onRegionSelect` / `onLocationSelect`, and import only the map contract's types, so the SVG map can replace them. The server screens pass no callback, since a function cannot cross into a Client Component.
- **Cards.** `TileCard` is the tappable card (seven states, each with an icon and a label as well as a colour; locked, loading, and error cards stay focusable with `aria-disabled`; one card can carry the "next place" ribbon), `CardGrid` lays out 3 to 10 of them without sideways scrolling, and `PlaceholderArt` draws a stand-in picture from an ID. All three are in `src/components/ui/` and take their copy from props, so the features that use them (#65, #67, #68) supply the words.

```tsx
<button
  type="button"
  className={cn(
    "rounded-lg px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2",
    isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-900",
  )}
>
```

## 9. Errors and loading states

### 9.1 Error boundaries

| Failure                                                     | Handled by                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource does not exist                                     | Adapter returns `null` → page calls `notFound()` → nearest `not-found.tsx` (the map adapters call `notFound()` through `errors.ts` themselves) |
| Unexpected error while rendering a route                    | Nearest `error.tsx` in the route segment                                                                                                       |
| Error in the root layout                                    | `src/app/global-error.tsx`                                                                                                                     |
| Expected, recoverable user error (wrong answer, validation) | Handled in the feature as state. Not thrown                                                                                                    |
| Failed mutation from a client component                     | Caught in the feature hook, exposed as `{ status: "error", message }`                                                                          |

Every route segment that fetches data has an `error.tsx` (or inherits one from its parent). The learner area's boundaries sit in the route group, inside its chrome: `(learner)/error.tsx` (a calm "This page didn’t open." that puts the problem on our side, never on the learner or their device, with a large "Try again"), `(learner)/loading.tsx` (§9.2), and `(learner)/not-found.tsx` (for `notFound()` inside the area, with a link back to the map). A URL that matches no route at all gets the root `not-found.tsx`, with the site header. Error boundaries show a human message and a retry action. They never show `error.message` from the server verbatim:

```tsx
// src/app/lessons/[lessonId]/error.tsx
"use client";

import { Button } from "@/components/ui/Button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function LessonError({ reset }: ErrorPageProps) {
  return (
    <div role="alert">
      <h1>We couldn’t load this lesson.</h1>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

`ApiClientError.error.code` (from the shared error envelope) is mapped to user-facing copy in the feature's `errors.ts`. Components switch on `code`, never on `message`. `ApiClientError.headers` holds the error response's headers, for protocol details such as `Retry-After`; read it with `parseRetryAfter()` from `src/lib/retry-after.ts`. When `fetch` itself fails (the API or network is unreachable), the client throws `ApiNetworkError` instead, with the original error as `cause`. Any other error, such as a `TypeError` while mapping a response, is a bug and is not reported to the user as a connection problem. An abort is rethrown unchanged. `src/features/auth/errors.ts` is the reference: `toAuthFormError()` returns a serializable `{ code, formError, fieldErrors, retryAfterSeconds, requestId }`, and the API's `validation_error` details become field errors written in our own copy, never the API's `message`.

### 9.2 Loading states

- Each data-fetching route segment has a `loading.tsx` that renders a skeleton with the same layout as the loaded page, to avoid layout shift. `play/loading.tsx` mirrors the map (`MapHomeSkeleton`) and `play/[regionId]/loading.tsx` a region (`RegionScreenSkeleton`): the heading and its line in the same text sizes, then blocks the size of a `TileCard` (its edge, picture ratio, and text area) laid out with `CardGrid`'s own `CARD_GRID_CLASS`. The place page (#68) adds one in its own segment that matches it.
- `(learner)/loading.tsx` is the exception: it covers the session check in `play/layout.tsx`, before any page's own `loading.tsx` can show, so it is the neutral `LearnerPageSkeleton` (a heading and a body) rather than any one page's shape. A page-shaped skeleton there would flash on every page in the area.
- Skeletons are plain `aria-hidden` blocks, never disabled copies of the real controls: a skeleton of `TileCard`s would put focusable cards in the tab order.
- Wrap independently slow sections in `<Suspense fallback={<XSkeleton />}>` so the rest of the page can stream.
- Skeletons live in the feature next to the component they stand in for (`LessonListSkeleton.tsx`).
- Loading UI is announced to assistive technology: the region uses `aria-busy="true"`, or a visually hidden status element with `role="status"`.
- Client-side pending states (submitting an answer) disable the triggering control and show progress. They do not unmount the form.

## 10. Tests

### 10.1 Placement

Tests are **co-located** with the file they test, named `<file>.test.ts` or `<file>.test.tsx`. Vitest picks up `src/**/*.test.{ts,tsx}`. `.tsx` tests run in `jsdom`. `.ts` tests run in `node`.

| What                                | Kind of test                                                                                      | Example                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `model/` pure functions, reducers   | Unit (node), exhaustive edge cases                                                                | `scoring.test.ts`            |
| `api/` adapters                     | Unit, with `@/lib/api` mocked to return `createApiClient({ baseUrl, fetch })` over a fake `fetch` | `lessons-api.test.ts`        |
| Shared `lib/` utilities             | Unit (node), with `fetch` and `next/headers` injected or mocked                                   | `api-proxy.test.ts`          |
| Hooks with logic                    | `renderHook` (jsdom)                                                                              | `use-lesson-session.test.ts` |
| Components                          | Behavior + accessibility (jsdom)                                                                  | `LessonCard.test.tsx`        |
| Full user journeys across the stack | End-to-end in `tests/e2e/`                                                                        | `tests/e2e/smoke.sh`         |

### 10.2 Component tests cover behavior and accessibility

Component tests use Testing Library and `vitest-axe`. `apps/web/vitest.setup.ts` registers the `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveTextContent`, …) and the `vitest-axe` matcher (`toHaveNoViolations`), and unmounts rendered trees after each test. Vitest globals are off, so import `describe`, `it`, `expect`, and `vi` from `vitest`. `src/features/health/components/ApiHealthCard.test.tsx` is the reference example. Component tests:

- query the way a user perceives the page: `getByRole`, `getByLabelText`, `getByText`. Use `getByTestId` only when no accessible query exists.
- interact through `userEvent`, not by calling props or setting state
- assert on what the user sees or on callbacks the component promises to call
- run an axe check on each meaningful state

They do **not** assert on internal state, hook calls, CSS class names, component instance methods, or snapshot the whole DOM.

```tsx
// src/features/lessons/components/LessonCard.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { LessonCard } from "./LessonCard";

const lesson = {
  id: "l-1",
  title: "Greetings",
  wordCount: 12,
  publishedAt: "2026-09-01T00:00:00Z",
};

describe("LessonCard", () => {
  it("starts the lesson when the user clicks start", async () => {
    const onStart = vi.fn();
    render(<LessonCard lesson={lesson} onStart={onStart} />);

    await userEvent.click(screen.getByRole("button", { name: "Start lesson" }));

    expect(onStart).toHaveBeenCalledWith("l-1");
  });

  it("exposes the lesson as a labelled article", () => {
    render(<LessonCard lesson={lesson} onStart={vi.fn()} />);

    expect(
      screen.getByRole("article", { name: "Greetings" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <LessonCard lesson={lesson} onStart={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
```

```tsx
// ❌ implementation details
expect(container.querySelector(".bg-emerald-600")).not.toBeNull();
expect(useLessonSessionSpy).toHaveBeenCalled();
expect(container).toMatchSnapshot();
```

### 10.3 Test principles

- Test domain rules in `model/` without React. They are the most valuable and cheapest tests.
- Mock at the adapter or generated-client boundary, never `fetch` inside components.
- Build test data with small factory functions per feature (`makeLesson({ title: "…" })`), not shared giant fixtures.
- Tests are deterministic: inject time and randomness (for example exercise shuffling) into `model/` functions.

## 11. Enforcement summary

| Convention                                                           | Mechanism                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Strict compiler options                                              | `tsconfig.json` → `pnpm typecheck:web`                         |
| No `any`, unsafe `any` usage, `!`, object-literal `as`, bare `@ts-*` | `eslint.config.mjs` → `pnpm lint:web`                          |
| Type-only imports                                                    | `consistent-type-imports` → `pnpm lint:web`                    |
| No deep imports into other features                                  | `no-restricted-imports` → `pnpm lint:web`                      |
| Shared folders don't import features                                 | `no-restricted-imports` (scoped override) → `pnpm lint:web`    |
| Rules of hooks, React Compiler-safe patterns                         | `eslint-plugin-react-hooks` (recommended) → `pnpm lint:web`    |
| Static JSX accessibility checks                                      | `eslint-plugin-jsx-a11y` (recommended) → `pnpm lint:web`       |
| Next.js best practices (`next/link`, `next/image`, `next/script`)    | `@next/eslint-plugin-next` (core-web-vitals) → `pnpm lint:web` |
| No axe violations in rendered components                             | `vitest-axe` in component tests → `pnpm test:web`              |
| Generated client matches FastAPI                                     | `pnpm contract:check`                                          |
| Formatting                                                           | Prettier → `pnpm format:check:web`                             |
| Page thinness, prop typing, `"use client"` placement, test style     | Code review against this document                              |

## 12. Current state and known gaps

`src/features/health` is the reference implementation of these conventions: a thin `app/(site)/page.tsx`, an adapter that calls `GET /api/v1/health/live` (operation `health_live`) through the typed client, pure logic in `model/`, a presentational component, and co-located tests.

`src/features/auth` is the reference for the rest:

- browser-side adapters for mutations (sign-up, sign-in, sign-out, password reset);
- the server-only session lookups `getCurrentUser()` and `getAuthState()`, wrapped in React `cache()` and exported from `server.ts` (§5.4). They skip the API call when the request has no `montelingo_session` cookie;
- the site header (`SiteHeader`, in `(site)/layout.tsx` and the root `not-found.tsx`) with its account controls and `SignOutButton` (§5.4);
- route protection: the middleware fast path (`edge.ts`, `signInRedirectFor()`), the requested-path header for layouts (`withRequestedPath()`, `requestedPathWithin()`), the reference protected page, `/account`, and the reference protected section, `/play` (§5.4);
- form validation with `zod` (`schemas.ts`);
- the open-redirect guard `safeRedirectPath()`, and `postAuthRedirectPath()`, which sends a missing or unsafe destination, or one that is an auth page (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, in any case or encoding, with or without a trailing slash), to the map, `/play`, so a learner lands there after signing in. Pages and forms use the latter for where to go after signing in, and `authPageHref()` leaves out a `?next=` that is `/play`. Signing out still goes to `/`;
- error-code mapping in `errors.ts`;
- the sign-in and sign-up pages (`src/app/(site)/(auth)/`): thin routes that redirect a signed-in user (and treat a failed session lookup as signed out; sign-in does not redirect when it shows a notice, see below) and render `SignInForm` / `SignUpForm`. The forms run on the `useAuthForm()` hook, whose state is a pure reducer in `model/form-state.ts`: client validation shown on blur and on submit, API field errors on the matching field, other errors in a `FormAlert`, focus moved to the first invalid field, and the submit button held until `rate_limited`'s `Retry-After` deadline (an absolute time, re-read on every tick and when the tab or window regains focus, so throttled background timers cannot stretch it). API field errors for a value edited while the call was in flight are dropped, and a call that finishes after the form unmounts does nothing. Their submit button (`AuthSubmitButton`) is `disabled` until the page hydrates (`useIsHydrated()` in `src/lib/use-is-hydrated.ts`): before then nothing handles the submit, and a native one would post the values to the page route and lose them. A disabled default button also blocks Enter in a field, which `aria-disabled` cannot do without JavaScript. The forms still use `method="post"`, so credentials never land in a URL.
- the forgot-password and reset-password pages (`src/app/(site)/(auth)/forgot-password/`, `src/app/(site)/(auth)/reset-password/`), which, unlike sign-in and sign-up, never redirect a signed-in user and never call `/auth/me`: with no change-password page, a signed-in user may need a reset link too, and a link must work whoever is signed in.
  - `ForgotPasswordForm` shows the "Check your email" confirmation only when the API accepts the request. The API answers `204` whether or not the account exists, so the copy says "if an account exists" and no error can reveal one: enumeration protection is the API's. Every failure is shown like on the other forms (the generic, unreachable, or rate-limited message in the alert, and a `validation_error` on the email on the field, since the API's validator is stricter than ours), so nobody waits for an email that was never sent. "Send another link" returns to the form with the email filled in.
  - `/reset-password?token=…` reads the token with `parseResetToken()` (one value of 1 to 256 characters, passed on byte for byte). A missing or unusable token shows `InvalidResetLink`, with a link to request a new one; so does `invalid_reset_token` (or a `validation_error` on `token`) after submitting `ResetPasswordForm`. On success the form loads `/sign-in?notice=password-updated` as a new document with `replaceDocument()`, like sign-out: the reset revoked every session, so this drops all client state and the router cache in one request, and the replaced history entry keeps the used link out of Back. The sign-in page shows the notice even to a signed-in user instead of redirecting them, so someone who reset another account's password in this browser still sees it, and signing in as that account replaces the session. It shows a notice only for a known key in `SIGN_IN_NOTICES` (`parseSignInNotice()`), so a link can never put its own text on the page; `FormNotice` shows it until the first submit.
  - The token is a secret in the URL. Required controls: the page sets `<meta name="referrer" content="no-referrer">` and robots `noindex, nofollow` through its metadata, and `next.config.ts` sends `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow` for `/reset-password`, because the headers apply before the browser reaches the meta tags, which Next.js renders after the stylesheet and scripts. It sets no `Cache-Control`: Next.js already sends `private, no-cache, no-store, max-age=0, must-revalidate` for this page, which is dynamic like every route (§5.4). `getBrowserApiClient()` sets `referrerPolicy: "strict-origin"` on every API call, so the confirm request (and any later call from the same document, whose `no-referrer` policy outlives client-side navigations) sends the origin as `Origin` and `Referer` for the API's CSRF check (ADR 0004), never the path or token. The token is never logged: no client code logs it, the proxy logs only the method and path, and `next.config.ts` keeps `/reset-password` out of `next dev`'s request log (`logging.incomingRequests.ignore`), which prints the query. The page never uses the token on load (mail link scanners open links), and it does not strip the token from the address bar, so a reload still works; the token is single-use with a short lifetime. Reverse proxies and ingress in front of the web app must drop query strings for `/reset-password` from their access logs, which the app cannot control.

Installed and enforced:

- React 19 (`react`, `react-dom`, and their types), matching the React version the App Router runs. See [ADR 0003](adr/0003-react-19.md).
- Testing Library (`@testing-library/react`, `user-event`, `jest-dom`) and `vitest-axe`, with matchers registered in `vitest.setup.ts`. `ApiHealthCard.test.tsx` is the reference component test.
- `eslint-plugin-react-hooks`, `@next/eslint-plugin-next`, and `eslint-plugin-jsx-a11y` in `eslint.config.mjs`. Next.js's own build-time lint is disabled (`eslint.ignoreDuringBuilds`) because `pnpm lint:web` runs the same rules in CI.
- The same-origin API proxy (including the trusted client IP), the server and browser API clients, and the single base-URL source (§5.3). `server-only` marks the server modules. Vitest aliases it to its no-op entry so those modules can be unit-tested.
- The `cn()` helper in `src/lib/cn.ts`, built on `clsx` and `tailwind-merge` (v2, the line that supports Tailwind 3), extended with the custom tokens (§8.1).
- Form primitives in `src/components/ui/`: `TextField` (label, description, and error wired through `aria-describedby` and `aria-invalid`; the error may contain a link, such as "Sign in instead"), `PasswordField` (a show-password toggle button with `aria-pressed`, named after its field: "Show password", "Show confirm password"), `SubmitButton` (a pending state from its `pending` prop or the parent `<form action>`; it stays focusable with `aria-disabled` and ignores clicks and Enter while pending), `FormAlert` (a `role="alert"` message that renders only when there is one; give it a new `key` per submit attempt to announce a repeated message), `FormNotice` (a polite `role="status"` message for good news, such as "Password updated — please sign in."), and `ErrorFallback` (the body of an `error.tsx`: a message, an optional `description` in place of the default advice to check the connection, and a "Try again" button that refreshes the route and resets the boundary; `size="large"` makes the button a 56 px touch target). Its button's look is `ACTION_STYLE` with a size from `ACTION_SIZE_STYLES` (`action-style.ts`), which a link that is the page's main action uses too, as in `(learner)/not-found.tsx`.

- `zod` (v4) for runtime validation of form input (§5.2).
- The learner area (§8.2): `src/features/learner` (`LearnerShell` with its Back and Home controls, and the area's neutral `LearnerPageSkeleton`), the `(learner)` route group with its boundaries, and the card primitives `TileCard`, `CardGrid`, and `PlaceholderArt` in `src/components/ui/`, which the map screens use. `TILE_CARD_STATES` and `TileCardState` live in `tile-card-state.ts`, not in the client module `TileCard.tsx`, so Server Components can use the list.
- Design tokens in `tailwind.config.ts` (§8.1), and a `cn()` that knows the custom ones.
- The map feature slice (#65): `src/features/map`, the only place that knows the content and progress API. `server.ts` exports `listRegions()`, `getRegion()`, `getLocation()` (which call `notFound()` for `content_not_found` and throw anything else to the error boundary) and `getProgress()` (a failure is `{ status: "error" }`, so content still renders; only a `401` is thrown, since signed out is not missing progress), each wrapped in React `cache()`. `server.ts` also exports the error mapping (`toMapErrorMessage()`), which needs the API client. `index.ts` exports the domain types, `MapElementState` and the SVG map contract types, `joinProgress()` (an item missing from progress is `loading`, never `available`; a failed progress makes every item `error`) and `pickNextPlace()`.
- The map and region screens (#67, §8.2): `server.ts` adds the loaders `loadRegionPicker()` and `loadRegionScreen()` (content and progress in parallel, joined by the pure functions in `model/screens.ts`), `loadRegionName()` for the region page's metadata, and the place gate `assertLocationOpen()`, which returns a place only when it and its region are open. Each loader turns a `401` from any of its calls into a redirect to sign in, returning to its own screen (`/play`, `/play/<region>`, or `/play/<region>/<location>`): `play/layout.tsx` checks the session on full loads only, so this is what catches a session that ends mid-visit. The `401` check is `isSignedOut()` / `redirectOnSignedOut()` in `errors.ts`, beside `notFoundOnMissingContent()`; the loaders catch, redirect on a `401`, and rethrow everything else, so `notFound()` and other Next.js signals pass through. `index.ts` adds `MapHome`, `RegionScreen` (both thin wrappers over a private `PickerScreen` frame), their skeletons, `RegionPicker`, `LocationPicker`, `parseMapNotice()`, the paths (`regionPath()`, `locationPath()`), and the screen data types. The redirect rules and `withMapNotice()` stay inside the feature. The pages stay thin: they read params, call one loader (which redirects a locked region or an ended session), and render one feature component.

Known gaps to close as real features land:

- Import ordering (§7.2) and naming conventions (§7.1) are enforced only in code review.
