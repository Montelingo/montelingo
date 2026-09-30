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

COPY .python-version .python-version
COPY pyproject.toml pyproject.toml
COPY uv.lock uv.lock
COPY apps/api/pyproject.toml apps/api/pyproject.toml

FROM base AS dev
RUN uv sync --project apps/api --all-groups --locked
COPY apps/api apps/api
CMD ["uv", "run", "--project", "apps/api", "fastapi", "dev", "apps/api/app/main.py", "--host", "0.0.0.0", "--port", "8001"]

FROM base AS runtime
RUN uv sync --project apps/api --no-dev --locked

COPY apps/api apps/api

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /workspace

USER appuser

CMD ["uv", "run", "--project", "apps/api", "fastapi", "run", "apps/api/app/main.py", "--host", "0.0.0.0", "--port", "8000"]
