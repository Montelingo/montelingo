FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_CACHE_DIR=/tmp/.cache/uv

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /workspace

COPY pyproject.toml uv.lock ./
COPY apps/api/pyproject.toml apps/api/

FROM base AS dev
RUN uv sync --project apps/api --locked
COPY apps/api apps/api
CMD ["uv", "run", "--project", "apps/api", "fastapi", "dev", "apps/api/app/main.py", "--host", "0.0.0.0", "--port", "8001"]

FROM base AS runtime
RUN uv sync --project apps/api --no-dev --locked

COPY apps/api apps/api

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /workspace

USER appuser

CMD ["sh", "-c", "uv run --frozen --project apps/api alembic -c apps/api/alembic.ini upgrade head && uv run --frozen --project apps/api fastapi run apps/api/app/main.py --host 0.0.0.0 --port 8000"]
