"""Demodaten: eine Beispielfamilie für Screenshots (und später eine Demoversion).

    uv run python -m app.demo seed --lang de --weekday 4 --at 07:25
    uv run python -m app.demo serve --weekday 4 --at 07:25 --port 8011

`seed` füllt eine leere Datenbank über die echte API (wie ein Mensch im Elternbereich), nur
Kalendertermine kommen direkt in die Datenbank, weil es dafür kein Google-Konto gibt. Alle Daten
liegen relativ zum (ggf. gestellten) heutigen Tag. `--at` stellt die Uhr der App auf diese
Ortszeit, `--weekday` auf diesen Tag der laufenden Woche (1 = Montag), damit Screenshots immer
einen ähnlichen Moment zeigen (z. B. Donnerstagmorgen mit laufender Morgenroutine); `serve`
startet die App mit derselben Uhr und festem Wetter. Die Bilder liegen in `backend/demo/`
(Quellen siehe dort).
"""

import argparse
import datetime as dt
import random
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx2 as httpx
from fastapi.testclient import TestClient
from sqlalchemy import select

import app.today
from app import weather
from app.db import SessionLocal
from app.models import Calendar, CalendarConnection, CalendarEvent, User

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"
TIMEZONE = "Europe/Berlin"
EMAIL = "demo@famquest.example"
PASSWORD = "famquest-demo"
PIN = "1234"

# Symbole aus dem Icon-Katalog des Frontends (src/icons/categories.json).
ICON = "fluent-emoji-flat:"

