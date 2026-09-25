# FamQuest

Self-hosted, zweisprachige (Deutsch/Englisch) Familien-App für ein Touchscreen-Display am Kühlschrank:
**Routinen → Aufgaben → Erledigung → Punkte → Belohnungen.**

Eine Installation gehört genau einer Familie. Alles läuft lokal in Docker, ohne Cloud-Dienste und
ohne externe CDNs. Die vollständige Spezifikation steht in [`docs/SPEC.md`](docs/SPEC.md).

> **Status:** Phase 1, Etappe 7 ist fertig: Einrichtung beim ersten Start, Anmeldung,
> Elternbereich mit Eltern-PIN, Familienmitglieder mit Farbe und Profilbild, Aufgaben und Routinen
> mit Vorlagen, die Familienansicht zum Abhaken, Punkte mit Tagesfortschritt, Kontrolle durch die
> Eltern, Belohnungen für Kinder und die faire Verteilung unter Erwachsenen. Als Nächstes folgt der
> Feinschliff (siehe [Roadmap](#roadmap)).

## Features (Ziel Phase 1)

- Familienansicht mit einer Spalte pro Person, Aufgaben mit einem Tipp erledigen
- Routinen (täglich, bestimmte Wochentage, Mo–Fr, einmalig) und Tagesabschnitte
- Punkte als Buchungen, Tagesfortschritt, manuelle Gutschriften
- Belohnungen je Kind aus einer Vorschlagsliste, am Display einlösen
- Kontrolle durch die Eltern für ausgewählte Aufgaben
- Faire Verteilung: Anteil jedes Erwachsenen an den Aufgaben der Woche
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

## Erster Start

Beim ersten Aufruf erscheint die Einrichtung: Sprache, Familienname, E-Mail, Passwort und die
Eltern-PIN. Das erste Konto wird Administrator. Danach ist die Einrichtung dauerhaft gesperrt;
weitere Konten lassen sich nicht über die Oberfläche registrieren.

- Das Display bleibt dauerhaft angemeldet (die Anmeldung verlängert sich bei Nutzung, bis zu einem
  Jahr ohne Nutzung).
- Der Elternbereich (Zahnrad) ist zusätzlich durch die Eltern-PIN geschützt. Nach 2 Minuten ohne
  Eingabe kehrt das Display zur Familienansicht zurück und sperrt ihn wieder.
- Die PIN lässt sich im Elternbereich ändern oder abschalten. PIN vergessen: Mit dem Passwort des
  Kontos eine neue PIN festlegen.
- Nach 5 falschen Versuchen (Passwort oder PIN) sind weitere Versuche 15 Minuten lang gesperrt.

## Familienmitglieder

Im Elternbereich unter „Familienmitglieder“ legt ihr alle Personen des Haushalts an: Name, Rolle
(Elternteil oder Kind), Farbe und optional ein Foto. Kinder brauchen kein Konto und kein Passwort.

- Jede Person hat eine eigene Farbe (Orange, Blau, Lila, Grün, Rot, Türkis, Gelb). Vergebene
  Farben sind ausgegraut; es sind daher höchstens sieben Personen möglich.
- Foto wählen (am Smartphone auch direkt mit der Kamera), im Kreis verschieben und zoomen,
  übernehmen. Ohne Foto zeigt der Avatar die Initiale auf der Personenfarbe.
- Das Bild wird im Browser zugeschnitten und vom Server geprüft (nur JPEG, PNG oder WebP, höchstens
  5 MB), auf 512 × 512 px verkleinert und als WebP neu gespeichert. Metadaten wie GPS-Daten gehen
  dabei verloren. Die Bilder liegen im Volume `uploads` und sind nur mit Anmeldung abrufbar.

## Aufgaben und Routinen

Im Elternbereich unter „Aufgaben“ legt ihr fest, wer was wann erledigt. Eine Aufgabe hat:

- **Symbol**: aus einem mitgelieferten Katalog von gut 200 farbigen Emoji-Symbolen
  ([Fluent Emoji](https://github.com/microsoft/fluentui-emoji), MIT-Lizenz), sortiert nach
  Kategorien wie Körperpflege, Anziehen, Schule oder Haushalt. Die Suche versteht Deutsch und
  Englisch („Zahn“ und „tooth“ finden dieselbe Zahnbürste). Solange ihr kein Symbol selbst wählt,
  schlägt die App eins passend zum Titel vor.
- **Titel** und optional eine Beschreibung
- **Punkte**: 0 bis 1000
- **Für wen**: eine oder mehrere Personen; jede Person erledigt die Aufgabe und bekommt die Punkte
  für sich. Mit **„Einer für alle“** (ab zwei Personen) gilt sie dagegen für alle als erledigt,
  sobald eine Person sie erledigt hat, etwa „Bad putzen“ bei Mama und Papa. Die anderen Spalten
  zeigen den Avatar der Person, die es war; Punkte und der Anteil an der Woche zählen für sie.
- **Wie oft**: jeden Tag, an bestimmten Wochentagen (mit Schnellauswahl Mo–Fr oder Wochenende),
  einmal an einem Datum oder **flexibel** (siehe unten)
- **Tageszeit**: morgens, mittags, nachmittags, abends oder jederzeit
- **Farbe der Karte**: standardmäßig die Farbe der jeweiligen Person
- **Aktiv**: inaktive Aufgaben bleiben gespeichert, erscheinen aber nicht in der Familienansicht
- **Eltern prüfen**: Punkte gibt es erst, wenn ihr die Erledigung bestätigt habt (siehe
  [Kontrolle durch die Eltern](#kontrolle-durch-die-eltern))

Beim Anlegen füllt **„Aus Vorlagen wählen“** das Formular mit einem Tipp vor. Es gibt zwei
Gruppen: „Kinder“ (Zähne putzen, Anziehen, Spielzeug aufräumen, Tisch abräumen …) und „Haushalt“ für
die Care-Arbeit der Erwachsenen (Kochen, Einkaufen, Wäsche, Kinder bringen und abholen, ins Bett
bringen, Termine …). Haushaltsvorlagen sind „Einer für alle“; Bad putzen, Staubsaugen, Einkaufen
und Termine sind flexibel mit etwa einer Woche. Alles bleibt danach änderbar. Die Vorlagen stehen in
`frontend/src/pools/tasks.ts`, ihre Titel in `frontend/src/locales/<sprache>/pool.json`.

**Flexible Aufgaben** haben keinen festen Tag, sondern einen Rhythmus: alle X Tage (Schnellwahl
alle 2 Tage, jede Woche, alle 2 Wochen, jeden Monat) und ein Datum für die erste Fälligkeit. Ab dann
steht die Aufgabe in der Familienansicht, bis sie erledigt ist; ist sie überfällig, zeigt die Karte
einen roten Hinweis mit Wecker („seit 3 Tagen fällig“). Danach ist sie X Tage nach der Erledigung
wieder dran. Vorher steht sie klein unter **„Demnächst“** und kann schon früher erledigt werden,
der Rhythmus beginnt dann ab diesem Tag neu. „Demnächst“ zählt nicht zum Tagesfortschritt.

Die Liste lässt sich mit einem Tipp auf eine Person filtern. Neue Aufgaben sind dann für diese
Person vorausgewählt. Der Schalter in jeder Zeile setzt eine Aufgabe aktiv oder inaktiv. Wird eine
Person gelöscht, bleiben ihre Aufgaben erhalten; Aufgaben ohne Person sind in der Liste markiert.

Die Symbole sind beim Build ins Frontend eingebettet (nur die Katalog-Symbole, nicht das ganze Set).
Katalog erweitern: Namen aus dem Set `fluent-emoji-flat` (z. B. auf
[icon-sets.iconify.design](https://icon-sets.iconify.design/fluent-emoji-flat/)) in
`frontend/src/icons/categories.json` eintragen und in `frontend/src/locales/<sprache>/icons.json`
Suchbegriffe ergänzen (der erste Begriff ist die Bezeichnung). Tests prüfen, dass jedes Symbol
existiert und in jeder Sprache eindeutig benannt ist.

## Familienansicht

Die Startseite zeigt alle Familienmitglieder nebeneinander, jede Person mit großem Avatar und ihren
heutigen Aufgaben. Niemand muss sich an- oder ummelden: Wem eine Aufgabe gehört, ergibt sich aus der
Spalte.

- **Ein Tipp** auf eine Aufgabenkarte erledigt sie für diese Person (Haken, Einfärbung in der
  Personenfarbe). **Nochmal tippen** macht es rückgängig. Jede Aufgabe kann pro Person und Tag nur
  einmal erledigt sein, auch bei Doppel-Tipps.
- Die Aufgaben sind nach **Tageszeit** gruppiert (Sonnenaufgang, Sonne, Sonne mit Wolke, Mond; dazu
  „Jederzeit“). Der aktuelle Abschnitt ist farbig hervorgehoben. Ist ein Abschnitt komplett
  erledigt, klappt er zu einer Zeile mit Haken zusammen und lässt sich mit einem Tipp wieder öffnen.
  Tageszeiten: morgens bis 11 Uhr, mittags bis 14 Uhr, nachmittags bis 18 Uhr, danach abends.
- Ein Tipp auf den **Avatar** öffnet die Personenansicht mit denselben Aufgaben in groß. Nach einer
  Minute ohne Eingabe kehrt das Display zur Familienansicht zurück.
- Bei vielen Personen oder schmalem Bildschirm lassen sich die Spalten seitlich wischen. Am
  Smartphone steht eine Person pro Seite, oben eine Avatar-Leiste zum Wechseln.
- Die **Navigationsleiste** (links, am Smartphone unten) führt mit Symbolen zu „Heute“ (Stern), zu
  den Belohnungen (Geschenk) und zu den Einstellungen (Zahnrad, Elternbereich mit PIN). Eine rote
  Zahl am Zahnrad zeigt, wie viele Erledigungen auf die Kontrolle der Eltern warten.

„Heute“ rechnet der Server immer in der Zeitzone der Familie. Die Ansicht lädt sich jede Minute neu,
damit Tageswechsel und Änderungen aus dem Elternbereich ankommen.

## Punkte

Unter jedem Avatar zeigt eine **Sterne-Reihe** den Tagesfortschritt (ein Stern pro Aufgabe, erledigte
leuchten; ab 9 Aufgaben ein Balken). Daneben stehen die **heute verdienten Punkte** (Stern) und der
**Punktestand** (Pokal). Beim Abhaken schwebt kurz „+2 ⭐“ über der Karte. Wer in den
Systemeinstellungen reduzierte Bewegung eingestellt hat, sieht die Anzeige ohne Animation.

Punkte werden nie als Zähler gespeichert, sondern als **Buchungen**; der Punktestand ist ihre Summe.

- Erledigen bucht den Punktwert der Aufgabe, Rückgängig bucht genau diesen Betrag zurück
  (Gegenbuchung), auch wenn der Punktwert inzwischen geändert wurde.
- Pro Aufgabe, Person und Tag gibt es höchstens eine Erledigung (Datenbank-Constraint). Nur die
  Anfrage, die sie tatsächlich anlegt oder löscht, bucht; Doppel-Tipps bringen also keine doppelten
  Punkte.
- Buchungen werden nie geändert oder gelöscht. Wird eine Aufgabe gelöscht, bleiben ihre Buchungen
  mit dem damaligen Titel erhalten. Nur wenn eine Person gelöscht wird, verschwinden auch ihre
  Buchungen.
- Aufgaben mit 0 Punkten erzeugen keine Buchung.

Im Elternbereich zeigt der Abschnitt **„Punkte“** den Stand jeder Person. Ein Tipp auf die Person
öffnet ihre **Buchungshistorie** (neueste zuerst, ältere per „Ältere Buchungen laden“) und ein
Formular, um Punkte mit Begründung **gutzuschreiben oder abzuziehen** (1 bis 1000). Ein Abzug darf
den Punktestand nicht unter 0 drücken.

Erwachsene sammeln keine Punkte (siehe [Faire Verteilung](#faire-verteilung)); ihre Karten zeigen
keine Punktwerte.

## Kontrolle durch die Eltern

Für Aufgaben wie „Zimmer aufräumen“ lässt sich im Editor **„Eltern prüfen“** einschalten. Das Kind
tippt die Karte wie gewohnt an; statt des Hakens erscheint eine **Sanduhr**, und es gibt noch keine
Punkte. Am Zahnrad der Navigationsleiste steht, wie viele Erledigungen warten.

Im Elternbereich (nach PIN) steht dann ganz oben **„Zu prüfen“**:

- **Passt** bestätigt die Erledigung und bucht die Punkte, genau einmal und für den Tag der
  Erledigung. Mehrere Einträge lassen sich mit „Alle bestätigen“ auf einmal bestätigen.
- **Nochmal** lehnt ab: Die Erledigung wird entfernt, die Aufgabe ist wieder offen.

Auch Erledigungen früherer Tage bleiben prüfbar. Macht das Kind die Erledigung vor der Kontrolle
selbst rückgängig, wird nichts gebucht.

## Belohnungen

Belohnungen gibt es **nur für Kinder**, und jedes Kind hat seine eigenen. So passen Auswahl und
Kosten zum Alter. Im Elternbereich unter „Belohnungen“ wählt ihr ein Kind und dann:

- **Aus Vorschlägen wählen**: eine Liste mit gut 30 Belohnungen in drei Größen (klein etwa 5–20,
  mittel 20–50, groß 50–100 Punkte), z. B. Eis, eine Geschichte mehr, 15 Minuten länger
  aufbleiben, Filmabend mit Popcorn, Zoo oder Freizeitpark. Mehrere lassen sich auf einmal
  übernehmen, schon vorhandene sind markiert.
- **Eigene Belohnung**: Name, Symbol (Kategorie „Belohnungen“ im Katalog), Kosten (1 bis 1000),
  Beschreibung.

Kosten und Namen lassen sich danach ändern. Inaktive Belohnungen sind am Display nicht zu sehen.
Darunter steht, was das Kind zuletzt eingelöst hat.

Am Display führt das **Geschenk** in der Navigationsleiste zur Auswahl der Kinder, ein Tipp auf den
Avatar zu ihren Belohnungskarten (die Personenansicht eines Kindes zeigt sie ebenfalls):

- Mit genug Punkten zeigt die Karte **„Einlösen“**, sonst **„Noch 8 Punkte nötig“** mit einem Balken.
- Nach „Einlösen“ fragt eine große Karte mit ✓ und ✗ nach. Bestätigt, bucht der Server die Kosten ab.
  Er prüft Punktestand und Kosten dabei in einer Transaktion, der Stand kann nie negativ werden.
  Danach gibt es eine kurze Feier.

Die Einlösung speichert Name, Symbol und Kosten. Die Historie stimmt also auch, wenn die Belohnung
später geändert oder gelöscht wird. Die Vorschläge stehen in `frontend/src/pools/rewards.ts`.

## Faire Verteilung

Erwachsene bekommen keine Belohnungen. Ihre Spalte zeigt stattdessen, welchen **Anteil** der in
dieser Woche (Montag bis Sonntag, Zeitzone der Familie) von Erwachsenen erledigten Aufgaben sie
übernommen haben, z. B. 40 % und 60 %, als geteilten Balken in den Personenfarben. Die
Personenansicht zeigt zusätzlich alle Anteile mit der Zahl der Aufgaben. Gezählt wird die Anzahl
erledigter Aufgaben, Punktwerte spielen keine Rolle. Das ist bewusst kein Wettbewerb, sondern soll
helfen, die Arbeit fair zu verteilen. Mit nur einem Erwachsenen entfällt die Anzeige.

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

Die App wertet `X-Forwarded-For` und `X-Forwarded-Proto` aus, aber nur von den Adressen in
`FORWARDED_ALLOW_IPS`. Das ist wichtig: Nur wenn die App erkennt, dass sie per HTTPS aufgerufen
wird, bekommt das Session-Cookie das `Secure`-Flag.

Empfohlene Einrichtung, wenn der Proxy auf demselben Host läuft:

```sh
# .env
APP_PORT=127.0.0.1:8080       # App nur für den lokalen Proxy erreichbar
FORWARDED_ALLOW_IPS=*         # vertretbar, weil niemand sonst direkt zugreifen kann
```

Läuft der Proxy auf einem anderen Rechner, dessen IP-Adresse in `FORWARDED_ALLOW_IPS` eintragen.
Hinweis: Durch das Docker-Port-Mapping sieht die App als Absender die Adresse des Docker-Netzwerks
(z. B. `172.18.0.1`), nicht `127.0.0.1`. Der Standardwert `127.0.0.1` gilt daher nur ohne Proxy.

Der Proxy muss den ursprünglichen `Host`-Header weitergeben (Caddy und Traefik tun das
automatisch, bei nginx `proxy_set_header Host $host;`). Setup und Login prüfen damit, dass die
Anfrage von der eigenen Seite kommt.

Die App muss auf einer eigenen (Sub-)Domain laufen, z. B. `familie.example.com`. Ein Unterpfad wie
`example.com/familie` wird nicht unterstützt.

## Sprachen

Deutsch ist die Standardsprache. Ohne gespeicherte Auswahl richtet sich die App nach der
Browsersprache.

Übersetzungen liegen in `frontend/src/locales/<sprache>/<bereich>.json` (`common.json` für die
Oberfläche, `icons.json` für die Suchbegriffe der Symbole, `pool.json` für die Vorschläge von
Aufgaben und Belohnungen). So kommt eine neue Sprache hinzu:

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
cd frontend && npm run format                      # Formatierung (Prettier)
docker compose --profile test run --rm --build tests # Backend-Tests im Container
```

End-to-End-Tests der Familienansicht (Playwright, Chromium):

```sh
cd frontend && npx playwright install chromium       # einmalig
cd frontend && npm run e2e                           # braucht die laufende Datenbank
```

`npm run e2e` baut das Frontend, legt eine frische Datenbank `<POSTGRES_DB>_e2e` an und startet die
App auf Port 8001. Getestet wird der erste Meilenstein im Browser: Setup, Kind und Aufgabe anlegen,
Aufgabe antippen und wieder zurücknehmen, dazu die Personenansicht am Smartphone.

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
| `frontend/` | React, Vite, TypeScript, Tailwind CSS, react-i18next, TanStack Query, Vitest, Playwright |
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
- [x] 2. First-Run-Setup, Login/Logout, Sperre der Registrierung, Eltern-PIN
- [x] 3. Familienmitglieder mit Farbe und Profilbild
- [x] 4. Aufgaben und Routinen im Elternbereich
- [x] 5. Familienansicht
- [x] 6. Punkte und Tagesfortschritt
- [x] 7. Belohnungen, Aufgaben-Vorlagen, Kontrolle durch die Eltern, faire Verteilung
- [ ] 8. Feinschliff, Wochenübersicht, Backup/Restore
