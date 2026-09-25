# FamQuest

Self-hosted, zweisprachige (Deutsch/Englisch) Familien-App für ein Touchscreen-Display am Kühlschrank:
**Routinen → Aufgaben → Erledigung → Punkte → Belohnungen.**

Eine Installation gehört genau einer Familie. Alles läuft lokal in Docker, ohne Cloud-Dienste und
ohne externe CDNs. Die vollständige Spezifikation steht in [`docs/SPEC.md`](docs/SPEC.md).

> **Status:** Phase 1, Etappe 1 (Grundgerüst) ist fertig. Die App startet, spricht Deutsch und
> Englisch und prüft die Verbindung zur Datenbank. Die eigentlichen Funktionen folgen in den
> nächsten Etappen (siehe [Roadmap](#roadmap)).

## Features (Ziel Phase 1)

- Familienansicht mit einer Spalte pro Person, Aufgaben mit einem Tipp erledigen
- Routinen (täglich, bestimmte Wochentage, Mo–Fr, einmalig) und Tagesabschnitte
- Punkte als Buchungen, Tagesfortschritt, Belohnungen einlösen
- Elternbereich mit Eltern-PIN
- Profilbilder mit Zuschnitt, eine Farbe pro Person
- Deutsch und Englisch, weitere Sprachen über Übersetzungsdateien

## Voraussetzungen

- Docker mit Docker Compose v2

## Installation mit Docker

```sh
git clone https://github.com/craebby/FamQuest.git
cd FamQuest
cp .env.example .env
# In .env mindestens POSTGRES_PASSWORD setzen, z. B. mit: openssl rand -base64 24
docker compose up -d
```

Danach ist die App unter `http://<host>:8080` erreichbar. Beim Start des App-Containers laufen
die Datenbank-Migrationen automatisch.

Status prüfen:

```sh
docker compose ps                        # beide Dienste sollten "healthy" sein
curl http://localhost:8080/api/health    # {"status":"ok","database":"ok"}
```

Aktualisieren:

```sh
git pull
docker compose up -d --build
```

## Konfiguration

Die Konfiguration erfolgt ausschließlich über Umgebungsvariablen in `.env`. Alle Variablen sind in
[`.env.example`](.env.example) beschrieben.

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `POSTGRES_USER` | `famquest` | Datenbank-Benutzer |
| `POSTGRES_PASSWORD` | – (Pflicht) | Datenbank-Passwort |
| `POSTGRES_DB` | `famquest` | Name der Datenbank |
| `APP_PORT` | `8080` | Port auf dem Host |
| `LOG_LEVEL` | `info` | `critical`, `error`, `warning`, `info`, `debug` |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Vertrauenswürdige Reverse Proxies |

Daten liegen in zwei Docker-Volumes: `db-data` (PostgreSQL) und `uploads` (hochgeladene Bilder).

## Hinter einem Reverse Proxy

Die App wertet die Header `X-Forwarded-For` und `X-Forwarded-Proto` aus, aber nur von den Adressen
in `FORWARDED_ALLOW_IPS`. Beispiele:

- Proxy läuft auf demselben Host und verbindet sich zu `127.0.0.1:8080`: Standard beibehalten.
- Proxy läuft in einem anderen Container oder auf einem anderen Host: dessen IP-Adresse eintragen.
  `*` nur verwenden, wenn der App-Port nicht direkt erreichbar ist.

Die App muss auf einer eigenen (Sub-)Domain laufen, z. B. `familie.example.com`. Ein Unterpfad wie
`example.com/familie` wird nicht unterstützt.

## Sprachen

Deutsch ist die Standardsprache. Ohne gespeicherte Auswahl richtet sich die App nach der
Browsersprache.

Übersetzungen liegen in `frontend/src/locales/<sprache>/<bereich>.json`. So kommt eine neue Sprache
hinzu:

1. Den Ordner `frontend/src/locales/de` kopieren, z. B. nach `frontend/src/locales/fr`
2. Alle Texte übersetzen
3. Den Sprachcode in `SUPPORTED_LANGUAGES` in `frontend/src/i18n.ts` ergänzen

Ein Test (`npm test`) prüft, dass jede Sprache genau dieselben Schlüssel hat und kein Text leer ist.
Fehler liefert die API als Codes (z. B. `common.not_found`), das Frontend übersetzt sie unter
`errors.*`.

## Entwicklung

Für die lokale Entwicklung laufen Backend und Frontend direkt auf dem Rechner, nur PostgreSQL läuft in
Docker. Voraussetzungen: [uv](https://docs.astral.sh/uv/), Node.js ≥ 24, Docker.

Einmalig:

```sh
cp .env.example .env
# In .env: POSTGRES_PASSWORD setzen und die Zeilen COMPOSE_FILE und DB_PORT einkommentieren
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..
```

Starten (drei Terminals):

```sh
docker compose up -d db                              # PostgreSQL auf 127.0.0.1:5432
cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
cd frontend && npm run dev                           # http://localhost:5173
```

Vite leitet `/api` an das Backend auf Port 8000 weiter. Die API-Dokumentation steht unter
`http://localhost:8000/api/docs`.

Tests und Lint:

```sh
cd backend && uv run pytest                          # braucht die laufende Datenbank
cd backend && uv run ruff check . && uv run ruff format --check .
cd frontend && npm test && npm run lint && npm run typecheck
docker compose --profile test run --rm --build tests # Backend-Tests im Container
```

Die Backend-Tests legen eine eigene Datenbank `<POSTGRES_DB>_test` an und setzen sie bei jedem Lauf
neu auf.

Migrationen:

```sh
cd backend
uv run alembic revision --autogenerate -m "beschreibung"   # neue Migration aus den Modellen
uv run alembic upgrade head                                 # anwenden
```

Ein Test schlägt fehl, wenn Modelle geändert wurden, ohne eine Migration anzulegen.

## Architektur

```
Browser ──► Reverse Proxy (optional) ──► app (FastAPI, Port 8000) ──► db (PostgreSQL 16)
                                           ├─ /api/*   JSON-API
                                           ├─ /*       gebautes React-Frontend
                                           └─ /data/uploads (Volume)
```

| Ordner | Inhalt |
| --- | --- |
| `backend/` | FastAPI, SQLAlchemy 2, Alembic, pytest; Pakete mit uv |
| `frontend/` | React, Vite, TypeScript, Tailwind CSS, react-i18next, TanStack Query, Vitest |
| `docs/` | Spezifikation |

Das `Dockerfile` baut zuerst das Frontend und kopiert es dann in das Python-Image. Es entsteht ein
einziges App-Image, das als unprivilegierter Benutzer läuft.

## Roadmap

| Phase | Inhalt |
| --- | --- |
| 1 | Aufgabensystem (in Arbeit, siehe unten) |
| 2 | Google Kalender |
| 3 | Familien-Dashboard |
| 4 | Essensplanung |
| 5 | Einkaufsliste |

Etappen in Phase 1:

- [x] 1. Grundgerüst: Backend, Frontend mit i18n, Docker, Alembic, Healthchecks
- [ ] 2. First-Run-Setup, Login/Logout, Sperre der Registrierung, Eltern-PIN
- [ ] 3. Familienmitglieder mit Farbe und Profilbild
- [ ] 4. Aufgaben und Routinen im Elternbereich
- [ ] 5. Familienansicht
- [ ] 6. Punkte und Tagesfortschritt
- [ ] 7. Belohnungen
- [ ] 8. Feinschliff, Wochenübersicht, Backup/Restore