# Texte je Sprache; von Eltern eingegebene Inhalte speichert FamQuest so, wie sie getippt werden.
TEXT = {
    "de": {
        "family": "Familie Berger",
        "brush": "Zähne putzen",
        "dress": "Anziehen",
        "breakfast": "Frühstücken",
        "lunchbox": "Brotdose einpacken",
        "schoolbag": "Schulranzen packen",
        "homework": "Hausaufgaben",
        "guitar": "Gitarre üben",
        "tidy": "Aufräumen",
        "pajamas": "Schlafanzug anziehen",
        "read": "Buch lesen",
        "table": "Tisch decken",
        "dog": "Hund füttern",
        "trash": "Müll rausbringen",
        "shopping": "Wocheneinkauf",
        "bathroom": "Bad putzen",
        "laundry": "Wäsche waschen",
        "plants": "Blumen gießen",
        "manual": "Beim Kochen geholfen",
        "rewards": [
            ("Eis essen gehen", "ice-cream", 60),
            ("15 Minuten Tablet", "mobile-phone", 20),
            ("Länger aufbleiben", "crescent-moon", 30),
            ("Film aussuchen", "clapper-board", 40),
            ("Übernachtungsparty", "camping", 250),
        ],
        "dishes": [
            ("Nudeln mit Tomatensoße", "spaghetti"),
            ("Pizza", "pizza"),
            ("Fischstäbchen mit Kartoffelbrei", "fish"),
            ("Pfannkuchen", "pancakes"),
            ("Gemüsecurry", "curry-rice"),
            ("Burger", "hamburger"),
            ("Linsensuppe", "pot-of-food"),
            ("Tacos", "taco"),
            ("Lasagne", "shallow-pan-of-food"),
            ("Backcamembert", "cheese-wedge"),
        ],
        "events": {
            "gymnastics": "Kinderturnen",
            "judo": "Judo",
            "music": "Musikschule (Gitarre)",
            "parents_evening": "Elternabend Kita",
            "swimming": "Schwimmkurs",
            "dentist": "Zahnarzt",
            "birthday": "Geburtstag Oma",
            "zoo": "Ausflug in den Zoo",
            "playdate": "Spielverabredung bei Lena",
            "football": "Fußballtraining",
            "lunch": "Mittagessen mit Julia",
        },
        "symbols": [
            ("person-cartwheeling", ["Turnen", "Kinderturnen", "Gymnastik"]),
            ("martial-arts-uniform", ["Judo", "Karate", "Kampfsport"]),
            ("person-swimming", ["Schwimmen", "Schwimmkurs", "Seepferdchen"]),
            ("soccer-ball", ["Fußball", "Fussball"]),
            ("musical-note", ["Musikschule", "Musik", "Gitarre", "Klavier"]),
            ("people-hugging", ["Verabredung", "Spielverabredung", "Playdate"]),
            ("birthday-cake", ["Geburtstag", "Kindergeburtstag"]),
            ("older-person", ["Oma", "Opa", "Großeltern"]),
            ("tooth", ["Zahnarzt", "Zahnärztin"]),
            ("bus", ["Ausflug", "Klassenfahrt"]),
        ],
        "calendars": {"family": "Familie"},
    },
    "en": {
        "family": "The Bergers",
        "brush": "Brush teeth",
        "dress": "Get dressed",
        "breakfast": "Eat breakfast",
        "lunchbox": "Pack lunch box",
        "schoolbag": "Pack school bag",
        "homework": "Homework",
        "guitar": "Practise guitar",
        "tidy": "Tidy up",
        "pajamas": "Put on pyjamas",
        "read": "Read a book",
        "table": "Set the table",
        "dog": "Feed the dog",
        "trash": "Take out the bins",
        "shopping": "Weekly shopping",
        "bathroom": "Clean the bathroom",
        "laundry": "Do the laundry",
        "plants": "Water the plants",
        "manual": "Helped with cooking",
        "rewards": [
            ("Go out for ice cream", "ice-cream", 60),
            ("15 minutes of tablet", "mobile-phone", 20),
            ("Stay up later", "crescent-moon", 30),
            ("Pick the film", "clapper-board", 40),
            ("Sleepover", "camping", 250),
        ],
        "dishes": [
            ("Pasta with tomato sauce", "spaghetti"),
            ("Pizza", "pizza"),
            ("Fish fingers and mash", "fish"),
            ("Pancakes", "pancakes"),
            ("Vegetable curry", "curry-rice"),
            ("Burgers", "hamburger"),
            ("Lentil soup", "pot-of-food"),
            ("Tacos", "taco"),
            ("Lasagne", "shallow-pan-of-food"),
            ("Baked camembert", "cheese-wedge"),
        ],
        "events": {
            "gymnastics": "Gymnastics",
            "judo": "Judo",
            "music": "Music lesson (guitar)",
            "parents_evening": "Parents' evening at nursery",
            "swimming": "Swimming lesson",
            "dentist": "Dentist",
            "birthday": "Grandma's birthday",
            "zoo": "Trip to the zoo",
            "playdate": "Playdate at Lena's",
            "football": "Football practice",
            "lunch": "Lunch with Julia",
        },
        "symbols": [
            ("person-cartwheeling", ["Gymnastics", "gym class"]),
            ("martial-arts-uniform", ["Judo", "karate", "martial arts"]),
            ("person-swimming", ["Swimming", "swim lesson"]),
            ("soccer-ball", ["Football", "soccer"]),
            ("musical-note", ["Music lesson", "music", "guitar", "piano"]),
            ("people-hugging", ["Playdate", "play date"]),
            ("birthday-cake", ["Birthday", "birthday party"]),
            ("older-person", ["Grandma", "grandpa", "grandparents"]),
            ("tooth", ["Dentist", "orthodontist"]),
            ("bus", ["Trip", "outing"]),
        ],
        "calendars": {"family": "Family"},
    },
}

WEEKDAYS = [1, 2, 3, 4, 5]
WEEKEND = [6, 7]
EVERY_DAY = [1, 2, 3, 4, 5, 6, 7]


def fixed_clock(at: dt.time | None, weekday: int | None) -> dt.datetime | None:
    """Heute (bzw. `weekday` dieser Woche) um `at` Ortszeit der Familie, als UTC-Zeitpunkt."""
    if at is None and weekday is None:
        return None
    tz = ZoneInfo(TIMEZONE)
    now = dt.datetime.now(tz)
    day = now.date()
    if weekday is not None:
        day += dt.timedelta(days=weekday - day.isoweekday())
    return dt.datetime.combine(day, at or now.time(), tz).astimezone(dt.UTC)


