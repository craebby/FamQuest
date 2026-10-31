import pytest
from sqlalchemy import select

from app import google
from app.config import get_settings
from app.db import SessionLocal
from app.models import CalendarConnection, CalendarEvent
from tests.conftest import csrf
from tests.fake_google import all_day, timed
from tests.test_calendar import connect
from tests.test_calendar_sync import (
    FAMILY,
    MAMA,
    WINDOW_START,
    calendar_settings,
    calendars,
    choose,
    loaded,
    stored_titles,
    sync,
    titles_by_day,
    week,
)

SATURDAY = "2026-10-03"
READ_WRITE = f"openid email {google.CALENDAR_SCOPE} {google.EVENTS_SCOPE}"


@pytest.fixture
def writable(client, parent, fake_google, now, lena):
    """Mamas Kalender (Lena) und der Familienkalender mit Schreibzugriff, Familie nur lesbar."""
    fake_google.scope = READ_WRITE
    fake_google.calendars[0]["accessRole"] = "owner"
    fake_google.calendars[1]["accessRole"] = "reader"
    connect(client, parent, fake_google)
    choose(client, parent, MAMA, lena)
    choose(client, parent, "Familie", None)
    loaded(WINDOW_START)
    return fake_google


def timed_input(**overrides) -> dict:
    return {
        "title": "Zahnarzt",
        "all_day": False,
        "start_date": SATURDAY,
        "end_date": SATURDAY,
        "start_time": "15:00",
        "end_time": "16:00",
        **overrides,
    }


def create(client, me, calendar_id, **overrides):
    return client.post(
        "/api/calendar/events",
        json={"calendar_id": calendar_id, **timed_input(**overrides)},
        headers=csrf(me),
    )


def event_on_saturday(client) -> dict:
    return next(d for d in week(client)["days"] if d["date"] == SATURDAY)["events"][0]


def put(client, me, event_id, **overrides):
    return client.put(
        f"/api/calendar/events/{event_id}", json=timed_input(**overrides), headers=csrf(me)
    )


def remove(client, me, event_id):
    return client.delete(f"/api/calendar/events/{event_id}", headers=csrf(me))


def code(response) -> str:
    return response.json()["code"]


# --- Schreibzugriff --------------------------------------------------------------------


def test_connecting_asks_for_write_access(client, parent, fake_google):
    fake_google.scope = READ_WRITE
    connect(client, parent, fake_google)

    [connection] = calendar_settings(client)["connections"]
    assert connection["can_write"] is True


def test_write_access_can_be_declined(client, parent, fake_google):
    connect(client, parent, fake_google)

    [connection] = calendar_settings(client)["connections"]
    assert connection["can_write"] is False


def test_only_writable_calendars_are_offered(client, writable):
    data = week(client)

    assert [c["name"] for c in data["writable_calendars"]] == [MAMA]


def test_older_connection_offers_nothing(client, writable, now):
    writable.set_events(
        MAMA, [timed("e1", "2026-10-03T15:00:00+02:00", "2026-10-03T16:00:00+02:00")]
    )
    sync()
    with SessionLocal() as db:
        db.scalars(select(CalendarConnection)).one().can_write = False
        db.commit()

    assert week(client)["writable_calendars"] == []
    assert event_on_saturday(client)["editable"] is False


def test_events_of_read_only_calendars_are_not_editable(client, writable):
    writable.set_events(
        FAMILY, [timed("e1", "2026-10-03T15:00:00+02:00", "2026-10-03T16:00:00+02:00")]
    )
    sync()

    assert event_on_saturday(client)["editable"] is False


# --- Anlegen ---------------------------------------------------------------------------


def test_create_timed_event_shows_up_right_away(client, parent, writable):
    calendar = calendars(client)[MAMA]["id"]

    response = create(client, parent, calendar, location="Praxis", description="Karte mitnehmen")

    assert response.status_code == 204, response.text
    [(method, calendar_id, _, body)] = writable.writes
    assert (method, calendar_id) == ("POST", MAMA)
    assert body == {
        "summary": "Zahnarzt",
        "location": "Praxis",
        "description": "Karte mitnehmen",
        # Die Uhrzeit gilt in der Zeitzone der Familie.
        "start": {"dateTime": "2026-10-03T15:00:00+02:00", "timeZone": "Europe/Berlin"},
        "end": {"dateTime": "2026-10-03T16:00:00+02:00", "timeZone": "Europe/Berlin"},
    }
    event = event_on_saturday(client)
    assert (event["title"], event["location"], event["editable"]) == ("Zahnarzt", "Praxis", True)


