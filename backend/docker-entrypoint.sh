#!/bin/sh
set -e

echo "Datenbank-Migrationen ausführen …"
alembic upgrade head

# FORWARDED_ALLOW_IPS wird von uvicorn direkt aus der Umgebung gelesen.
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --proxy-headers \
  --log-level "${LOG_LEVEL:-info}"
