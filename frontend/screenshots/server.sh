#!/usr/bin/env bash
# Startet die App mit Demodaten für die Screenshots: frische Datenbank "<POSTGRES_DB>_demo_<lang>"
# auf dem lokalen PostgreSQL (docker compose up -d db), Beispielfamilie aus app/demo.py und
# einer festen Uhr. Aufruf: server.sh <sprache> <port> <wochentag> <uhrzeit>; das Frontend ist gebaut.
set -euo pipefail

LANGUAGE="$1"
PORT="$2"
WEEKDAY="$3"
AT="$4"
FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$FRONTEND_DIR/../backend"

cd "$BACKEND_DIR"
DEMO_DB="$(uv run python -c 'from app.config import Settings; print(Settings().postgres_db)')_demo_$LANGUAGE"
uv run python - "$DEMO_DB" <<'PY'
import sys

from sqlalchemy import create_engine, text

from app.config import Settings

engine = create_engine(Settings().database_url("postgres"), isolation_level="AUTOCOMMIT")
with engine.connect() as conn:
    conn.execute(text(f'DROP DATABASE IF EXISTS "{sys.argv[1]}" WITH (FORCE)'))
    conn.execute(text(f'CREATE DATABASE "{sys.argv[1]}"'))
PY

export POSTGRES_DB="$DEMO_DB"
export STATIC_DIR="$FRONTEND_DIR/dist"
export UPLOAD_DIR="$(mktemp -d -t famquest-demo-uploads-XXXXXX)"
# Ohne Google-Zugangsdaten und Hintergrund-Abgleich bleiben die Demo-Termine unangetastet.
export GOOGLE_CLIENT_ID="" GOOGLE_CLIENT_SECRET="" CALENDAR_SYNC_MINUTES=0
uv run alembic upgrade head
uv run python -m app.demo seed --lang "$LANGUAGE" --weekday "$WEEKDAY" --at "$AT"
exec uv run python -m app.demo serve --weekday "$WEEKDAY" --at "$AT" --port "$PORT"