def set_clock(instant: dt.datetime | None, ticking: bool = False) -> None:
    """Stellt die Uhr der App („heute“, Tagesabschnitt); `ticking` lässt sie weiterlaufen."""
    if instant is None:
        app.today.utcnow = lambda: dt.datetime.now(dt.UTC)
        return
    if ticking:
        offset = instant - dt.datetime.now(dt.UTC)
        app.today.utcnow = lambda: dt.datetime.now(dt.UTC) + offset
    else:
        app.today.utcnow = lambda: instant


def fixed_weather(today: dt.date) -> None:
    """Festes Wetter statt Open-Meteo: gleiche Bilder bei jedem Lauf, auch ohne Netz."""
    days = [today + dt.timedelta(days=offset) for offset in range(weather.FORECAST_DAYS)]
    data = {
        "current": {"temperature_2m": 14.0, "weather_code": 2, "is_day": 1},
        "daily": {
            "time": [day.isoformat() for day in days],
            "weather_code": [2, 61, 0][: len(days)],
            "temperature_2m_max": [17.0, 14.0, 19.0][: len(days)],
            "temperature_2m_min": [9.0, 8.0, 10.0][: len(days)],
            "precipitation_probability_max": [10, 70, 0][: len(days)],
        },
    }
    weather.transport = httpx.MockTransport(lambda request: httpx.Response(200, json=data))
    weather.clear_cache()


