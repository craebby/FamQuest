#!/usr/bin/env bash
# Sichert Datenbank und Bilder von FamQuest.
#   scripts/backup.sh [ZIELORDNER] [TAGE]
# ZIELORDNER: Standard ./backup; TAGE: ältere Backups löschen (Standard 30, 0 = nie).
# Aufruf im Projektordner oder von überall (das Skript wechselt selbst dorthin).
set -euo pipefail

cd "$(dirname "$0")/.."
TARGET="${1:-backup}"
KEEP_DAYS="${2:-30}"
STAMP="$(date +%F-%H%M)"
mkdir -p "$TARGET"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "$TARGET/famquest-$STAMP.dump"
docker compose exec -T app tar czf - -C /data uploads > "$TARGET/uploads-$STAMP.tar.gz"

if [ "$KEEP_DAYS" -gt 0 ]; then
  find "$TARGET" -maxdepth 1 -type f \( -name 'famquest-*.dump' -o -name 'uploads-*.tar.gz' \) \
    -mtime +"$KEEP_DAYS" -delete
fi
echo "Backup gespeichert: $TARGET/famquest-$STAMP.dump, $TARGET/uploads-$STAMP.tar.gz"
