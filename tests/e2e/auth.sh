#!/usr/bin/env bash
# Exercises the authenticated web-origin flow against the Docker Compose stack.
# Usage: bash tests/e2e/auth.sh
# Env vars: WEB_URL, MAILPIT_URL, MAX_ATTEMPTS, SLEEP_SECONDS, E2E_REQUIRE_MAP
# (all optional).
set -euo pipefail

WEB_URL="${WEB_URL:-http://localhost:3000}"
WEB_URL="${WEB_URL%/}"
MAILPIT_URL="${MAILPIT_URL:-http://localhost:8025}"
MAILPIT_URL="${MAILPIT_URL%/}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"
# Temporary gate: set to 1 once the content seed (#62) and read endpoints (#63)
# land, so a map API that does not answer fails the run instead of skipping.
E2E_REQUIRE_MAP="${E2E_REQUIRE_MAP:-0}"
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

# Waits for the newest Mailpit message to $EMAIL with this subject.
wait_for_subject() {
  local subject="$1" messages found
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    if messages="$(curl --silent --fail "$MAILPIT_URL/api/v1/messages?limit=50")"; then
      found="$(jq -r --arg recipient "$EMAIL" --arg subject "$subject" '
        [.messages[] | select(any(.To[]?; .Address == $recipient) and .Subject == $subject)]
        | length
      ' <<<"$messages")"
      if [[ "$found" != "0" ]]; then
        echo "[e2e] Email \"$subject\" received from Mailpit"
        return 0
      fi
    fi
    echo "[e2e] waiting for email \"$subject\" - attempt $attempt/$MAX_ATTEMPTS"
    sleep "$SLEEP_SECONDS"
  done
  echo "[e2e] Mailpit has no email \"$subject\" for $EMAIL" >&2
  return 1
}

# Next.js streaming-payload details, verified against next 15.5.28: the start
# of the <meta> a streamed redirect() renders (its target follows), and the
# digest a streamed notFound() carries. Recheck them when Next.js is upgraded.
readonly STREAMED_REDIRECT_MARKER='http-equiv="refresh" content="1;url='


# The learner pages and the auth pages stream (they have a loading.tsx), so a
# redirect or a not-found page arrives in a 200 response, as a
# <meta http-equiv="refresh"> or a not-found marker. These checks read the
# signed-in page body, not the status code.
signed_in_page() {
  curl --silent --fail --cookie "$COOKIE_JAR" "$WEB_URL$1"
}

# Asserts that every needle is in the body, each after the one before.
check_in_order() {
  local description="$1"
  local body="$2"
  shift 2
  local previous=-1 offset needle
  for needle in "$@"; do
    offset="$(grep --byte-offset --only-matching --fixed-strings -- "$needle" <<<"$body" |
      head -n 1 | cut -d: -f1 || true)"
    if [[ -z "$offset" ]]; then
      echo "[e2e] $description: missing $needle" >&2
      exit 1
    fi
    if ((offset <= previous)); then
      echo "[e2e] $description: $needle is out of order" >&2
      exit 1
    fi
    previous="$offset"
  done
  echo "[e2e] $description: OK"
}

check_contains() {
  local description="$1"
  local body="$2"
  local needle="$3"
  if ! grep --quiet --fixed-strings -- "$needle" <<<"$body"; then
    echo "[e2e] $description: missing $needle" >&2
    exit 1
  fi
  echo "[e2e] $description: OK"
}

check_page_redirect() {
  local description="$1"
  local path="$2"
  local expected_target="$3"
  check_contains "$description" "$(signed_in_page "$path")" \
    "$STREAMED_REDIRECT_MARKER$expected_target\""
}