def test_create_all_day_event_with_exclusive_end(client, parent, writable):
    calendar = calendars(client)[MAMA]["id"]

    response = create(
        client,
        parent,
        calendar,
        all_day=True,
        end_date="2026-10-04",
        start_time=None,
        end_time=None,
    )

    assert response.status_code == 204, response.text
    body = writable.writes[0][3]
    assert (body["start"], body["end"]) == ({"date": SATURDAY}, {"date": "2026-10-05"})
    assert event_on_saturday(client)["all_day"] is True


def test_create_stays_after_the_next_sync(client, parent, writable):
    create(client, parent, calendars(client)[MAMA]["id"])

    sync()

    assert stored_titles() == ["Zahnarzt"]


def test_create_needs_the_parent_pin(client, parent, writable):
    calendar = calendars(client)[MAMA]["id"]
    client.post("/api/parent/lock", headers=csrf(parent))

    response = create(client, parent, calendar)

    assert response.status_code == 403
    assert code(response) == "parent.locked"
    assert writable.writes == []


def test_create_in_read_only_calendar(client, parent, writable):
    response = create(client, parent, calendars(client)["Familie"]["id"])

    assert response.status_code == 403
    assert code(response) == "calendar.event_read_only"


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": "   "},
        {"end_time": "14:00"},
        {"end_date": "2026-10-02"},
        {"start_time": None},
        {"all_day": True, "end_date": "2026-10-02"},
    ],
)
def test_create_rejects_invalid_input(client, parent, writable, overrides):
    response = create(client, parent, calendars(client)[MAMA]["id"], **overrides)

    assert response.status_code == 422
    assert writable.writes == []


def test_google_refuses(client, parent, writable):
    writable.api_errors[MAMA] = (403, "forbidden")

    response = create(client, parent, calendars(client)[MAMA]["id"])

    assert response.status_code == 502
    assert code(response) == "calendar.event_write_denied"
    assert stored_titles() == []


def test_demo_cannot_create(client, parent, writable, monkeypatch):
    calendar = calendars(client)[MAMA]["id"]
    monkeypatch.setattr(get_settings(), "demo_mode", "de")

    response = create(client, parent, calendar)

    assert code(response) == "demo.disabled"
    assert writable.writes == []


# --- Ändern ----------------------------------------------------------------------------


@pytest.fixture
def appointment(client, writable) -> dict:
    writable.set_events(
        MAMA,
        [
            timed(
                "e1",
                "2026-10-03T15:00:00+02:00",
                "2026-10-03T16:00:00+02:00",
                title="Zahnarzt",
                description="<b>Karte</b> mitnehmen",
            )
        ],
    )
    sync()
    return event_on_saturday(client)


def test_update_sends_only_what_changed(client, parent, writable, appointment):
    response = put(
        client, parent, appointment["key"], title="Kieferorthopäde", description="Karte mitnehmen"
    )

    assert response.status_code == 204, response.text
    assert writable.writes == [("PATCH", MAMA, "e1", {"summary": "Kieferorthopäde"})]
    assert event_on_saturday(client)["title"] == "Kieferorthopäde"


def test_update_without_changes_does_not_call_google(client, parent, writable, appointment):
    response = put(client, parent, appointment["key"], description="Karte mitnehmen")

    assert response.status_code == 204, response.text
    assert writable.writes == []


def test_update_times_keeps_the_rest(client, parent, writable, appointment):
    response = put(
        client, parent, appointment["key"], description="Karte mitnehmen", end_time="17:30"
    )

    assert response.status_code == 204, response.text
    [(_, _, _, body)] = writable.writes
    assert set(body) == {"start", "end"}
    assert event_on_saturday(client)["end"].startswith("2026-10-03T15:30:00")


def test_update_to_all_day_replaces_the_times(client, parent, writable, appointment):
    response = put(
        client,
        parent,
        appointment["key"],
        description="Karte mitnehmen",
        all_day=True,
        start_time=None,
        end_time=None,
    )

    assert response.status_code == 204, response.text
    assert writable.events[MAMA][0]["start"] == {"date": SATURDAY}
    assert writable.events[MAMA][0]["end"] == {"date": "2026-10-04"}
    assert event_on_saturday(client)["all_day"] is True


def test_update_needs_the_parent_pin(client, parent, writable, appointment):
    client.post("/api/parent/lock", headers=csrf(parent))

    response = put(client, parent, appointment["key"], title="Neu")

    assert code(response) == "parent.locked"
    assert writable.writes == []


def test_update_unknown_event(client, parent, writable):
    response = put(client, parent, 999999, title="Neu")

    assert response.status_code == 404
    assert code(response) == "calendar.event_not_found"