class Demo:
    def __init__(self, lang: str, now: dt.datetime) -> None:
        from app.main import app as fastapi_app

        self.text = TEXT[lang]
        self.lang = lang
        self.now = now
        self.tz = ZoneInfo(TIMEZONE)
        self.today = now.astimezone(self.tz).date()
        self.client = TestClient(fastapi_app)
        self.csrf = ""
        self.random = random.Random(42)

    # --- Hilfen -------------------------------------------------------------------------

    def call(self, method: str, path: str, expected: int = 200, **kwargs):
        response = self.client.request(
            method, f"/api{path}", headers={"X-CSRF-Token": self.csrf}, **kwargs
        )
        if response.status_code != expected:
            raise RuntimeError(f"{method} {path}: {response.status_code} {response.text}")
        return response.json() if response.content else None

    def at(self, day: dt.date, hour: int, minute: int = 0) -> dt.datetime:
        return dt.datetime.combine(day, dt.time(hour, minute), self.tz)

    def task(self, title: str, icon: str, member_ids: list[int], points: int = 2, **extra) -> int:
        body = {
            "title": title,
            "icon": ICON + icon,
            "points": points,
            "member_ids": member_ids,
            "recurrence": {"kind": "daily"},
            **extra,
        }
        return self.call("POST", "/tasks", 201, json=body)["id"]

    def routine(self, member_id: int, time_of_day: str, weekdays: list[int], steps) -> int:
        """Routine mit Schritten: neue Aufgaben (Titel, Symbol, Punkte) oder vorhandene Ids."""
        routine = self.call(
            "POST",
            "/routines",
            201,
            json={"member_id": member_id, "time_of_day": time_of_day, "weekdays": weekdays},
        )
        for step in steps:
            optional = False
            if isinstance(step, tuple) and step[-1] == "optional":
                step, optional = step[:-1], True
            if isinstance(step, int):
                body = {"task_id": step, "optional": optional}
            else:
                title, icon, points, *more = step
                task = {
                    "title": title,
                    "icon": ICON + icon,
                    "points": points,
                    "time_of_day": time_of_day,
                    "member_ids": [member_id],
                    "recurrence": {"kind": "daily"},
                    **(more[0] if more else {}),
                }
                body = {"task": task, "optional": optional}
            self.call("POST", f"/routines/{routine['id']}/steps", 201, json=body)
        return routine["id"]

    # --- Aufbau -------------------------------------------------------------------------

    def run(self) -> None:
        t = self.text
        set_clock(self.now)
        me = self.call(
            "POST",
            "/setup",
            201,
            json={
                "language": self.lang,
                "family_name": t["family"],
                "email": EMAIL,
                "password": PASSWORD,
                "pin": PIN,
                "timezone": TIMEZONE,
            },
        )
        self.csrf = me["csrf_token"]
        self.call("POST", "/parent/unlock", json={"pin": PIN})

        self.members()
        self.tasks()
        self.history()
        self.rewards()
        self.meals()
        self.calendar()
        self.settings()
        self.photos()

    def members(self) -> None:
        people = [
            ("anna", "Anna", "parent", "green"),
            ("tom", "Tom", "parent", "blue"),
            ("mia", "Mia", "child", "purple"),
            ("ben", "Ben", "child", "orange"),
        ]
        self.ids: dict[str, int] = {}
        for key, name, role, color in people:
            member = self.call(
                "POST", "/members", 201, json={"name": name, "role": role, "color": color}
            )
            self.ids[key] = member["id"]
            image = (DEMO_DIR / "avatars" / f"{key}.png").read_bytes()
            self.call("PUT", f"/members/{member['id']}/avatar", content=image)
        # Kinder zuerst, wie am Kühlschrank üblich.
        order = [self.ids[key] for key in ("mia", "ben", "anna", "tom")]
        self.call("PUT", "/members/order", json={"member_ids": order})

    def tasks(self) -> None:
        t, mia, ben = self.text, self.ids["mia"], self.ids["ben"]
        anna, tom = self.ids["anna"], self.ids["tom"]

        brush_mia = self.routine(
            mia,
            "morning",
            WEEKDAYS,
            [
                (t["brush"], "toothbrush", 2),
                (t["dress"], "t-shirt", 2),
                (t["breakfast"], "bowl-with-spoon", 1),
                (t["lunchbox"], "bento-box", 2),
            ],
        )
        steps = self.call("GET", "/routines")
        first = next(r for r in steps if r["id"] == brush_mia)["steps"]
        # Am Wochenende abgespeckt: nur Zähne putzen und anziehen.
        self.routine(mia, "morning", WEEKEND, [first[0]["task_id"], first[1]["task_id"]])
        self.routine(
            mia,
            "evening",
            EVERY_DAY,
            [
                (t["tidy"], "teddy-bear", 3),
                (t["pajamas"], "pajamas", 2),
                (t["brush"], "toothbrush", 2),
                (t["read"], "open-book", 2, "optional"),
            ],
        )
        self.routine(
            ben,
            "morning",
            WEEKDAYS,
            [
                (t["brush"], "toothbrush", 2),
                (t["dress"], "t-shirt", 2),
                (t["schoolbag"], "backpack", 2),
            ],
        )
        self.routine(
            ben,
            "afternoon",
            WEEKDAYS,
            [
                (t["homework"], "pencil", 5, {"needs_approval": True}),
                (t["guitar"], "guitar", 3, "optional"),
            ],
        )
        self.routine(
            ben,
            "evening",
            EVERY_DAY,
            [
                (t["tidy"], "teddy-bear", 3),
                (t["brush"], "toothbrush", 2),
                (t["read"], "open-book", 2),
            ],
        )
        self.task(t["table"], "fork-and-knife", [mia], 2, extra=True)
        self.task(t["dog"], "dog-face", [ben], 2, extra=True)

        # Haushalt der Erwachsenen.
        self.task(
            t["trash"],
            "wastebasket",
            [anna, tom],
            3,
            shared=True,
            recurrence={"kind": "weekly", "weekdays": [2, 5]},
        )
        self.task(
            t["shopping"],
            "shopping-cart",
            [anna, tom],
            5,
            shared=True,
            recurrence={"kind": "weekly", "weekdays": [6]},
        )
        start = (self.today - dt.timedelta(days=3)).isoformat()
        self.task(
            t["bathroom"],
            "bathtub",
            [anna],
            5,
            recurrence={"kind": "flexible", "interval_days": 7, "date": start},
        )
        self.task(
            t["laundry"],
            "bubbles",
            [tom],
            3,
            recurrence={"kind": "weekly", "weekdays": [1, 4]},
        )
        self.task(
            t["plants"],
            "potted-plant",
            [tom],
            2,
            recurrence={"kind": "flexible", "interval_days": 3, "date": self.today.isoformat()},
        )

    def complete_day(self, day: dt.date, share: float, until: str | None = None) -> None:
        """Erledigt an `day` einen Teil der anstehenden Aufgaben, höchstens bis `until`."""
        order = ["morning", "midday", "afternoon", "evening"]
        today = self.call("GET", "/today")
        for task in today["tasks"]:
            block = task["time_of_day"]
            if until and block and order.index(block) > order.index(until):
                continue
            for member_id in task["member_ids"]:
                if member_id in task["done_member_ids"] or self.random.random() > share:
                    continue
                self.call(
                    "PUT",
                    f"/today/tasks/{task['id']}/members/{member_id}",
                    204,
                    params={"date": day.isoformat()},
                )
                if task["shared"]:
                    break

    def history(self) -> None:
        """Die letzten Tage fast vollständig erledigt, heute die ersten Schritte des Morgens."""
        for back in range(10, 0, -1):
            day = self.today - dt.timedelta(days=back)
            set_clock(self.at(day, 20, 30).astimezone(dt.UTC))
            self.complete_day(day, 0.85)
        set_clock(self.now)
        # Ältere Hausaufgaben sind geprüft, die von gestern wartet noch.
        pending = self.call("GET", "/approvals")
        for completion in pending[:-1]:
            self.call("POST", f"/approvals/{completion['id']}", 204)
        order = self.call("GET", "/routines")
        # Heute: je Kind die ersten Morgenschritte erledigt, der Rest steht noch an.
        for member in ("mia", "ben"):
            routine = next(
                r
                for r in order
                if r["member_id"] == self.ids[member]
                and r["time_of_day"] == "morning"
                and self.today.isoweekday() in r["weekdays"]
            )
            for step in routine["steps"][: 2 if member == "mia" else 1]:
                self.call(
                    "PUT",
                    f"/today/tasks/{step['task_id']}/members/{self.ids[member]}",
                    204,
                    params={"date": self.today.isoformat()},
                )
        self.call(
            "POST",
            f"/members/{self.ids['mia']}/points",
            201,
            json={"amount": 5, "reason": self.text["manual"]},
        )

    def rewards(self) -> None:
        for member in ("mia", "ben"):
            ids = []
            for name, icon, cost in self.text["rewards"]:
                reward = self.call(
                    "POST",
                    "/rewards",
                    201,
                    json={
                        "member_id": self.ids[member],
                        "name": name,
                        "icon": ICON + icon,
                        "cost": cost,
                    },
                )
                ids.append(reward["id"])
            # Eine Einlösung für die Historie: 15 Minuten Tablet.
            self.call("POST", f"/rewards/{ids[1]}/redeem", 201)

    def meals(self) -> None:
        monday = self.today - dt.timedelta(days=self.today.weekday())
        dishes = self.text["dishes"]
        for index in range(14):
            day = monday + dt.timedelta(days=index)
            name, icon = dishes[index % len(dishes)]
            self.call(
                "PUT", f"/meals/{day.isoformat()}/dinner", json={"name": name, "icon": ICON + icon}
            )

    def calendar(self) -> None:
        """Kalender wie nach dem Verbinden eines Google-Kontos, Termine rund um heute."""
        e = self.text["events"]
        day = lambda offset: self.today + dt.timedelta(days=offset)  # noqa: E731
        with SessionLocal() as db:
            user_id = db.scalar(select(User.id))
            connection = CalendarConnection(
                provider="google",
                account_id="demo",
                account_email="anna.berger@example.com",
                refresh_token="demo",
                status="ok",
                created_by_user_id=user_id,
            )
            db.add(connection)
            calendars = {}
            for key, name in [
                ("mia", "Mia"),
                ("ben", "Ben"),
                ("anna", "anna.berger@example.com"),
                ("tom", "Tom"),
                ("family", self.text["calendars"]["family"]),
            ]:
                calendar = Calendar(
                    connection=connection,
                    external_id=f"{key}@demo",
                    name=name,
                    primary=key == "anna",
                    selected=True,
                    member_id=self.ids.get(key),
                    synced_at=self.now,
                )
                db.add(calendar)
                calendars[key] = calendar
            db.flush()

            timed = [
                ("ben", -3, (15, 30), (16, 15), e["music"]),
                ("mia", -2, (15, 0), (16, 0), e["gymnastics"]),
                ("ben", -1, (17, 0), (18, 30), e["judo"]),
                ("mia", 0, (15, 0), (16, 0), e["gymnastics"]),
                ("ben", 0, (17, 0), (18, 30), e["judo"]),
                ("anna", 0, (12, 30), (13, 30), e["lunch"]),
                ("ben", 1, (15, 30), (16, 15), e["music"]),
                ("anna", 1, (19, 30), (21, 0), e["parents_evening"]),
                ("mia", 2, (16, 30), (17, 15), e["swimming"]),
                ("tom", 2, (8, 30), (9, 15), e["dentist"]),
                ("family", 3, (15, 0), (18, 0), e["birthday"]),
                ("mia", 5, (15, 0), (17, 30), e["playdate"]),
                ("ben", 6, (10, 0), (11, 30), e["football"]),
                ("mia", 7, (15, 0), (16, 0), e["gymnastics"]),
            ]
            for index, (owner, offset, start, end, title) in enumerate(timed):
                db.add(
                    CalendarEvent(
                        calendar_id=calendars[owner].id,
                        external_id=f"demo-{index}",
                        ical_uid=f"demo-{index}@demo",
                        title=title,
                        all_day=False,
                        start_at=self.at(day(offset), *start),
                        end_at=self.at(day(offset), *end),
                    )
                )
            db.add(
                CalendarEvent(
                    calendar_id=calendars["family"].id,
                    external_id="demo-zoo",
                    ical_uid="demo-zoo@demo",
                    title=e["zoo"],
                    all_day=True,
                    start_date=day(4),
                    end_date=day(5),
                )
            )
            db.commit()
        self.call("PUT", "/calendar/family-color", json={"color": "pink"})
        symbols = [{"icon": ICON + icon, "terms": terms} for icon, terms in self.text["symbols"]]
        self.call("PUT", "/calendar/symbols", json={"symbols": symbols})

    def settings(self) -> None:
        self.call(
            "PUT", "/weather/place", json={"name": "Berlin", "latitude": 52.52, "longitude": 13.405}
        )
        if self.lang == "de":
            self.call(
                "PUT", "/calendar/holidays", json={"region": "BE", "public": True, "school": False}
            )

    def photos(self) -> None:
        for path in sorted((DEMO_DIR / "photos").glob("*.jpg")):
            self.call("POST", "/photos", 201, content=path.read_bytes())


