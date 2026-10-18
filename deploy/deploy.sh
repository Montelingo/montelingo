#!/usr/bin/env bash
# Deploys one image tag on the server. Run by the Deploy workflow over SSH, or
# by hand for a rollback:
#
#   IMAGE_TAG=sha-<40-char commit SHA> /opt/montelingo/deploy/deploy.sh
#
# Pulls the images, runs migrations (the `migrate` service runs before the API
# starts), and waits until every service is healthy. A failed health check
# fails the deploy; the previous tag stays recorded so it can be redeployed.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

: "${IMAGE_TAG:?Set IMAGE_TAG, for example IMAGE_TAG=sha-<commit> deploy/deploy.sh}"
if [[ ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "deploy.sh: IMAGE_TAG must be sha-<40-char commit SHA>, got '$IMAGE_TAG'" >&2
  exit 1
fi

previous="$(sed -n 's/^IMAGE_TAG=//p' .image-tag.env 2>/dev/null || true)"
echo "deploy.sh: deploying $IMAGE_TAG (previous: ${previous:-none})"

# Compose reads IMAGE_TAG from here for this deploy and for compose.sh later.
printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG" > .image-tag.env.next
compose=(docker compose -f compose.prod.yaml --env-file .env --env-file .image-tag.env.next)

"${compose[@]}" pull --quiet
"${compose[@]}" up -d --wait --wait-timeout 300 --remove-orphans

mv .image-tag.env.next .image-tag.env
if [[ -n "$previous" && "$previous" != "$IMAGE_TAG" ]]; then
  printf 'IMAGE_TAG=%s\n' "$previous" > .image-tag.previous.env
fi

# Old images are kept for a week so a rollback does not have to pull.
docker image prune --all --force --filter "until=168h" >/dev/null
echo "deploy.sh: $IMAGE_TAG is live"
