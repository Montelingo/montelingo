#!/usr/bin/env bash
# Smoke-tests the docker compose stack (api + web + postgres).
# Usage: bash tests/e2e/smoke.sh
# Env vars: API_URL, WEB_URL, MAX_ATTEMPTS, SLEEP_SECONDS (all optional).
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"

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

wait_for "API" "$API_URL/api/v1/health/live"
wait_for "Web" "$WEB_URL"

check_status "API liveness" "$API_URL/api/v1/health/live" 200
check_status "API readiness (DB connectivity)" "$API_URL/api/v1/health/ready" 200
check_status "Web homepage" "$WEB_URL" 200

echo "[e2e] All smoke checks passed."