def test_update_of_read_only_event(client, parent, writable):
    writable.set_events(
        FAMILY, [timed("f1", "2026-10-03T15:00:00+02:00", "2026-10-03T16:00:00+02:00")]
    )
    sync()

    response = put(client, parent, event_on_saturday(client)["key"], title="Neu")

    assert response.status_code == 403
    assert code(response) == "calendar.event_read_only"


def test_update_of_a_moved_away_event(client, parent, writable, appointment):
    writable.events[MAMA] = []

    response = put(client, parent, appointment["key"], title="Neu")

    assert response.status_code == 502
    assert code(response) == "calendar.event_gone"


# --- Löschen ---------------------------------------------------------------------------


def test_delete(client, parent, writable, appointment):
    response = remove(client, parent, appointment["key"])

    assert response.status_code == 204, response.text
    assert writable.writes == [("DELETE", MAMA, "e1", None)]
    assert writable.events[MAMA] == []
    assert stored_titles() == []


def test_delete_only_this_occurrence_of_a_series(client, parent, writable):
    occurrence = {"recurringEventId": "serie"}
    writable.set_events(
        MAMA,
        [
            timed(
                "serie_1", "2026-10-03T15:00:00+02:00", "2026-10-03T16:00:00+02:00", **occurrence
            ),
            timed(
                "serie_2", "2026-10-02T15:00:00+02:00", "2026-10-02T16:00:00+02:00", **occurrence
            ),
        ],
    )
    sync()
    event = event_on_saturday(client)
    assert event["recurring"] is True

    remove(client, parent, event["key"])

    assert [write[2] for write in writable.writes] == ["serie_1"]
    assert len(stored_titles()) == 1


def test_delete_already_gone_at_google(client, parent, writable, appointment):
    writable.events[MAMA] = []

    response = remove(client, parent, appointment["key"])

    assert response.status_code == 204, response.text
    assert stored_titles() == []


def test_delete_needs_the_parent_pin(client, parent, writable, appointment):
    client.post("/api/parent/lock", headers=csrf(parent))

    response = remove(client, parent, appointment["key"])

    assert code(response) == "parent.locked"
    assert stored_titles() == ["Zahnarzt"]


def test_delete_keeps_the_event_if_google_fails(client, parent, writable, appointment):
    writable.unreachable = True

    response = remove(client, parent, appointment["key"])

    assert response.status_code == 502
    assert code(response) == "calendar.google_unreachable"
    assert stored_titles() == ["Zahnarzt"]


# --- Termin in mehreren Kalendern ------------------------------------------------------


@pytest.fixture
def shared(client, writable) -> dict:
    """Einladung an beide Eltern: zwei Kalender, beide beschreibbar, ein Termin in der Anzeige."""
    writable.calendars[1]["accessRole"] = "writer"
    sync()
    times = ("2026-10-03T15:00:00+02:00", "2026-10-03T16:00:00+02:00")
    uid = {"iCalUID": "einladung@google.com"}
    writable.set_events(MAMA, [timed("kopie-a", *times, title="Elternabend", **uid)])
    writable.set_events(FAMILY, [timed("kopie-b", *times, title="Elternabend", **uid)])
    sync()
    return event_on_saturday(client)


def test_delete_removes_every_writable_copy(client, parent, writable, shared):
    remove(client, parent, shared["key"])

    assert sorted(write[2] for write in writable.writes) == ["kopie-a", "kopie-b"]
    assert titles_by_day(week(client))[SATURDAY] == []


def test_update_works_if_only_the_organizer_may_change_it(client, parent, writable, shared):
    writable.locked_events = {"kopie-a"}

    response = put(client, parent, shared["key"], title="Elternabend Kita")

    assert response.status_code == 204, response.text
    # Bis zum nächsten Abgleich nicht doppelt, sondern einmal mit dem neuen Titel.
    assert titles_by_day(week(client))[SATURDAY] == ["Elternabend Kita"]


def test_update_fails_if_no_copy_may_be_changed(client, parent, writable, shared):
    writable.locked_events = {"kopie-a", "kopie-b"}

    response = put(client, parent, shared["key"], title="Neu")

    assert response.status_code == 502
    assert code(response) == "calendar.event_write_denied"
    assert titles_by_day(week(client))[SATURDAY] == ["Elternabend"]


def test_all_day_event_can_be_deleted(client, parent, writable):
    writable.set_events(MAMA, [all_day("t1", SATURDAY, "2026-10-04", "Ausflug")])
    sync()

    remove(client, parent, event_on_saturday(client)["key"])

    assert writable.events[MAMA] == []
    with SessionLocal() as db:
        assert db.scalars(select(CalendarEvent)).first() is None