def _time(value: str) -> dt.time:
    return dt.time.fromisoformat(value)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.demo", description=__doc__.split("\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    seed = commands.add_parser("seed", help="Leere Datenbank mit der Beispielfamilie füllen")
    seed.add_argument("--lang", choices=sorted(TEXT), default="de")
    seed.add_argument("--at", type=_time, help="Uhrzeit, z. B. 07:25")
    seed.add_argument("--weekday", type=int, choices=range(1, 8), help="Tag der Woche, 1 = Montag")
    serve = commands.add_parser("serve", help="App mit fester Uhr starten")
    serve.add_argument("--at", type=_time)
    serve.add_argument("--weekday", type=int, choices=range(1, 8))
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    args = parser.parse_args(argv)

    now = fixed_clock(args.at, args.weekday)
    if args.command == "seed":
        with SessionLocal() as db:
            if db.scalar(select(User.id)) is not None:
                print("Die Datenbank ist nicht leer; Demodaten nur in eine neue.", file=sys.stderr)
                return 1
        Demo(args.lang, now or dt.datetime.now(dt.UTC)).run()
        print(f"Demodaten angelegt. Anmeldung: {EMAIL} / {PASSWORD}, PIN {PIN}")
        return 0

    import uvicorn

    set_clock(now, ticking=True)
    if now is not None:
        fixed_weather(now.astimezone(ZoneInfo(TIMEZONE)).date())
    uvicorn.run("app.main:app", host=args.host, port=args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
