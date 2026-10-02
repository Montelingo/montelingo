FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_CACHE_DIR=/tmp/.cache/uv \
    UV_NO_SYNC=1


RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*


COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

WORKDIR /workspace

COPY pyproject.toml uv.lock ./
COPY apps/api/pyproject.toml apps/api/

FROM base AS dev
RUN uv sync --project apps/api --locked
COPY apps/api apps/api
CMD ["uv", "run", "--project", "apps/api", "fastapi", "dev", "apps/api/app/main.py", "--host", "0.0.0.0", "--port", "8001"]

FROM base AS runtime
RUN uv sync --project apps/api --no-dev --locked

ENV PATH="/workspace/.venv/bin:$PATH"

COPY apps/api apps/api

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /workspace

USER appuser

CMD ["sh", "-c", "alembic -c apps/api/alembic.ini upgrade head && fastapi run apps/api/app/main.py --host 0.0.0.0 --port 8000"]
