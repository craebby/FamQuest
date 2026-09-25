import datetime as dt
from urllib.parse import parse_qs

import httpx2 as httpx
import pytest
from sqlalchemy import select

from app import calendar_sync, holidays
from app.db import SessionLocal
from app.models import SchoolHoliday
from tests.conftest import csrf
from tests.fake_google import timed
from tests.test_calendar import connect
from tests.test_calendar_sync import MAMA, choose, week


class FakeOpenHolidays:
    def __init__(self) -> None:
        self.requests: list[dict[str, str]] = []
        self.fail = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(holidays.SCHOOL_HOLIDAYS_URL)
        params = {k: v[0] for k, v in parse_qs(request.url.query.decode()).items()}
        self.requests.append(params)
        if self.fail:
            return httpx.Response(503)
        return httpx.Response(
            200,
            json=[
                {
                    "startDate": "2026-10-01",
                    "endDate": "2026-10-02",
                    "name": [
                        {"language": "DE", "text": "Herbstferien"},
                        {"language": "EN", "text": "Autumn Holidays"},
                    ],
                },
                {"startDate": "2026-12-24", "endDate": "2027-01-06", "name": []},
            ],
        )


@pytest.fixture
def open_holidays(monkeypatch) -> FakeOpenHolidays:
    fake = FakeOpenHolidays()
    monkeypatch.setattr(holidays, "transport", httpx.MockTransport(fake.handler))
    return fake


def set_holidays(client, me, **body):
    response = client.put("/api/calendar/holidays", json=body, headers=csrf(me))
    assert response.status_code == 200, response.text
    return response.json()


def holidays_by_day(data: dict) -> dict[str, list[tuple[str, str]]]:
    return {d["date"]: [(h["kind"], h["name"]) for h in d["holidays"]] for d in data["days"]}


def test_holiday_settings(client, parent, open_holidays):
    settings = set_holidays(client, parent, region="NW", public=True, school=False)

    assert settings["holidays"] == {"region": "NW", "public": True, "school": False}
    invalid = client.put(
        "/api/calendar/holidays", json={"region": "XX", "public": True}, headers=csrf(parent)
    )
    assert invalid.status_code == 422


def test_holidays_alone_enable_the_calendar(client, parent, open_holidays):
    assert client.get("/api/calendar/status").json() == {"enabled": False}
    set_holidays(client, parent, region="BY", public=True)
    assert client.get("/api/calendar/status").json() == {"enabled": True}
    set_holidays(client, parent, region="BY", public=False, school=False)
    assert client.get("/api/calendar/status").json() == {"enabled": False}


def test_public_holidays_in_family_or_device_language(client, parent, now, open_holidays):
    set_holidays(client, parent, region="NW", public=True)

    assert holidays_by_day(week(client))["2026-10-03"] == [("public", "Tag der Deutschen Einheit")]
    english = client.get("/api/calendar/week", params={"lang": "en"}).json()
    assert holidays_by_day(english)["2026-10-03"] == [("public", "German Unity Day")]
    assert holidays_by_day(week(client))["2026-10-02"] == []


def test_public_holidays_depend_on_region(client, parent, now, open_holidays):
    # Allerheiligen ist in NRW Feiertag, in Berlin nicht.
    set_holidays(client, parent, region="NW", public=True)
    assert ("public", "Allerheiligen") in holidays_by_day(week(client, 4))["2026-11-01"]
    set_holidays(client, parent, region="BE", public=True)
    assert holidays_by_day(week(client, 4))["2026-11-01"] == []


def test_school_holidays_are_loaded_and_shown(client, parent, now, open_holidays):
    # Das Speichern stößt das Laden an.
    set_holidays(client, parent, region="NW", school=True)

    [request] = open_holidays.requests
    assert request["subdivisionCode"] == "DE-NW"
    days = holidays_by_day(week(client))
    # Letzter Ferientag ist inklusiv.
    assert days["2026-09-30"] == []
    assert days["2026-10-01"] == [("school", "Herbstferien")]
    assert days["2026-10-02"] == [("school", "Herbstferien")]
    assert days["2026-10-03"] == []
    english = client.get("/api/calendar/week", params={"lang": "en"}).json()
    assert holidays_by_day(english)["2026-10-01"] == [("school", "Autumn Holidays")]
    # Ferien ohne Namen werden übersprungen.
    with SessionLocal() as db:
        assert len(db.scalars(select(SchoolHoliday)).all()) == 1


def test_school_holidays_hidden_when_switched_off(client, parent, now, open_holidays):
    set_holidays(client, parent, region="NW", school=True)
    set_holidays(client, parent, region="NW", public=False, school=False)

    assert holidays_by_day(week(client))["2026-10-01"] == []


def test_school_holidays_refresh_daily_and_keep_data_on_errors(client, parent, open_holidays):
    set_holidays(client, parent, region="NW", school=True)
    loaded_at = dt.datetime.now(dt.UTC)

    calendar_sync.sync_all(loaded_at + dt.timedelta(hours=1))
    assert len(open_holidays.requests) == 1

    open_holidays.fail = True
    calendar_sync.sync_all(loaded_at + dt.timedelta(days=2))
    assert len(open_holidays.requests) == 2
    with SessionLocal() as db:
        assert len(db.scalars(select(SchoolHoliday)).all()) == 1


def test_event_details(client, parent, fake_google, now):
    connect(client, parent, fake_google)
    fake_google.set_events(
        MAMA,
        [
            timed(
                "a",
                "2026-10-03T10:00:00+02:00",
                "2026-10-03T11:00:00+02:00",
                "Zahnarzt",
                location=" Hauptstr. 1, Neuss ",
                description="Bitte <b>Karte</b> mitbringen<br>Tel: 0123 &amp; mehr<p></p>",
            )
        ],
    )
    choose(client, parent, MAMA, None)

    [event] = next(d for d in week(client)["days"] if d["date"] == "2026-10-03")["events"]

    assert event["location"] == "Hauptstr. 1, Neuss"
    assert event["description"] == "Bitte Karte mitbringen\nTel: 0123 & mehr"
    assert event["calendars"] == [MAMA]