# A new account's map (ADR 0005): the coast open with Budva as the next stop,
# everything else locked but still shown.
check_new_account_map() {
  local coast cards regions_status unknown
  check_page_redirect "Sign-in page when signed in leads to the map" "/sign-in" "/play"
  # Needs the content read endpoints (#63) and the seed (#62). While they are
  # still 501 stubs the map pages show their error boundary instead, so the
  # map checks are skipped, loudly, unless E2E_REQUIRE_MAP=1 makes that a
  # failure.
  regions_status="$(status_for GET "$WEB_URL/api/v1/regions" --cookie "$COOKIE_JAR")"
  if [[ "$regions_status" != "200" ]]; then
    if [[ "$E2E_REQUIRE_MAP" == "1" ]]; then
      echo "[e2e] Map screens: GET /api/v1/regions answered $regions_status, not 200 (E2E_REQUIRE_MAP=1)" >&2
      exit 1
    fi
    echo "[e2e] SKIPPED map screens: GET /api/v1/regions answered $regions_status, not 200"
    return 0
  fi
  check_in_order "Map shows the three regions in order" "$(signed_in_page /play)" \
    'aria-label="Obala, otvoreno"' \
    'aria-label="Centralna Crna Gora, zaključano"' \
    'aria-label="Sjever i planine, zaključano"'
  coast="$(signed_in_page /play/coast)"
  check_in_order "Coast shows its six places, Budva next" "$coast" \
    'aria-label="Budva, otvoreno, sljedeće mjesto"' \
    'aria-label="Kotor, zaključano"' \
    'aria-label="Ulcinj, zaključano"' \
    'aria-label="Herceg Novi, zaključano"' \
    'aria-label="Tivat, zaključano"' \
    'aria-label="Bar, zaključano"'
  # The coast's six places, and the two other regions, still on its map.
  cards="$(grep --only-matching --extended-regexp \
    'aria-label="[^"]+, (zaključano|otvoreno|odabrano|u toku|završeno|učitava se|nije učitano)[^"]*"' \
    <<<"$coast" | wc -l | tr -d ' ')"
  if [[ "$cards" != "8" ]]; then
    echo "[e2e] Coast shows its six places and two other regions: expected 8, got $cards" >&2
    exit 1
  fi
  check_contains "Budva opens its level card" "$coast" 'href="/play/coast?place=budva"'
  check_page_redirect "Locked region leads back to the map" "/play/central" \
    "/play?notice=region-locked"
  check_contains "Map says why after a locked region" \
    "$(signed_in_page "/play?notice=region-locked")" "That region isn’t open yet."
  # Thrown inside the page's Suspense boundary, notFound() streams as a
  # not-found marker, and the browser renders (learner)/not-found.tsx from the
  # payload. The marker tells it apart from the error boundary.
 unknown="$(signed_in_page /play/atlantis)"
check_contains "Unknown region shows the learner not-found page" "$unknown" \
  "We couldn’t find that page."
}

echo "[e2e] Testing auth flow for $EMAIL"

# Sign-up needs the grown-up's consent to the policy version in force (ADR 0008).
policy_version="$(curl --silent --fail "$WEB_URL/api/v1/privacy-policy" | jq -r '.version')"
if [[ -z "$policy_version" || "$policy_version" == "null" ]]; then
  echo "[e2e] Privacy policy: response did not contain a version" >&2
  exit 1
fi
echo "[e2e] Privacy policy: OK ($policy_version)"

sign_up_body="$(curl --silent --fail-with-body --request POST \
  --header "Origin: $ORIGIN" \
  --header "Content-Type: application/json" \
  --data "$(jq -n --arg email "$EMAIL" --arg password "$OLD_PASSWORD" \
    --arg version "$policy_version" \
    '{email: $email, password: $password, parental_consent: true, privacy_policy_version: $version}')" \
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

# A new account sets up the child's profile before the map (#118): /play sends
# it to the setup, which the script then does through the API.
check_page_redirect "New account's map leads to the profile setup" "/play" "/play/welcome"
profile_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request PUT --cookie "$COOKIE_JAR" \
  --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data '{"name":"Mia","age_band":"5-6","avatar":"fox"}' \
  "$WEB_URL/api/v1/profile")"
if [[ "$profile_status" != "200" ]]; then
  echo "[e2e] Profile setup: PUT /api/v1/profile answered $profile_status, not 200" >&2
  exit 1
