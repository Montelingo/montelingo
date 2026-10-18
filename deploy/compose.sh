#!/usr/bin/env bash
# Runs `docker compose` on the server's stack with the deployed image tag.
#
# Usage, from anywhere:   /opt/montelingo/deploy/compose.sh ps
#                         /opt/montelingo/deploy/compose.sh logs -f api
#
# deploy.sh records the tag in .image-tag.env, so commands run between deploys
# use the images that are actually running.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if [[ ! -f .env ]]; then
  echo "compose.sh: $root/.env is missing (see .env.production.example)" >&2
  exit 1
fi

env_files=(--env-file .env)
if [[ -f .image-tag.env ]]; then
  env_files+=(--env-file .image-tag.env)
fi

exec docker compose -f compose.prod.yaml "${env_files[@]}" "$@"
