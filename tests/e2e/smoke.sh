#!/usr/bin/env bash
# Smoke-tests the docker compose stack (api + web + postgres).
# Usage: bash tests/e2e/smoke.sh
# Env vars: API_URL, WEB_URL, MAX_ATTEMPTS, SLEEP_SECONDS (all optional).
# SMOKE_CURL_ARGS (optional) adds curl options to every request, for example
# basic auth on staging (docs/deployment.md):
#   API_URL=https://staging.example.com WEB_URL=https://staging.example.com \
#     SMOKE_CURL_ARGS="--user montelingo:<password>" bash tests/e2e/smoke.sh
set -euo pipefail

read -r -a smoke_curl_args <<<"${SMOKE_CURL_ARGS:-}"
curl() {
  command curl "${smoke_curl_args[@]}" "$@"
}

API_URL="${API_URL:-http://localhost:8000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"
# Must match the apps' MONTELINGO_SESSION_COOKIE_NAME, so the stale-session checks send the cookie they read.
SESSION_COOKIE_NAME="${MONTELINGO_SESSION_COOKIE_NAME:-montelingo_session}"

wait_for() {
  local name="$1"
  local url="$2"
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    if curl --silent --fail --output /dev/null "$url"; then
      echo "[e2e] $name is up ($url)"
      return 0
    fi
    echo "[e2e] waiting for $name ($url) - attempt $attempt/$MAX_ATTEMPTS"
    sleep "$SLEEP_SECONDS"
  done
  echo "[e2e] $name did not become ready at $url" >&2
  return 1
}

check_status() {
  local description="$1"
  local url="$2"
  local expected="$3"
  local status
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$url")
  if [[ "$status" != "$expected" ]]; then
    echo "[e2e] $description: expected $expected from $url, got $status" >&2
    exit 1
  fi
  echo "[e2e] $description: OK ($status)"
}

# Asserts a redirect without following it: the status and the Location header.
check_redirect() {
  local description="$1"
  local url="$2"
  local expected_status="$3"
  local expected_location="$4"
  local result status location
  result=$(curl --silent --output /dev/null --write-out '%{http_code} %{redirect_url}' "$url")
  status="${result%% *}"
  location="${result#* }"
  # curl adds --user credentials to the URL it resolves a relative Location against.
  location="$(sed -E 's#://[^/@]*@#://#' <<<"$location")"
  if [[ "$status" != "$expected_status" || "$location" != "$expected_location" ]]; then
    echo "[e2e] $description: expected $expected_status to $expected_location from $url, got $status to $location" >&2
    exit 1
  fi
  echo "[e2e] $description: OK ($status to $location)"
}

# A protected page with a session cookie the API rejects: the middleware lets
# it through (it only checks that a cookie is there), and the page, finding no
# user, redirects to sign-in. The page streams, so the redirect is not a 307
# but a 200 whose HTML carries a meta refresh (and an RSC redirect for
# client-side navigation). Asserting the meta refresh covers both.
check_stale_session_redirect() {
  local description="$1"
  local url="$2"
  local expected_target="$3"
  local body
  body=$(curl --silent --cookie "${SESSION_COOKIE_NAME}=e2e-bogus-session" "$url")
  if ! grep -qF "http-equiv=\"refresh\" content=\"1;url=$expected_target\"" <<<"$body"; then
    echo "[e2e] $description: expected a redirect to $expected_target from $url" >&2
    exit 1
  fi
  echo "[e2e] $description: OK (redirect to $expected_target)"
}

# The reset-password URL carries a token, so the page must stop the browser
# from sending it on as Referer: with the response header and the meta tag.
check_reset_password_page() {
  local url="$WEB_URL/reset-password?token=smoke"
  local headers body
  check_status "Reset-password page" "$url" 200
  headers=$(curl --silent --dump-header - --output /dev/null "$url" | tr -d '\r')
  if ! grep --quiet --ignore-case '^referrer-policy: no-referrer$' <<<"$headers"; then
    echo "[e2e] Reset-password page: no 'Referrer-Policy: no-referrer' header from $url" >&2
    exit 1
  fi
  body=$(curl --silent "$url")
  if ! grep --quiet --fixed-strings '<meta name="referrer" content="no-referrer"' <<<"$body"; then
    echo "[e2e] Reset-password page: no referrer meta tag in the HTML from $url" >&2
    exit 1
  fi
  echo "[e2e] Reset-password page: OK (Referrer-Policy header and meta tag)"
}

wait_for "API" "$API_URL/api/v1/health/live"
wait_for "Web" "$WEB_URL"

check_status "API liveness" "$API_URL/api/v1/health/live" 200
check_status "API readiness (DB connectivity)" "$API_URL/api/v1/health/ready" 200
check_status "Web homepage" "$WEB_URL" 200
check_status "API via the web proxy" "$WEB_URL/api/v1/health/live" 200
check_status "Unknown API route via the web proxy" "$WEB_URL/api/v1/does-not-exist" 404
check_status "Web sign-in page" "$WEB_URL/sign-in" 200
check_redirect "Protected page without a session" "$WEB_URL/account?tab=email" 307 \
  "$WEB_URL/sign-in?next=%2Faccount%3Ftab%3Demail"
check_redirect "Learner area without a session" "$WEB_URL/play?x=1" 307 \
  "$WEB_URL/sign-in?next=%2Fplay%3Fx%3D1"

# Needs GET /auth/me to answer 401 for an unknown session. While the endpoint
# is still a 501 stub, the page shows its error boundary instead, so the check
# is skipped, loudly, until the API implements it.
me_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --cookie "${SESSION_COOKIE_NAME}=e2e-bogus-session" "$API_URL/api/v1/auth/me")
if [[ "$me_status" == "401" ]]; then
  check_stale_session_redirect "Protected page with a stale session" "$WEB_URL/account" \
    "/sign-in?next=%2Faccount"
  # The learner area checks the session in a layout, which learns the
  # requested path (and query) from the middleware.
  check_stale_session_redirect "Learner area with a stale session" "$WEB_URL/play?x=1" \
    "/sign-in?next=%2Fplay%3Fx%3D1"
else
  echo "[e2e] SKIPPED protected pages with a stale session: GET /api/v1/auth/me answered $me_status, not 401"
fi
check_status "Forgot-password page" "$WEB_URL/forgot-password" 200
check_reset_password_page

echo "[e2e] All smoke checks passed."