fi
echo "[e2e] Profile setup: OK"

check_new_account_map

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

# Children's data (#248, ADR 0008): consent at sign-up, the data export and
# deleting the account. It reuses this account, since sign-ups are limited
# (README.md). A sign-up the schema refuses does not count toward that limit.
echo "[e2e] Testing consent, export and account deletion for $EMAIL"

no_consent_body="$(curl --silent --write-out '\n%{http_code}' --request POST \
  --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data "$(jq -n --arg email "e2e-no-consent-${RUN_ID}@example.com" \
    --arg version "$policy_version" \
    '{email: $email, password: "password-123", privacy_policy_version: $version}')" \
  "$WEB_URL/api/v1/auth/sign-up")"
check_status "Sign up without parental consent" 422 "${no_consent_body##*$'\n'}"
if ! jq -e '.error.code == "validation_error"
    and any(.error.details[]?; (.field // "") | test("parental_consent"))' \
  <<<"${no_consent_body%$'\n'*}" >/dev/null; then
  echo "[e2e] Sign up without parental consent: the error does not name parental_consent" >&2
  exit 1
fi

export_headers="${TMPDIR:-/tmp}/montelingo-e2e-export-$$.headers"
trap 'rm -f "$COOKIE_JAR" "$export_headers"' EXIT
export_body="$(curl --silent --fail --cookie "$COOKIE_JAR" --dump-header "$export_headers" \
  "$WEB_URL/api/v1/account/export")"
check_contains "Export is a JSON attachment" "$(cat "$export_headers")" \
  'attachment; filename="montelingo-'
check_contains "Export is never cached" "$(tr '[:upper:]' '[:lower:]' <"$export_headers")" \
  'cache-control: no-store'
# The stored consent, as the API reads it back from the users row.
if ! jq -e --arg email "$EMAIL" --arg version "$policy_version" '
    .format_version == 1
    and .account.email == $email
    and .account.privacy_policy_version == $version
    and (.account.consent_accepted_at | type) == "string"
    and ([.players[].name] == ["Mia"])
  ' <<<"$export_body" >/dev/null; then
  echo "[e2e] Export: expected the account with its consent and the player Mia" >&2
  exit 1
fi
echo "[e2e] Export holds the account, its consent and its player: OK"
if grep --quiet --ignore-case --extended-regexp 'argon2|password|token' <<<"$export_body"; then
  echo "[e2e] Export contains a password hash or a token" >&2
  exit 1
fi
echo "[e2e] Export has no password hash or token: OK"
check_status "Export without a session" 401 "$(status_for GET "$WEB_URL/api/v1/account/export")"

wrong_delete_status="$(status_for POST "$WEB_URL/api/v1/account/delete" \
  --cookie "$COOKIE_JAR" --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data '{"password":"not-the-password"}')"
# 403, not 401, so the web does not take it for a signed-out session (ADR 0008).
check_status "Delete account with a wrong password" 403 "$wrong_delete_status"
check_status "Account still there after a wrong password" 200 \
  "$(status_for GET "$WEB_URL/api/v1/auth/me" --cookie "$COOKIE_JAR")"

# No --cookie-jar: the jar keeps the old cookie, to check it no longer works.
delete_status="$(status_for POST "$WEB_URL/api/v1/account/delete" \
  --cookie "$COOKIE_JAR" --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
  --data "$(jq -n --arg password "$NEW_PASSWORD" '{password: $password}')")"
check_status "Delete account" 204 "$delete_status"
check_status "Old cookie after deleting the account" 401 \
  "$(status_for GET "$WEB_URL/api/v1/auth/me" --cookie "$COOKIE_JAR")"
check_status "Sign in after deleting the account" 401 \
  "$(status_for POST "$WEB_URL/api/v1/auth/sign-in" \
    --header "Origin: $ORIGIN" --header "Content-Type: application/json" \
    --data "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASSWORD\"}")"
wait_for_subject "Tvoj Montelingo nalog je obrisan"

echo "[e2e] All auth checks passed."
