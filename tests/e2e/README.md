# End-to-end tests

[`smoke.sh`](smoke.sh) smoke-tests the full Docker Compose stack (`postgres`, `api`, `web`). It waits for the API liveness endpoint and the web homepage to respond, then asserts that API liveness, API readiness (database connectivity), and the web homepage each return `200`. It also checks the web's same-origin `/api/*` proxy: API liveness through the web origin returns `200`, and an unknown API route returns the API's `404`.

```bash
docker compose up --build -d
pnpm e2e:smoke
docker compose down -v
```

Optional environment variables: `API_URL` (default `http://localhost:8000`), `WEB_URL` (default `http://localhost:3000`), `MAX_ATTEMPTS` (default `30`), `SLEEP_SECONDS` (default `2`).

The `e2e.yml` workflow runs the same steps on every pull request and push to `main`.
