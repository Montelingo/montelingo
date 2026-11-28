#!/usr/bin/env bash
# Nightly retention job (ADR 0008): deletes expired sessions, used or expired
# password reset tokens, and account_deletions rows older than 28 days.
#
#   /opt/montelingo/deploy/purge.sh
#
# It runs apps/api/scripts/purge_expired.py in a one-off API container with
# the deployed image and the API's settings. --no-deps: the stack is already
# up, so the one-shot migrate service must not run again. The script prints
# row counts only; a failure fails this script, so cron mails it.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$root/deploy/compose.sh" run --rm --no-deps -T api python apps/api/scripts/purge_expired.py
