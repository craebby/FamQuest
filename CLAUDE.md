# Family Dashboard

Self-hosted, zweisprachige (DE/EN) Familien-App für ein Touchscreen-Display am Kühlschrank:
Routinen → Aufgaben → Erledigung → Punkte → Belohnungen.

**Die vollständige Spezifikation steht in `docs/SPEC.md`. Lies sie vor jeder neuen Etappe.**
Bei Widersprüchen gilt `docs/SPEC.md`, beim Stack gilt diese Datei.

## Stack (festgelegt)

**Backend** (`backend/`)
- Python 3.12, FastAPI, Pydantic v2
- SQLAlchemy 2.x, Alembic für alle Schemaänderungen
- PostgreSQL 16
- Passwörter und Eltern-PIN: Argon2 (argon2-cffi)
- Sessions: serverseitige Sessions per HttpOnly/SameSite-Cookie, CSRF-Schutz für schreibende Requests
- Bildverarbeitung: Pillow (Uploads prüfen, neu kodieren, auf 512 × 512 skalieren)
- Tests: pytest gegen eine echte PostgreSQL-Testdatenbank
- Paketverwaltung: uv

**Frontend** (`frontend/`)
- React + Vite + TypeScript
- Tailwind CSS
- react-i18next, Übersetzungen in `frontend/src/locales/{de,en}/*.json`
- react-easy-crop für den Avatar-Cropper
- Icons: Iconify mit einem farbigen Emoji-Set (Fluent Emoji oder OpenMoji), **lokal gebündelt**, keine CDN-Abrufe zur Laufzeit
- TanStack Query für API-Zugriffe
- Tests: Vitest; Playwright für wenige End-to-End-Tests der Familienansicht

**Deployment**
- Ein App-Image (Multi-Stage-Build): Frontend wird gebaut, FastAPI liefert die statischen Dateien und die API unter `/api` aus
- `docker-compose.yml`: Dienste `app` und `db`, Volumes für PostgreSQL-Daten und Uploads, Healthchecks
- Alembic-Migrationen laufen beim Start des App-Containers automatisch
- Konfiguration nur über Umgebungsvariablen, dokumentiert in `.env.example`

## Regeln

- Nur die aktuelle Etappe umsetzen, nichts aus späteren Etappen oder Phasen vorziehen.
- Vor dem Implementieren einen kurzen Plan zeigen.
- Keine hartcodierten UI-Texte. Jeder neue Schlüssel wird **gleichzeitig in DE und EN** angelegt.
- Die API gibt Fehler als Codes zurück (z. B. `reward.insufficient_points`), das Frontend übersetzt sie.
- Berechtigungen immer serverseitig prüfen.
- Punkte nur über `PointTransaction` buchen, nie einen Zähler direkt ändern.
- „Heute“ immer in der Zeitzone der Familie berechnen, nicht in UTC.
- UX-Test für jede Alltags-Ansicht: Versteht ein Kind, das nicht lesen kann, sie über Symbole, Farben und Avatare? Kommt ein wenig technikaffiner Erwachsener ohne Erklärung zurecht?
- Keine Secrets committen, `.env` steht in `.gitignore`.
- Nach jeder Etappe: `docker compose build`, `docker compose up -d`, Tests ausführen, Fehler beheben, README aktualisieren, committen.
- Die README gibt es zweimal: `README.md` (Englisch, Hauptdatei) und `README.de.md` (Deutsch). Beide immer gemeinsam aktualisieren.

## Etappen (Phase 1)

1. Grundgerüst: Repo-Struktur, Backend, Frontend mit i18n, Dockerfile, docker-compose, Alembic, Healthchecks, `.env.example`, `.gitignore`, README
2. First-Run-Setup, Login/Logout, Sperre der Registrierung, Eltern-PIN
3. Familienmitglieder: Name, Rolle, Farbe, Avatar-Upload mit Cropper
4. Aufgaben und Routinen im Elternbereich: Icon-Picker, Punkte, Wiederholung, Tagesabschnitt, Zuordnung
5. Familienansicht: Spalten pro Person, Antippen erledigt, erneutes Tippen macht rückgängig, Navigationsleiste mit Symbolen
6. Punkte: Buchungen, Punktestand, Tagesfortschritt, Feedback-Animation
7. Belohnungen: Verwaltung, Einlösen, Historie
8. Feinschliff: Wochenübersicht, Test auf echtem Display, Backup/Restore im README

## Etappen (Phase 2: Google Kalender)

Entschieden: Anbindung per Google-OAuth (nur lesend, `calendar.readonly`); iCal/ICS und andere
Anbieter erst später. Hauptansicht am Display: Woche.

1. Google-Konto verbinden: OAuth mit state + PKCE, Tokens verschlüsselt, Refresh, Trennen, Abschnitt im Elternbereich
2. Kalender abrufen, auswählen und einer Person oder „Familie“ zuordnen
3. Synchronisation im Hintergrund (inkrementell), Serientermine, ganztägige Termine, Fehlerbehandlung
4. Kalenderansicht (Woche) in der Navigationsleiste, Termine in Personenfarbe mit Avatar
5. Feinschliff

## Befehle

Lokal entwickeln (uv und Node sind installiert, nur PostgreSQL läuft in Docker; `.env` setzt
`COMPOSE_FILE` so, dass der DB-Port auf 127.0.0.1 veröffentlicht wird):

- DB starten: `docker compose up -d db`
- Backend: `cd backend && uv run uvicorn app.main:app --reload` (Port 8000)
- Frontend: `cd frontend && npm run dev` (Port 5173, leitet `/api` weiter)
- Migration anlegen: `cd backend && uv run alembic revision --autogenerate -m "..."`
- Migration anwenden: `cd backend && uv run alembic upgrade head`
- Backend-Tests: `cd backend && uv run pytest` (legt DB `<POSTGRES_DB>_test` neu an)
- Backend-Lint: `cd backend && uv run ruff check . && uv run ruff format --check .`
- Frontend-Tests/Lint: `cd frontend && npm test && npm run lint && npm run typecheck`
  (Lint prüft auch Prettier; formatieren mit `npm run format`)
- E2E (Playwright, braucht laufende DB): `cd frontend && npm run e2e`
  (baut das Frontend, legt DB `<POSTGRES_DB>_e2e` neu an, App auf Port 8001)
- Gesamtes Image: `docker compose up -d --build`, Tests im Container:
  `docker compose --profile test run --rm --build tests`

Hinweis: Die Shell ist fish. Falls Docker „permission denied“ meldet, ist die Gruppe `docker` in der
Sitzung noch nicht aktiv; dann Befehle als Bash-Skript über `echo "bash skript.sh" | newgrp docker`
ausführen.
