# Deployment

Staging runs on one Hetzner server with Docker Compose. Caddy terminates TLS and is the only public service. The web reaches the API over the internal Compose network through its same-origin `/api/*` proxy, so the API and PostgreSQL never publish a port.

```text
Internet ──443──▶ caddy ──▶ web:3000 ──internal──▶ api:8000 ──▶ postgres
                                                         └──▶ SMTP provider (587)
```

| File                                                              | Role                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`compose.prod.yaml`](../compose.prod.yaml)                       | The stack: GHCR images pinned by `IMAGE_TAG`, a one-shot `migrate` service, log rotation     |
| [`Caddyfile`](../Caddyfile)                                       | TLS, HTTP→HTTPS, HSTS, basic auth (except `/api/v1/health/*`), proxy to `web:3000`           |
| [`.env.production.example`](../.env.production.example)           | Every server setting, with placeholders. The real file is `/opt/montelingo/.env`, mode `600` |
| [`deploy/deploy.sh`](../deploy/deploy.sh)                         | One deploy: pull, migrate, start, wait until healthy                                         |
| [`deploy/compose.sh`](../deploy/compose.sh)                       | `docker compose` on the server with the deployed image tag                                   |
| [`deploy/backup.sh`](../deploy/backup.sh)                         | Nightly `pg_dump` to the Storage Box                                                         |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | Deploys `main` after the Containers workflow has pushed its images                           |

Secrets live only in `/opt/montelingo/.env` on the server and in the GitHub `staging` environment. They never go into git, an issue, a PR or a chat.

## 1. First-time server setup

