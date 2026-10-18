#!/usr/bin/env bash
# Nightly PostgreSQL backup, copied off the server to a Hetzner Storage Box.
#
# Keeps 7 daily dumps and 4 weekly (Sunday) dumps, locally in
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
"$root/deploy/compose.sh" exec -T postgres \
  sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$dump.partial"
mv "$dump.partial" "$dump"
echo "backup.sh: wrote $dump ($(du -h "$dump" | cut -f1))"

if [[ "$(date -u +%u)" == "7" ]]; then
  cp "$dump" "$backups/weekly/"
fi

find "$backups/daily" -name 'montelingo-*.dump' -mtime +6 -delete
find "$backups/weekly" -name 'montelingo-*.dump' -mtime +27 -delete

: "${BACKUP_REMOTE:?Set BACKUP_REMOTE to user@host:path on the Storage Box}"
rsync -a --delete -e "ssh -p ${BACKUP_SSH_PORT:-23} -o BatchMode=yes" \
  "$backups/" "$BACKUP_REMOTE/"
echo "backup.sh: copied to $BACKUP_REMOTE"
