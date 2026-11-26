#!/usr/bin/env bash
# Nightly PostgreSQL backup, copied off the server to a Hetzner Storage Box.
#
# Keeps 7 daily dumps and 3 weekly (Sunday) dumps, locally in
# /opt/montelingo/backups and mirrored to the remote with rsync over SSH.
#
#   BACKUP_REMOTE=u123456@u123456.your-storagebox.de:montelingo-backups \
#     /opt/montelingo/deploy/backup.sh
#
# BACKUP_SSH_PORT defaults to 23, the Storage Box SSH port. Without
# BACKUP_REMOTE the dump stays local and the script fails, so cron mails it.
# Restore steps: docs/deployment.md.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backups="$root/backups"
mkdir -p "$backups/daily" "$backups/weekly"

stamp="$(date -u +%Y-%m-%dT%H%MZ)"
dump="$backups/daily/montelingo-$stamp.dump"

# pg_dump runs inside the postgres container with that container's own
# credentials, so no password is needed here. Custom format: pg_restore can
# restore it selectively and in parallel.
# shellcheck disable=SC2016 # expands inside the postgres container
dump_status=0
"$root/deploy/compose.sh" exec -T postgres \
  sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$dump.partial" || dump_status=$?

if ((dump_status == 0)); then
  mv "$dump.partial" "$dump"
  echo "backup.sh: wrote $dump ($(du -h "$dump" | cut -f1))"
  if [[ "$(date -u +%u)" == "7" ]]; then
    cp "$dump" "$backups/weekly/"
  fi
else
  rm -f "$dump.partial"
  echo "backup.sh: pg_dump failed ($dump_status), pruning and syncing anyway" >&2
fi

# Expiry is a privacy promise (ADR 0008: no dump outlives 28 days), so it
# runs even when tonight's dump failed. Weekly dumps go at 20 days, not 21:
# find rounds ages down, and a run a few seconds early would keep one more
# night. The 0-, 7- and 14-day weeklies stay.
find "$backups/daily" -name 'montelingo-*.dump' -mtime +6 -delete
find "$backups/weekly" -name 'montelingo-*.dump' -mtime +19 -delete

# --delete is what expires the Storage Box copies, so a failing sync must
# fail the script loudly (cron mails it).
: "${BACKUP_REMOTE:?Set BACKUP_REMOTE to user@host:path on the Storage Box}"
rsync -a --delete -e "ssh -p ${BACKUP_SSH_PORT:-23} -o BatchMode=yes" \
  "$backups/" "$BACKUP_REMOTE/"
echo "backup.sh: copied to $BACKUP_REMOTE"

exit "$dump_status"