The full checklist, including the Hetzner Cloud Firewall, DNS, the email provider and monitoring, is [#77](https://github.com/Montelingo/montelingo/issues/77). The server-side commands:

```bash
# As root: Docker from Docker's repository (https://docs.docker.com/engine/install/ubuntu/), then
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -o deploy -g deploy /opt/montelingo

# As deploy: the GitHub Actions key (public half only)
install -d -m 700 ~/.ssh
echo "ssh-ed25519 AAAA... github-actions-deploy" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# The settings file, filled in from .env.production.example
cd /opt/montelingo
nano .env && chmod 600 .env
```

Generate the values in `.env` on the server:

- `POSTGRES_PASSWORD`: `openssl rand -hex 32`. Use hex because the password becomes part of the API's database URL.
- `STAGING_BASIC_AUTH_HASH`: `docker run --rm caddy:2.8.4-alpine caddy hash-password`. Put the hash in single quotes, since it contains `$`.

If the GHCR images are private, log the `deploy` user in once with a token that only has `read:packages`:

```bash
docker login ghcr.io -u <github-user>   # paste the token when asked
```

### GitHub

In **Settings → Environments → staging**:

| Name                 | Kind     | Value                                                             |
| -------------------- | -------- | ----------------------------------------------------------------- |
| `DEPLOY_HOST`        | secret   | Server IP or hostname                                             |
| `DEPLOY_USER`        | secret   | `deploy`                                                          |
| `DEPLOY_SSH_KEY`     | secret   | Private half of the deploy key                                    |
| `DEPLOY_KNOWN_HOSTS` | secret   | `ssh-keyscan -t ed25519 <host>`, checked against the server       |
| `STAGING_URL`        | variable | `https://<staging-domain>`, used for the post-deploy health check |

Until `DEPLOY_HOST` and `DEPLOY_USER` exist, the Deploy workflow skips with a warning instead of failing.

## 2. Deploying

Every push to `main` builds and pushes `ghcr.io/montelingo/montelingo-{api,web}:sha-<commit>` (Containers workflow). When that succeeds, the Deploy workflow:

1. checks out the same commit, so the compose file matches the images,
2. copies `compose.prod.yaml`, `Caddyfile` and `deploy/` to `/opt/montelingo`,
3. runs `IMAGE_TAG=sha-<commit> deploy/deploy.sh` over SSH, which pulls the images, runs migrations (the `migrate` service runs before the API starts) and waits up to 5 minutes for every service to be healthy,
4. checks `$STAGING_URL/api/v1/health/ready`.

A deploy causes a few seconds of downtime while containers restart.

Migrations must stay backward compatible with the previous release (add columns before using them, drop them a release later), because a rollback does not undo them.

## 3. Rolling back

Run **Actions → Deploy → Run workflow** with the commit SHA of an earlier `main` commit. Its images are already in GHCR. On the server, the previous tag is in `.image-tag.previous.env`:

```bash
cd /opt/montelingo
IMAGE_TAG=$(sed -n 's/^IMAGE_TAG=//p' .image-tag.previous.env) deploy/deploy.sh
```

Images younger than a week stay on the server, so a recent rollback doesn't need to pull.

## 4. Day to day

```bash
/opt/montelingo/deploy/compose.sh ps
/opt/montelingo/deploy/compose.sh logs -f --tail=100 api
/opt/montelingo/deploy/compose.sh restart web
cat /opt/montelingo/.image-tag.env          # what is deployed
```

Smoke test staging from your machine (the health endpoints are open, everything else needs basic auth):

```bash
API_URL=https://<staging-domain> WEB_URL=https://<staging-domain> \
  SMOKE_CURL_ARGS="--user montelingo:<password>" bash tests/e2e/smoke.sh
```

## 5. Backups and restore

`deploy/backup.sh` dumps the database in custom format into `/opt/montelingo/backups`, keeps 7 daily and 4 weekly (Sunday) dumps, and mirrors that folder to the Storage Box with `rsync` over SSH (port 23). The `deploy` user needs an SSH key that the Storage Box accepts.

Cron entry for `deploy` (`crontab -e`):

```cron
MAILTO=ops@example.com
15 3 * * * BACKUP_REMOTE=u123456@u123456.your-storagebox.de:montelingo-backups /opt/montelingo/deploy/backup.sh
```

Restore into a scratch database to check a dump, or into `montelingo` to recover:

```bash
cd /opt/montelingo
dump=backups/daily/montelingo-<timestamp>.dump      # or fetch one from the Storage Box
deploy/compose.sh exec -T postgres createdb -U montelingo restore_test
deploy/compose.sh exec -T postgres pg_restore --no-owner -U montelingo -d restore_test < "$dump"
deploy/compose.sh exec -T postgres psql -U montelingo -d restore_test -c 'select count(*) from users'
deploy/compose.sh exec -T postgres dropdb -U montelingo restore_test
```

To recover the live database, stop the API and web first (`deploy/compose.sh stop api web`), then drop and recreate `montelingo`, restore into it, and redeploy the current tag. The `-U` user is `POSTGRES_USER` from `.env`.

Hetzner server backups are a second layer, not a replacement: they snapshot the whole disk, including a database that may be mid-write.

## 6. Rotating secrets

| Secret              | Steps                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Basic-auth password | New hash into `.env`, then `deploy/compose.sh up -d caddy`                                                                                             |
| SMTP credentials    | Create new ones at the provider, update `.env`, `deploy/compose.sh up -d api`, then revoke the old ones                                                |
| Database password   | `deploy/compose.sh exec postgres psql -U montelingo -c "ALTER USER montelingo PASSWORD '<new>'"`, update `.env`, `deploy/compose.sh up -d migrate api` |
| Deploy SSH key      | Add the new public key to `authorized_keys`, update `DEPLOY_SSH_KEY`, run a deploy, then remove the old key                                            |
| GHCR read token     | `docker login ghcr.io` again with the new token, then revoke the old one                                                                               |

## 7. Limits of this setup

- One API process. The rate limiter is in memory (ADR 0004), so the API must not be scaled out until it moves to shared storage.
- Deploys restart containers in place, so there are a few seconds of downtime.
- PostgreSQL runs on the same server. Moving to a managed database means changing `MONTELINGO_DATABASE_URL` and removing the `postgres` service.
