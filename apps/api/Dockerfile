FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace

# Apply the latest Debian security patches for OS packages (e.g. gzip, perl,
# libpcre2, libsqlite3) so the base image does not carry known CVEs.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY pyproject.toml pyproject.toml
COPY uv.lock uv.lock
COPY apps/api/pyproject.toml apps/api/pyproject.toml

RUN uv sync --project apps/api --all-groups --locked

COPY apps/api apps/api

FROM base AS dev
CMD ["uv", "run", "--project", "apps/api", "fastapi", "dev", "apps/api/app/main.py", "--host", "0.0.0.0", "--port", "8001"]

FROM base AS runtime
CMD ["sh", "-c", "uv run --project apps/api alembic -c apps/api/alembic.ini upgrade head && uv run --project apps/api fastapi run apps/api/app/main.py --host 0.0.0.0 --port 8000"]
