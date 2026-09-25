# syntax=docker/dockerfile:1

# --- 1. Frontend bauen -----------------------------------------------------------
FROM node:26-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. Laufzeit: FastAPI liefert API und Frontend aus ----------------------------
FROM python:3.12-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 \
    PATH=/app/.venv/bin:$PATH \
    STATIC_DIR=/app/static \
    UPLOAD_DIR=/data/uploads

RUN groupadd --system app && useradd --system --gid app --home /app app \
    && mkdir -p /data/uploads && chown app:app /data/uploads

WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev
COPY backend/ ./
COPY --from=frontend /frontend/dist ./static

USER app
EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# --- 3. Tests (nur für docker compose --profile test) ------------------------------
FROM runtime AS test
USER root
RUN uv sync --locked
USER app
ENTRYPOINT []
CMD ["pytest", "-p", "no:cacheprovider"]
