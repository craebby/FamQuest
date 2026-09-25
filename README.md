# FamQuest

**English** · [Deutsch](README.de.md)

A self-hosted, bilingual (English/German) family app for a touchscreen display on the fridge:
**routines → tasks → done → points → rewards.**

One installation belongs to exactly one family. Everything runs locally in Docker, without cloud
services and without external CDNs. The full specification (in German) is in
[`docs/SPEC.md`](docs/SPEC.md).

> **Status:** version 0.x (alpha). Phase 1 is feature-complete: first-run setup, sign-in, parents'
> area with PIN, family members with colour and photo, tasks and routines with templates, the
> family view for ticking things off, points with daily progress, parent checks, rewards for
> children, fair sharing between adults and family settings. What's left before 1.0 is the test
> on a real display (see [Roadmap](#roadmap)).

## Features

- Family view with one column per person; complete a task with a single tap
- Routines (daily, specific weekdays, Mon–Fri, once, flexible "about every X days") and times of day
- "One for all" tasks: done by one adult, done for everyone
- Points as ledger entries, daily progress, manual credits
- Rewards per child from a list of suggestions, redeemed on the display
- Parent checks for selected tasks
- Fair sharing: each adult's share of the week's tasks
- Parents' area protected by a PIN
- Profile photos with cropping, one colour per person
- English and German; more languages via translation files

## Quick start on a Docker host

You only need Git and Docker with the Compose plugin on the host. The image builds frontend and
backend itself (multi-stage build), so no Node.js or Python is needed.

```sh
git clone https://github.com/craebby/FamQuest.git
cd FamQuest
cp .env.example .env
# Generate a random database password and write it into .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
docker compose up -d --build
```

The first build takes a few minutes. Afterwards the app is available at `http://<host>:8080`
(port configurable via `APP_PORT` in `.env`). Database migrations run automatically when the app
container starts. Keep `.env` safe: it holds the database password and is needed for restores.

Check the status:

```sh
docker compose ps                        # both services should be "healthy"
curl http://localhost:8080/api/health    # {"status":"ok","database":"ok"}
```

Update:

```sh
git pull
docker compose up -d --build
```

On macOS, use `sed -i ''` instead of `sed -i`, or simply edit `.env` by hand.

## First start

On first visit the setup appears: language, family name, e-mail, password (entered twice) and the
parents' PIN.
The first account becomes the administrator. After that, setup is locked for good; no further
accounts can be registered through the interface.

- The display stays signed in permanently (the session is extended with every use, up to one year
  without use).
- The parents' area (gear icon) is additionally protected by the parents' PIN. After 2 minutes
  without input the display returns to the family view and locks it again.
- The PIN can be changed or switched off in the parents' area. Forgot the PIN? Set a new one with
  the account password.
- After 5 wrong attempts (password or PIN), further attempts are blocked for 15 minutes.
- Family name, family language and time zone can be changed under "Family" in the parents' area.
  The time zone decides when a new day starts (default: Europe/Berlin).

## Family members

Under "Family members" in the parents' area you add everyone in the household: name, role (parent
or child), colour and optionally a photo. Children need no account and no password.

- Each person has their own colour (orange, blue, purple, green, red, teal, yellow). Taken colours
  are greyed out, so at most seven people are possible for now.
- **Change order** sets the order in which people appear everywhere (columns, filters, rewards):
  with arrow buttons, or by dragging with the mouse.
- Pick a photo (on a phone also straight from the camera), move and zoom it in the circle, confirm.
  Without a photo, the avatar shows the initial on the person's colour.
- The image is cropped in the browser and checked by the server (JPEG, PNG or WebP only, at most
  5 MB), scaled to 512 × 512 px and re-encoded as WebP. Metadata such as GPS data is dropped. The
  images live in the `uploads` volume and can only be fetched when signed in.

## Tasks and routines

Under "Tasks" in the parents' area you decide who does what and when. A task has:

- **Icon**: from a bundled catalogue of about 200 colourful emoji icons
  ([Fluent Emoji](https://github.com/microsoft/fluentui-emoji), MIT licence), sorted into
  categories such as personal care, getting dressed, school or household. Search understands
  English and German ("tooth" and "Zahn" find the same toothbrush). Until you pick an icon
  yourself, the app suggests one that matches the title.
- **Title** and an optional description
- **Points**: 0 to 1000
- **For whom**: one or more people; each person completes the task and earns the points for
  themselves. With **"One for all"** (two or more people) it counts as done for everyone as soon
  as one person has done it, e.g. "Clean the bathroom" for Mum and Dad. The other columns show the
  avatar of whoever did it; points and the weekly share count for that person.
- **How often**: every day, on specific weekdays (with shortcuts Mon–Fri or weekend), once on a
  date, or **flexible** (see below)
- **Time of day**: morning, midday, afternoon, evening or anytime
- **Card colour**: the person's colour by default
- **Active**: inactive tasks are kept but don't appear in the family view
- **Parents check**: points are only given once you have confirmed the task (see
  [Parent checks](#parent-checks))

When creating a task, **"Choose from templates"** fills in the form with one tap. There are two
groups: "Children" (brush teeth, get dressed, tidy up toys, clear the table …) and "Household" for
the adults' care work (cooking, shopping, laundry, taking the kids and picking them up, bedtime,
appointments …). Household templates are "One for all"; cleaning the bathroom, vacuuming, shopping
and appointments are flexible, about once a week. Everything can be changed afterwards. The
templates live in `frontend/src/pools/tasks.ts`, their titles in
`frontend/src/locales/<language>/pool.json`.

**Flexible tasks** have no fixed day but a rhythm: every X days (shortcuts every 2 days, every
week, every 2 weeks, every month) and a date for the first time it is due. From then on the task
stays in the family view until it's done; when overdue, the card shows a red note with an alarm
clock ("due for 3 days"). After that it is due again X days after it was done. Before it is due,
it appears small under **"Coming up"** and can already be done early; the rhythm then restarts from
that day. "Coming up" does not count towards the daily progress.

The list can be filtered by tapping a person; new tasks are then preselected for that person. The
switch in each row sets a task active or inactive. When a person is deleted their tasks are kept;
tasks without anyone assigned are marked in the list.

The icons are embedded into the frontend at build time (only the catalogue icons, not the whole
set). To extend the catalogue, add names from the `fluent-emoji-flat` set (e.g. from
[icon-sets.iconify.design](https://icon-sets.iconify.design/fluent-emoji-flat/)) to
`frontend/src/icons/categories.json` and search terms to
`frontend/src/locales/<language>/icons.json` (the first term is the label). Tests check that every
icon exists and has a unique label in every language.

## Family view

The start page shows all family members side by side, each with a large avatar and today's tasks.
Nobody has to sign in or switch users: whose task it is follows from the column.

- **One tap** on a task card completes it for that person (tick, card in the person's colour).
  **Tap again** to undo. Each task can be done only once per person and day, even with double
  taps.
- Tasks are grouped by **time of day** (sunrise, sun, sun behind cloud, moon; plus "Anytime"). The
  current section is highlighted. A section that is completely done collapses into a single line
  with a tick and can be opened again with a tap. Times of day: morning until 11:00, midday until
  14:00, afternoon until 18:00, evening after that.
- A tap on the **avatar** opens the person view with the same tasks in large. After one minute
  without input the display returns to the family view.
- With many people or a narrow screen, the columns can be swiped sideways. On a phone there is one
  person per page, with an avatar bar at the top to switch.
- The **navigation bar** (left, at the bottom on phones) uses icons for "Today" (star), rewards
  (gift) and settings (gear, parents' area with PIN). A red number on the gear shows how many
  completed tasks are waiting for a parent check.

The layout scales with the window height from tablet width upwards: full size at 1080 px (wall
display), proportionally smaller on laptops with display scaling (e.g. a 14" screen), never below
75 %. On phones it stays at full size. Under "This device" in the parents' area you can also pick a
**display size** (small, normal, large) that only applies to that device, e.g. smaller on a tablet
and larger on the wall display. The same section shows what the browser reports (window size,
scaling, base font size), which helps when setting up a new display.

The server always calculates "today" in the family's time zone. The view reloads every minute so
day changes and edits from the parents' area show up.

## Points

Below each avatar, a **row of stars** shows the daily progress (one star per task, done ones light
up; from 9 tasks on, a bar). Next to it are the **points earned today** (star) and the **points
balance** (trophy). When ticking off a task, "+2 ⭐" floats briefly above the card. If reduced
motion is enabled in the system settings, it appears without animation.

Points are never stored as a counter but as **ledger entries**; the balance is their sum.

- Completing books the task's points, undoing books exactly that amount back (reversal), even if
  the task's points have changed since.
- There is at most one completion per task, person and day (database constraint). Only the request
  that actually creates or deletes it books points, so double taps never give double points.
- Ledger entries are never changed or deleted. If a task is deleted, its entries stay with the
  title at the time. Only when a person is deleted do their entries disappear too.
- Tasks worth 0 points create no entry.

In the parents' area, the **"Points"** section shows each person's balance. Tapping a person opens
their **history** (newest first, older ones via "Load older transactions") and a form to **credit or
deduct** points with a reason (1 to 1000). A deduction may not take the balance below 0.

Adults don't collect points (see [Fair sharing](#fair-sharing)); their cards show no point values.

## Parent checks

For tasks such as "Tidy your room" you can switch on **"Parents check"** in the editor. The child
taps the card as usual; instead of a tick an **hourglass** appears and no points are given yet.
The gear in the navigation bar shows how many completions are waiting.

In the parents' area (after the PIN), **"To check"** then appears at the top:

- **All good** confirms the completion and books the points, exactly once and for the day it was
  done. Several entries can be confirmed at once with "Confirm all".
- **Try again** rejects it: the completion is removed and the task is open again.

Completions from earlier days stay checkable. If the child undoes the completion before the check,
nothing is booked.

## Rewards

Rewards are **only for children**, and each child has their own, so choice and cost fit their age.
Under "Rewards" in the parents' area you pick a child and then:

- **Choose from suggestions**: a list of about 30 rewards in three sizes (small about 5–20, medium
  20–50, big 50–100 points), e.g. an ice cream, one more bedtime story, staying up 15 minutes
  longer, movie night with popcorn, zoo or theme park. Several can be added at once; ones the child
  already has are marked.
- **Custom reward**: name, icon ("Rewards" category in the catalogue), cost (1 to 1000),
  description.

Cost and name can be changed afterwards. Inactive rewards are hidden on the display. Below the list
you see what the child redeemed recently.

On the display, the **gift** in the navigation bar leads to the list of children, and a tap on an
avatar to their reward cards (a child's person view shows them too):

- With enough points the card shows **"Redeem"**, otherwise **"8 more points needed"** with a
  progress bar.
- After "Redeem", a large card asks for confirmation with ✓ and ✗. Once confirmed, the server
  deducts the cost. It checks balance and cost in one transaction, so the balance can never go
  negative. A short celebration follows.

The redemption stores name, icon and cost, so the history stays correct even if the reward is later
changed or deleted. The suggestions live in `frontend/src/pools/rewards.ts`.

## Fair sharing

Adults don't get rewards. Instead, their column shows their **share** of the tasks that adults
completed this week (Monday to Sunday, family time zone), e.g. 40 % and 60 %, as a split bar in the
people's colours. The person view additionally shows all shares with the number of tasks. What
counts is the number of completed tasks; point values don't matter. This is deliberately not a
competition but a way to share the work fairly. With only one adult, the display is hidden.

## Configuration

Configuration is done exclusively through environment variables in `.env`. All variables are
described in [`.env.example`](.env.example).

| Variable | Default | Meaning |
| --- | --- | --- |
| `POSTGRES_USER` | `famquest` | Database user |
| `POSTGRES_PASSWORD` | – (required) | Database password |
| `POSTGRES_DB` | `famquest` | Database name |
| `APP_PORT` | `8080` | Port on the host |
| `LOG_LEVEL` | `info` | `critical`, `error`, `warning`, `info`, `debug` (for troubleshooting) |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Trusted reverse proxies |
| `PROXY_NETWORK` | `proxy` | Docker network of your reverse proxy (see below) |

Data lives in two Docker volumes: `db-data` (PostgreSQL) and `uploads` (uploaded images). How to
back them up is described under [Backup and restore](#backup-and-restore).

## Backup and restore

Back up the **database** and the **uploaded images**. Both work while the app is running, from the
project folder (where `docker-compose.yml` is):

```sh
mkdir -p backup
# Database (PostgreSQL dump in custom format)
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > backup/famquest-$(date +%F).dump
# Images
docker compose exec -T app tar czf - -C /data uploads > backup/uploads-$(date +%F).tar.gz
```

Also store the files somewhere off the machine (NAS, external drive). `.env` belongs in the backup
too, but it is not part of the repository.

**Restore**, e.g. on a new machine after `git clone` and `cp .env.example .env` (with the same
`POSTGRES_*` values):

```sh
docker compose up -d db
# Restore the database (existing tables are replaced)
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backup/famquest-2026-10-03.dump
# Restore the images
docker compose run --rm -T --no-deps --entrypoint tar app xzf - -C /data \
  < backup/uploads-2026-10-03.tar.gz
docker compose up -d
```

On start, the app migrates the database to the latest version. A backup of an older version can
therefore be restored into a newer one, but not the other way round.

`scripts/backup.sh [TARGET_DIR] [DAYS]` does both in one go (default: `backup/`, backups older than
30 days are deleted). For a nightly backup via cron:

```
0 3 * * * /path/to/famquest/scripts/backup.sh /mnt/nas/famquest 30
```

The cron user needs access to Docker (group `docker`).

## Behind a reverse proxy

### Proxy as a container in a Docker network (e.g. Nginx Proxy Manager)

If your proxy runs as a container in its own Docker network (for example called `proxy`), add
these two lines to `.env`:

```sh
COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml
PROXY_NETWORK=proxy
```

Then run `docker compose up -d`. The app joins that network and is reachable there as
**`famquest`, port `8000`**. No port is published on the host any more, and `FORWARDED_ALLOW_IPS`
defaults to `*` (only the proxy can reach the app). In Nginx Proxy Manager: new proxy host, scheme
`http`, forward hostname `famquest`, forward port `8000`, plus an SSL certificate. This needs
Docker Compose 2.24 or newer.

### Proxy on the host or another machine

The app evaluates `X-Forwarded-For` and `X-Forwarded-Proto`, but only from the addresses in
`FORWARDED_ALLOW_IPS`. This matters: only if the app knows it is served over HTTPS does the session
cookie get the `Secure` flag.

Recommended setup when the proxy runs on the same host:

```sh
# .env
APP_PORT=127.0.0.1:8080       # app only reachable for the local proxy
FORWARDED_ALLOW_IPS=*         # acceptable because nobody else can reach it directly
```

If the proxy runs on another machine, put its IP address into `FORWARDED_ALLOW_IPS`. Note: because
of Docker's port mapping, the app sees the address of the Docker network (e.g. `172.18.0.1`) as the
sender, not `127.0.0.1`. The default `127.0.0.1` therefore only applies without a proxy.

The proxy must pass on the original `Host` header (Caddy and Traefik do this automatically; for
nginx use `proxy_set_header Host $host;`). Setup and sign-in use it to check that requests come from
the app's own page.

The app must run on its own (sub)domain, e.g. `family.example.com`. A sub-path such as
`example.com/family` is not supported.

## Troubleshooting

**Sign-in fails although the password should be right.** The app logs why a sign-in was rejected
(`docker compose logs app`), e.g. `Anmeldung fehlgeschlagen: falsches Passwort für Konto 1` (wrong
password) or `kein Konto mit dieser E-Mail` (no account with this e-mail). With `LOG_LEVEL=debug` in
`.env` (then `docker compose up -d`) it also logs the e-mail address that was entered. Passwords and
PINs are never logged. If a reverse proxy doesn't pass on the `Host` header, the log says so too.

**Forgot the password.** There is no e-mail reset on purpose; reset it on the server instead:

```sh
docker compose exec app python -m app.cli users                             # list accounts
docker compose exec -it app python -m app.cli reset-password mama@example.org
```

After 5 failed attempts, sign-in is blocked for 15 minutes; restarting the app
(`docker compose restart app`) lifts the block right away.

## Languages

German is the default language. Without a saved choice, the app follows the browser language; the
family language set in the parents' area applies on every device where nobody has picked a
language.

Translations live in `frontend/src/locales/<language>/<area>.json` (`common.json` for the
interface, `icons.json` for icon search terms, `pool.json` for task and reward suggestions). To add
a new language:

1. Copy the folder `frontend/src/locales/en`, e.g. to `frontend/src/locales/fr`
2. Translate all texts
3. Add the language code to `SUPPORTED_LANGUAGES` in `frontend/src/i18n.ts`

A test (`npm test`) checks that every language has exactly the same keys and no empty texts. The
API returns errors as codes (e.g. `common.not_found`), which the frontend translates under
`errors.*`.

## Development

For local development, backend and frontend run directly on your machine; only PostgreSQL runs in
Docker. Requirements: [uv](https://docs.astral.sh/uv/), Node.js ≥ 24, Docker.

Once:

```sh
cp .env.example .env
# In .env: set POSTGRES_PASSWORD and uncomment the COMPOSE_FILE and DB_PORT lines
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..
```

Run (three terminals):

```sh
docker compose up -d db                              # PostgreSQL on 127.0.0.1:5432
cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
cd frontend && npm run dev                           # http://localhost:5173
```

Vite forwards `/api` to the backend on port 8000. The API documentation is at
`http://localhost:8000/api/docs`.

Tests and lint:

```sh
cd backend && uv run pytest                          # needs the running database
cd backend && uv run ruff check . && uv run ruff format --check .
cd frontend && npm test && npm run lint && npm run typecheck
cd frontend && npm run format                        # formatting (Prettier)
docker compose --profile test run --rm --build tests # backend tests in the container
```

End-to-end tests (Playwright, Chromium):

```sh
cd frontend && npx playwright install chromium       # once
cd frontend && npm run e2e                           # needs the running database
```

`npm run e2e` builds the frontend, creates a fresh database `<POSTGRES_DB>_e2e` and starts the app
on port 8001. The tests cover the main flows in the browser: setup, adding a child and tasks,
ticking off and undoing, the person view on a phone, points, rewards, parent checks and flexible
tasks.

The backend tests create their own database `<POSTGRES_DB>_test` and reset it on every run.

Migrations:

```sh
cd backend
uv run alembic revision --autogenerate -m "description"    # new migration from the models
uv run alembic upgrade head                                 # apply
```

A test fails if models were changed without creating a migration.

## Architecture

```
Browser ──► reverse proxy (optional) ──► app (FastAPI, port 8000) ──► db (PostgreSQL 16)
                                           ├─ /api/*   JSON API
                                           ├─ /*       built React frontend
                                           └─ /data/uploads (volume)
```

| Folder | Contents |
| --- | --- |
| `backend/` | FastAPI, SQLAlchemy 2, Alembic, pytest; packages with uv |
| `frontend/` | React, Vite, TypeScript, Tailwind CSS, react-i18next, TanStack Query, Vitest, Playwright |
| `docs/` | Specification, display test checklist |
| `scripts/` | Backup script |

The `Dockerfile` first builds the frontend and then copies it into the Python image. The result is
a single app image that runs as an unprivileged user.

## Roadmap

Current state: **0.x alpha**. Versions after 1.0 are a first plan and may still change.

**1.0: task system (phase 1).** Everything listed under [Features](#features). Still open: the
test on a real display ([checklist](docs/DISPLAY-TEST.md)) and fixes from it.

- [x] 1. Foundation: backend, frontend with i18n, Docker, Alembic, health checks
- [x] 2. First-run setup, sign-in/out, registration lock, parents' PIN
- [x] 3. Family members with colour and photo
- [x] 4. Tasks and routines in the parents' area
- [x] 5. Family view
- [x] 6. Points and daily progress
- [x] 7. Rewards, task templates, parent checks, fair sharing
- [ ] 8. Polish: flexible tasks and "One for all" ✓, backup/restore ✓, family settings ✓, sign-in
  hardening ✓, first display test fixes (compact layout, order of people) ✓, final display test

**1.1: make it your own**

- Editable templates: families can change, add and remove task templates and reward suggestions
  (stored in the database instead of the code); reworked example templates
- Teen style: a less childlike look per person for older children
- Icon picker: "Popular" based on what the family actually uses; popular icons also shown in their
  category
- More than seven people (more colours)
- About page: author, licence, version and a check for updates

**1.2: on the go**

- Installable web app (PWA) for parents' phones: check tasks, book points and add tasks from
  anywhere
- Adults can quickly add tasks right from the family view, without the parents' area

**Later (phases 2–5 of the specification)**

| Phase | Contents |
| --- | --- |
| 2 | Google Calendar: link calendars to people, events in the person's colour |
| 3 | "Today" becomes the start page: a real day dashboard with a bit of calendar, tasks, meal plan, shopping list and weather. Tasks move to their own area, optionally with a week view to browse what's coming up and what's done; a week widget for the dashboard |
| 4 | Meal planning |
| 5 | Shopping lists |

**Ideas without a version yet**

- Several families on one installation: e.g. the first admin (or a hidden function) creates
  befriended families and grants access to them. Today FamQuest deliberately serves exactly one
  family per installation.

## License

Copyright © 2026 Craebby

FamQuest is free software: you can redistribute it and/or modify it under the terms of the
[GNU Affero General Public License](LICENSE) as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version. In short: you may use, change and
share it freely, also commercially; if you distribute a modified version or run one for others over
a network, you must publish its source code under the same licence.

FamQuest is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; see the
licence for details. The bundled [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) icons
are © Microsoft, MIT licence.
