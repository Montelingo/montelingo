#!/usr/bin/env bash
# Exercises the authenticated web-origin flow against the Docker Compose stack.
# Usage: bash tests/e2e/auth.sh
# Env vars: WEB_URL, MAILPIT_URL, MAX_ATTEMPTS, SLEEP_SECONDS (all optional).
set -euo pipefail

WEB_URL="${WEB_URL:-http://localhost:3000}"
WEB_URL="${WEB_URL%/}"
MAILPIT_URL="${MAILPIT_URL:-http://localhost:8025}"
MAILPIT_URL="${MAILPIT_URL%/}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"
ORIGIN="$WEB_URL"
COOKIE_JAR="${TMPDIR:-/tmp}/montelingo-e2e-auth-$$.cookies"
RUN_ID="$(date +%s)-$$-${RANDOM}"
EMAIL="e2e-${RUN_ID}@example.com"
RATE_EMAIL="e2e-rate-${RUN_ID}@example.com"
OLD_PASSWORD="old-password-${RUN_ID}"
NEW_PASSWORD="new-password-${RUN_ID}"

trap 'rm -f "$COOKIE_JAR"' EXIT

if ! command -v jq >/dev/null 2>&1; then
  echo "[e2e] auth checks require jq to parse JSON responses and Mailpit messages" >&2
  exit 1
fi

status_for() {
  local method="$1"
  local url="$2"
  shift 2
  curl --silent --output /dev/null --write-out '%{http_code}' \
    --request "$method" "$url" "$@"
}

check_status() {
  local description="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "[e2e] $description: expected $expected, got $actual" >&2
    exit 1
  fi
  echo "[e2e] $description: OK ($actual)"
}

check_json_email() {
  local description="$1"
  local body="$2"
  if ! jq -e --arg email "$EMAIL" '.email == $email' <<<"$body" >/dev/null; then
    echo "[e2e] $description: response did not contain email $EMAIL" >&2
    exit 1
  fi
  echo "[e2e] $description: OK ($EMAIL)"
}

wait_for_reset_message() {
  local messages message_id message
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    if ! messages="$(curl --silent --fail "$MAILPIT_URL/api/v1/messages?limit=50")"; then
      echo "[e2e] waiting for Mailpit HTTP API - attempt $attempt/$MAX_ATTEMPTS"
      sleep "$SLEEP_SECONDS"
      continue
    fi
    message_id="$(jq -r --arg recipient "$EMAIL" '
      [.messages[] | select(any(.To[]?; .Address == $recipient))]
      | sort_by(.Created)
      | last
      | .ID // empty
    ' <<<"$messages")"
    if [[ -n "$message_id" ]]; then
      if ! message="$(curl --silent --fail "$MAILPIT_URL/api/v1/message/$message_id")"; then
        echo "[e2e] waiting for Mailpit message details - attempt $attempt/$MAX_ATTEMPTS"
        sleep "$SLEEP_SECONDS"
        continue
      fi
      RESET_LINK="$(jq -r '.Text // ""' <<<"$message" |
        grep -oE 'https?://[^[:space:]]+/reset-password\?token=[^[:space:]]+' |
        head -n 1 || true)"
      if [[ -n "$RESET_LINK" ]]; then
        echo "[e2e] Password-reset email received from Mailpit"
        return 0
      fi
    fi
    echo "[e2e] waiting for password-reset email - attempt $attempt/$MAX_ATTEMPTS"
    sleep "$SLEEP_SECONDS"
  done
  echo "[e2e] Mailpit did not contain a reset link for $EMAIL" >&2
  return 1
}

echo "[e2e] Testing auth flow for $EMAIL"

sign_up_body="$(curl --silent --fail-with-body --request POST \
  --header "Origin: $ORIGIN" \
  --header "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASSWORD\"}" \
  "$WEB_URL/api/v1/auth/sign-up")"
check_json_email "Sign up" "$sign_up_body"

sign_in_body="$(curl --silent --fail-with-body --request POST \
  --cookie-jar "$COOKIE_JAR" \
  --header "Origin: $ORIGIN" \
  --header "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASSWORD\"}" \
  "$WEB_URL/api/v1/auth/sign-in")"
check_json_email "Sign in" "$sign_in_body"

me_body="$(curl --silent --fail --cookie "$COOKIE_JAR" "$WEB_URL/api/v1/auth/me")"
check_json_email "Authenticated me" "$me_body"

account_status="$(status_for GET "$WEB_URL/account" --cookie "$COOKIE_JAR")"
check_status "Account with session" 200 "$account_status"

redirect_location="$(curl --silent --output /dev/null --write-out '%{redirect_url}' \
  "$WEB_URL/account")"
if [[ "$redirect_location" != "$WEB_URL/sign-in?next=%2Faccount" ]]; then
  echo "[e2e] Account without session: expected redirect to $WEB_URL/sign-in?next=%2Faccount, got $redirect_location" >&2
  exit 1
fi
echo "[e2e] Account without session: OK (redirect to sign-in)"

sign_out_status="$(status_for POST "$WEB_URL/api/v1/auth/sign-out" \
  --cookie "$COOKIE_JAR" --header "Origin: $ORIGIN")"
check_status "Sign out" 204 "$sign_out_status"

me_after_sign_out="$(status_for GET "$WEB_URL/api/v1/auth/me" --cookie "$COOKIE_JAR")"
check_status "Me after sign out" 401 "$me_after_sign_out"

reset_request_status="$(status_for POST "$WEB_URL/api/v1/auth/password-reset" \
  --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\"}")"
check_status "Request password reset" 204 "$reset_request_status"
wait_for_reset_message

if [[ "$RESET_LINK" != "$WEB_URL/reset-password?token="* ]]; then
  echo "[e2e] Reset link has unexpected web origin: $RESET_LINK" >&2
  exit 1
fi
reset_token="${RESET_LINK#*token=}"
confirm_status="$(status_for POST "$WEB_URL/api/v1/auth/password-reset/confirm" \
  --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data "{\"token\":\"$reset_token\",\"new_password\":\"$NEW_PASSWORD\"}")"
check_status "Confirm password reset" 204 "$confirm_status"

old_password_status="$(status_for POST "$WEB_URL/api/v1/auth/sign-in" \
  --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASSWORD\"}")"
check_status "Old password after reset" 401 "$old_password_status"

new_sign_in_status="$(status_for POST "$WEB_URL/api/v1/auth/sign-in" \
  --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR" \
  --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASSWORD\"}")"
check_status "Sign in with new password" 200 "$new_sign_in_status"

for attempt in $(seq 1 5); do
  wrong_password_status="$(status_for POST "$WEB_URL/api/v1/auth/sign-in" \
    --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
    --data "{\"email\":\"$RATE_EMAIL\",\"password\":\"wrong-password\"}")"
  check_status "Wrong password attempt $attempt" 401 "$wrong_password_status"
done
rate_limited_status="$(status_for POST "$WEB_URL/api/v1/auth/sign-in" \
  --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data "{\"email\":\"$RATE_EMAIL\",\"password\":\"wrong-password\"}")"
check_status "Wrong password rate limit" 429 "$rate_limited_status"

foreign_origin_status="$(status_for POST "$WEB_URL/api/v1/auth/password-reset" \
  --header "Origin: https://foreign.example" \
  --header "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\"}")"
check_status "Foreign-origin state-changing request" 403 "$foreign_origin_status"

echo "[e2e] All auth checks passed."
