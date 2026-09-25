#!/usr/bin/env bash
# Startet die App für die End-to-End-Tests: gebautes Frontend + Backend auf Port 8001,
# mit frischer Datenbank "<POSTGRES_DB>_e2e" auf dem lokalen PostgreSQL (docker compose up -d db).
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$FRONTEND_DIR/../backend"

npm --prefix "$FRONTEND_DIR" run build

cd "$BACKEND_DIR"
E2E_DB="$(uv run python -c 'from app.config import Settings; print(Settings().postgres_db)')_e2e"
uv run python - "$E2E_DB" <<'PY'
import sys

from sqlalchemy import create_engine, text

from app.config import Settings

engine = create_engine(Settings().database_url("postgres"), isolation_level="AUTOCOMMIT")
with engine.connect() as conn:
    conn.execute(text(f'DROP DATABASE IF EXISTS "{sys.argv[1]}" WITH (FORCE)'))
    conn.execute(text(f'CREATE DATABASE "{sys.argv[1]}"'))
PY

export POSTGRES_DB="$E2E_DB"
export STATIC_DIR="$FRONTEND_DIR/dist"
export UPLOAD_DIR="$(mktemp -d -t famquest-e2e-uploads-XXXXXX)"
uv run alembic upgrade head
exec uv run uvicorn app.main:app --host 127.0.0.1 --port "${E2E_PORT:-8001}"
