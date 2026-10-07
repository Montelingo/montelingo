# Frontend architecture conventions

This document defines how `apps/web` (Next.js 15 App Router, React 19, TypeScript, Tailwind) is organized. It is the frontend counterpart to [FastAPI modular-monolith boundaries and rules](fastapi-modular-monolith.md): features are the frontend equivalent of backend modules, routes are the equivalent of routers, and `@app/api-client` is the only bridge between the two.

Rules marked **(enforced)** fail CI through `pnpm lint:web` or `pnpm typecheck:web`. `pnpm lint:web` runs with `--max-warnings 0`, so lint warnings fail CI too. Everything else is enforced in code review.

## 1. Folder structure

### 1.1 Layout

```text
apps/web/src/
  app/                              # routing only: pages, layouts, loading/error/not-found files
    layout.tsx
    globals.css
    error.tsx
    not-found.tsx
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
  components/
    ui/                             # shared, domain-free primitives (TextField, SubmitButton, Dialog)
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
- A feature may import shared folders and **another feature's public API only** (`@/features/progress`, never `@/features/progress/model/streak`).
- Shared folders (`components/`, `hooks/`, `lib/`) must never import from `features/` or `app/`.
- Inside a feature, use relative imports (`../model/scoring`).

ESLint (`no-restricted-imports`) rejects deep imports into another feature and any import from `@/features` in shared folders.

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
3. lets `ApiClientError` propagate, or converts expected cases (such as 404 → `null`) into typed results

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

Use runtime validation (a Zod schema in `schemas.ts`) when data crosses a boundary TypeScript cannot check:

- data comes from `localStorage`, URL params, `postMessage`, or form input

`zod` is not installed yet because no such boundary exists yet. Add it to `apps/web` with the first schema. Do not duplicate types the generator already provides.

### 5.3 Server-side and browser-side calls

There are two clients, one per runtime. Adapters take the client from one of them and never read `process.env` or build URLs themselves.

| Where the code runs                                          | Client                                                        | How it reaches the API                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Server Components, route handlers (`src/lib/api.ts`)         | `getApiClient()`, or `getApiClient({ forwardCookies: true })` | Directly over the internal network, at `API_INTERNAL_BASE_URL`               |
| Client Components, event handlers (`src/lib/browser-api.ts`) | `getBrowserApiClient()`                                       | The same-origin proxy: `/api/*` on the web origin, which forwards to the API |

Use a **server-side call** to read data while rendering. It is the default (§4.1), and it keeps the round trip on the internal network. Pass `forwardCookies: true` when the API must see the signed-in user. The client then sends the incoming request's `Cookie` header to the API.

Use a **browser-side call** for mutations and anything else triggered by the user (sign-in, sign-out, submitting an answer). The browser sends the session cookie itself, the API sees the real `Origin` for its CSRF check ([ADR 0004](adr/0004-session-based-authentication.md)), and every `Set-Cookie` the API returns reaches the browser.

Rules:

- Do not send cookie-authenticated mutations from server code. They would carry no browser `Origin`, so the API's CSRF check rejects them, and any `Set-Cookie` the API returns would never reach the browser.
- Never call `getApiClient({ forwardCookies: true })` inside a cached scope (`unstable_cache`, `"use cache"`). The response depends on the user's cookies, so caching it would serve one user's data to another.
- `src/lib/api.ts` is server-only, so a Client Component cannot import it (the build fails). An adapter that runs in the browser takes its client from `getBrowserApiClient()`.

#### Base URL

`src/lib/api-config.ts` is the only place that knows the API's internal address and the only place that parses it. `getApiInternalBase()` returns its origin and path prefix (used by the proxy), and `getApiInternalBaseUrl()` returns the same value as one URL string (used by `getApiClient()`). Both read `API_INTERNAL_BASE_URL` on every call, so one built image can target any API, and fall back to `http://localhost:8000` for local `pnpm dev`. The parsed value is reused until the variable changes. They throw on a value that is not an absolute `http(s)` URL, or that contains credentials, a query string, or a fragment. `@app/api-client` has no default: `createApiClient()` requires a `baseUrl`, and the browser client passes `window.location.origin`.

#### The same-origin proxy

`src/app/api/[...path]/route.ts` forwards every `/api/*` request on the web origin to `API_INTERNAL_BASE_URL`. The forwarding logic is a pure function, `proxyApiRequest()` in `src/lib/api-proxy.ts`, with unit tests over a mocked `fetch`. `/api/*` on the web origin belongs to the proxy. Do not add other route handlers under `src/app/api/`.

- **Target:** the raw request path and query string are appended to the base URL, so a base path prefix (`http://api:8000/backend`) is kept. Paths that leave `/api/` after decoding (`/api/%2e%2e/…`, `..%2f`, `%5c`) get a local `404 not_found` envelope and never reach the API.
- **Request:** the method, body, query string, and only these headers are forwarded: `Accept`, `Accept-Language`, `Content-Type`, `Cookie`, `Origin`, `Referer` (the API's CSRF fallback when `Origin` is absent), `If-None-Match` and `If-Modified-Since` (so the API can answer `304`), `User-Agent`, and `X-Request-Id`. Everything else is dropped, including hop-by-hop headers, `Host`, `X-Forwarded-*` (clients can spoof it), and `Authorization`, because authentication is the session cookie only ([ADR 0004](adr/0004-session-based-authentication.md)). An `X-Request-Id` that does not match the API's format (`^[A-Za-z0-9._:-]{1,128}$`) is replaced with a new UUID.
- **Request body:** bodies are buffered, which suits the API's small JSON payloads, up to 1 MiB (`API_PROXY_MAX_BODY_BYTES`). A larger `Content-Length` gets `413 bad_request` (the code the API uses for `413`) before anything is read. Bodies without one (chunked) are counted as they arrive, and the proxy stops reading and answers `413` as soon as they cross the limit. In both cases the API is never called. A body stream that fails gets `400 bad_request`.
- **Response:** the status, body, every `Set-Cookie` header (one header per cookie), `X-Request-Id`, and the other API headers are returned. Hop-by-hop headers, headers named in `Connection`, and `Content-Encoding`/`Content-Length` are stripped, because `fetch` has already decompressed the body. A `304` is returned with no body, like `204`, `205`, and any `HEAD` response. Redirects are passed through, not followed. A `Location` is resolved against the upstream URL, as the browser would resolve it. If it lands on the API origin, it becomes a web-origin path (with query and fragment), and a path into the API (`<base path>/api/…`) also loses the base path, so the internal host never reaches the browser and the browser stays on the proxy. A `Location` on any other origin, or one that does not parse, is passed through unchanged.
- **Failures:** when the API is unreachable the proxy answers `502`, and when the API's response headers do not arrive within 30 seconds (`API_PROXY_TIMEOUT_MS`) it answers `504`. Both use code `service_unavailable`. The timeout starts after the request body has been read and ends once the headers arrive, so a slow upload is not counted and a response body still streaming back is never cut off. An invalid `API_INTERNAL_BASE_URL` makes the proxy answer `500 internal_server_error` instead of Next's HTML error page. Every proxy failure uses the shared error envelope and the request's `X-Request-Id`, so `unwrap()` throws `ApiClientError` exactly as it does for API errors. The unreachable, timeout, and misconfiguration failures are logged on the server. A client that disconnects, during the upload or while the response streams, cancels the API call and is not logged.
- Next.js redirects `/api/...` paths with a trailing slash (`308`) before the proxy runs. API routes never end in a slash, so this has no effect.

A route handler is used instead of `rewrites` or middleware because it reads the base URL at runtime, controls which headers cross in each direction, returns the error envelope when the API is down, and can be unit-tested. A middleware rewrite exposes the internal URL in its `x-middleware-rewrite` response header.

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
- Each feature has one `index.ts` that re-exports its public API: the components routes compose, loaders/adapters routes call, and domain types other features need. Everything not exported from `index.ts` is private to the feature.
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
- Styling must not remove accessibility affordances: never `outline-none` without a visible `focus-visible:` replacement. Text must meet WCAG AA contrast.

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

| Failure                                                     | Handled by                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Resource does not exist                                     | Adapter returns `null` → page calls `notFound()` → nearest `not-found.tsx` |
| Unexpected error while rendering a route                    | Nearest `error.tsx` in the route segment                                   |
| Error in the root layout                                    | `src/app/global-error.tsx`                                                 |
| Expected, recoverable user error (wrong answer, validation) | Handled in the feature as state. Not thrown                                |
| Failed mutation from a client component                     | Caught in the feature hook, exposed as `{ status: "error", message }`      |

Every route segment that fetches data has an `error.tsx` (or inherits one from its parent). Error boundaries show a human message and a retry action. They never show `error.message` from the server verbatim:

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

`ApiClientError.error.code` (from the shared error envelope) is mapped to user-facing copy in the feature's `errors.ts`. Components switch on `code`, never on `message`.

### 9.2 Loading states

- Each data-fetching route segment has a `loading.tsx` that renders a skeleton with the same layout as the loaded page, to avoid layout shift.
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

`src/features/health` is the reference implementation of these conventions: a thin `app/page.tsx`, an adapter that calls `GET /api/v1/health/live` (operation `health_live`) through the typed client, pure logic in `model/`, a presentational component, and co-located tests.

Installed and enforced:

- React 19 (`react`, `react-dom`, and their types), matching the React version the App Router runs. See [ADR 0003](adr/0003-react-19.md).
- Testing Library (`@testing-library/react`, `user-event`, `jest-dom`) and `vitest-axe`, with matchers registered in `vitest.setup.ts`. `ApiHealthCard.test.tsx` is the reference component test.
- `eslint-plugin-react-hooks`, `@next/eslint-plugin-next`, and `eslint-plugin-jsx-a11y` in `eslint.config.mjs`. Next.js's own build-time lint is disabled (`eslint.ignoreDuringBuilds`) because `pnpm lint:web` runs the same rules in CI.
- The same-origin API proxy, the server and browser API clients, and the single base-URL source (§5.3). `server-only` marks the server modules. Vitest aliases it to its no-op entry so those modules can be unit-tested.
- The `cn()` helper in `src/lib/cn.ts`, built on `clsx` and `tailwind-merge` (v2, the line that supports Tailwind 3).
- Form primitives in `src/components/ui/`: `TextField` (label, description, and error wired through `aria-describedby` and `aria-invalid`), `PasswordField` (a "Show password" toggle button with `aria-pressed`), `SubmitButton` (a pending state from its `pending` prop or the parent `<form action>`; it stays focusable with `aria-disabled` and ignores clicks and Enter while pending), and `FormAlert` (a `role="alert"` message that renders only when there is one; give it a new `key` per submit attempt to announce a repeated message).

Known gaps to close as real features land:

- `zod` is documented but not installed yet. Add it with its first schema.
- Import ordering (§7.2) and naming conventions (§7.1) are enforced only in code review.
- The proxy does not forward the browser's IP address, because `X-Forwarded-For` from the client cannot be trusted. Until a follow-up issue adds a trusted client-IP scheme (an edge proxy sets the header, the web proxy forwards only that value, and uvicorn runs with `--forwarded-allow-ips`), the API's rate limiter ([ADR 0004](adr/0004-session-based-authentication.md)) sees every proxied browser request as coming from the web container.
