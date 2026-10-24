# End-to-end tests

[`smoke.sh`](smoke.sh) smoke-tests the full Docker Compose stack (`postgres`, `api`, `web`). It waits for the API liveness endpoint and the web homepage to respond, then asserts that API liveness, API readiness (database connectivity), and the web homepage each return `200`. It also checks the web's same-origin `/api/*` proxy: API liveness through the web origin returns `200`, and an unknown API route returns the API's `404`. Finally it checks authentication routing: the sign-in page returns `200`, and the protected `/account` page and learner area (`/play?x=1`), requested without a session cookie, redirect (`307`) to `/sign-in?next=…` with their path and query string. With a session cookie the API does not recognize, both get past the middleware and redirect to sign-in themselves (`/account` from its page, `/play` from its layout, which learns the requested path and query from the middleware); they stream, so those checks look for the redirect's `<meta http-equiv="refresh">` in a `200` response. They run once `GET /api/v1/auth/me` answers `401` for an unknown session, and are reported as skipped while that endpoint is still a stub. The stale-session checks send the cookie named by `MONTELINGO_SESSION_COOKIE_NAME` (default `montelingo_session`), so export it when the stack uses a custom name. It also checks the password-reset pages: `/forgot-password` returns `200`, and `/reset-password?token=…` returns `200` with a `Referrer-Policy: no-referrer` header and a `<meta name="referrer" content="no-referrer">` tag, so the token in its URL never leaves in a `Referer` header.

```bash
docker compose up --build -d
pnpm e2e:smoke
docker compose down -v
```

Optional environment variables: `API_URL` (default `http://localhost:8000`), `WEB_URL` (default `http://localhost:3000`), `MAX_ATTEMPTS` (default `30`), `SLEEP_SECONDS` (default `2`).

The `e2e.yml` workflow runs the same steps on every pull request and push to `main`.

[`auth.sh`](auth.sh) proves the real web-origin authentication flow through the proxy,
API, Postgres, and Mailpit. It creates a unique account, checks sign-up/sign-in,
`/api/v1/auth/me`, protected account routing, sign-out, password reset using the
link retrieved from Mailpit's HTTP API, password replacement, sign-in rate
limiting, and foreign-origin protection. It uses `jq` to parse JSON, in addition
to Bash and curl.

```bash
docker compose up --build -d --wait
pnpm e2e:smoke
pnpm e2e:auth
docker compose down -v
```

Optional variables for `auth.sh`: `WEB_URL` (default `http://localhost:3000`),
`MAILPIT_URL` (default `http://localhost:8025`), `MAX_ATTEMPTS` (default `30`),
and `SLEEP_SECONDS` (default `2`).
