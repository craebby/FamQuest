import datetime as dt

import pytest
from sqlalchemy import select

from app import calendar_sync
from app.db import SessionLocal
from app.models import CalendarEvent
from tests.conftest import SATURDAY_NIGHT_UTC, csrf
from tests.fake_google import all_day, timed
from tests.test_calendar import connect
from tests.test_tasks import add_member

MAMA = "mama@gmail.com"
FAMILY = "familie@group.calendar.google.com"


def calendar_settings(client) -> dict:
    response = client.get("/api/calendar/settings")
    assert response.status_code == 200, response.text
    return response.json()


def calendars(client) -> dict[str, dict]:
    """Kalender der ersten Verbindung nach Namen."""
    [connection] = calendar_settings(client)["connections"]
    return {calendar["name"]: calendar for calendar in connection["calendars"]}


def choose(client, me, name: str, member_id: int | None, selected: bool = True):
    calendar_id = calendars(client)[name]["id"]
    return client.put(
        f"/api/calendar/calendars/{calendar_id}",
        json={"selected": selected, "member_id": member_id},
        headers=csrf(me),
    )


def stored_titles() -> list[str | None]:
    with SessionLocal() as db:
        return sorted(e.title for e in db.scalars(select(CalendarEvent)))


def sync(now=SATURDAY_NIGHT_UTC) -> None:
    assert calendar_sync.sync_all(now) is True


def week(client, offset=0) -> dict:
    response = client.get("/api/calendar/week", params={"offset": offset})
    assert response.status_code == 200, response.text
    return response.json()


def titles_by_day(data: dict) -> dict[str, list[str]]:
    return {day["date"]: [e["title"] for e in day["events"]] for day in data["days"]}


@pytest.fixture
def connected(client, parent, fake_google):
    connect(client, parent, fake_google)
    return fake_google


# --- Kalender abrufen, auswählen und zuordnen ------------------------------------------


def test_connecting_loads_the_calendar_list(client, parent, connected):
    found = calendars(client)

    assert list(found) == [MAMA, "Familie"]
    assert found[MAMA]["primary"] is True
    assert found["Familie"] == {
        **found["Familie"],
        "selected": False,
        "member_id": None,
        "synced_at": None,
        "sync_error": None,
    }


def test_calendar_list_follows_the_account(client, parent, connected):
    connected.calendars = [
        {"id": MAMA, "summary": MAMA, "summaryOverride": "Mama", "primary": True},
        {"id": "schule@group.calendar.google.com", "summary": "Schule"},
    ]
    sync()

    assert list(calendars(client)) == ["Mama", "Schule"]


def test_assign_calendar_to_member_and_family(client, parent, connected):
    lena = add_member(client, parent)

    response = choose(client, parent, MAMA, lena)
    assert response.status_code == 200, response.text
    choose(client, parent, "Familie", None)

    found = calendars(client)
    assert (found[MAMA]["selected"], found[MAMA]["member_id"]) == (True, lena)
    assert (found["Familie"]["selected"], found["Familie"]["member_id"]) == (True, None)


def test_assign_to_unknown_member(client, parent, connected):
    response = choose(client, parent, MAMA, 999)

    assert response.status_code == 404
    assert response.json() == {"code": "member.not_found"}


def test_unknown_calendar(client, parent, configured):
    response = client.put(
        "/api/calendar/calendars/99", json={"selected": True}, headers=csrf(parent)
    )

    assert response.status_code == 404
    assert response.json() == {"code": "calendar.calendar_not_found"}


def test_choosing_calendars_needs_unlocked_parent_area(client, parent, connected):
    calendar_id = calendars(client)[MAMA]["id"]
    client.post("/api/parent/lock", headers=csrf(parent))

    response = client.put(
        f"/api/calendar/calendars/{calendar_id}", json={"selected": True}, headers=csrf(parent)
    )

    assert response.json() == {"code": "parent.locked"}


def test_selecting_loads_events_right_away(client, parent, connected):
    connected.set_events(
        MAMA, [timed("a", "2026-10-03T10:00:00+02:00", "2026-10-03T11:00:00+02:00")]
    )

    choose(client, parent, MAMA, None)

    assert stored_titles() == ["Termin"]
    assert calendars(client)[MAMA]["synced_at"] is not None


def test_status_shows_whether_a_calendar_is_selected(client, parent, connected):
    assert client.get("/api/calendar/status").json() == {"enabled": False}
    choose(client, parent, MAMA, None)
    # Das Display braucht keinen entsperrten Elternbereich.
    client.post("/api/parent/lock", headers=csrf(parent))

    assert client.get("/api/calendar/status").json() == {"enabled": True}


def test_deselecting_removes_events(client, parent, connected):
    connected.set_events(
        MAMA, [timed("a", "2026-10-03T10:00:00+02:00", "2026-10-03T11:00:00+02:00")]
    )
    choose(client, parent, MAMA, None)

    choose(client, parent, MAMA, None, selected=False)

    assert stored_titles() == []
    assert calendars(client)[MAMA]["synced_at"] is None


def test_deleting_member_deselects_their_calendars(client, parent, connected):
    lena = add_member(client, parent)
    connected.set_events(
        MAMA, [timed("a", "2026-10-03T10:00:00+02:00", "2026-10-03T11:00:00+02:00")]
    )
    choose(client, parent, MAMA, lena)

    client.delete(f"/api/members/{lena}", headers=csrf(parent))

    found = calendars(client)[MAMA]
    assert (found["selected"], found["member_id"]) == (False, None)
    assert stored_titles() == []


def test_family_color(client, parent, configured):
    response = client.put(
        "/api/calendar/family-color", json={"color": "slate"}, headers=csrf(parent)
    )
    assert response.status_code == 200
    assert response.json()["family_color"] == "slate"

    invalid = client.put("/api/calendar/family-color", json={"color": "gold"}, headers=csrf(parent))
    assert invalid.status_code == 422


def test_disconnect_removes_calendars_and_events(client, parent, connected):
    connected.set_events(
        MAMA, [timed("a", "2026-10-03T10:00:00+02:00", "2026-10-03T11:00:00+02:00")]
    )
    choose(client, parent, MAMA, None)
    [connection] = calendar_settings(client)["connections"]

    client.delete(f"/api/calendar/connections/{connection['id']}", headers=csrf(parent))

    assert stored_titles() == []
    assert client.get("/api/calendar/status").json() == {"enabled": False}


# --- Synchronisation ------------------------------------------------------------------


def test_sync_loads_window_around_current_week(client, parent, connected):
    choose(client, parent, MAMA, None)
    connected.api_requests.clear()

    # Zeitraum rückt weiter (anderer Tag als beim Auswählen): neu laden.
    sync()

    [window] = connected.api_calls("window")
    # Samstag, 3.10.: Woche ab 28.9., Zeitraum ab vier Wochen davor, Mitternacht in Berlin.
    assert window["timeMin"] == "2026-08-31T00:00:00+02:00"
    assert window["timeMax"] == "2027-03-01T00:00:00+01:00"
    assert window["singleEvents"] == "true"


def test_sync_only_reloads_after_changes(client, parent, connected):
    connected.set_events(
        MAMA, [timed("a", "2026-10-03T10:00:00+02:00", "2026-10-03T11:00:00+02:00")]
    )
    choose(client, parent, MAMA, None)
    sync()
    connected.api_requests.clear()

    sync(SATURDAY_NIGHT_UTC + dt.timedelta(minutes=5))
    assert connected.api_calls("window") == []
    assert len(connected.api_calls("changes")) == 1

    connected.set_events(
        MAMA, [timed("b", "2026-10-03T12:00:00+02:00", "2026-10-03T13:00:00+02:00", "Neu")]
    )
    sync(SATURDAY_NIGHT_UTC + dt.timedelta(minutes=10))
    assert len(connected.api_calls("window")) == 1
    assert stored_titles() == ["Neu"]


def test_sync_reloads_regularly_even_without_changes(client, parent, connected):
    choose(client, parent, MAMA, None)
    sync()
    connected.api_requests.clear()

    sync(SATURDAY_NIGHT_UTC + calendar_sync.FULL_RELOAD_AFTER)

    assert len(connected.api_calls("window")) == 1


def test_expired_sync_token_starts_over(client, parent, connected):
    choose(client, parent, MAMA, None)
    sync()
    connected.expired_sync_tokens.add(connected.sync_token(MAMA))
    connected.api_requests.clear()

    sync(SATURDAY_NIGHT_UTC + dt.timedelta(minutes=5))

    assert len(connected.api_calls("initial")) == 1
    assert len(connected.api_calls("window")) == 1
    assert calendars(client)[MAMA]["sync_error"] is None


def test_sync_skips_cancelled_and_reads_all_pages(client, parent, connected):
    connected.page_size = 2
    connected.set_events(
        MAMA,
        [
            timed("a", "2026-10-03T08:00:00+02:00", "2026-10-03T09:00:00+02:00", "Eins"),
            timed("b", "2026-10-03T09:00:00+02:00", "2026-10-03T10:00:00+02:00", "Zwei"),
            {"id": "c", "status": "cancelled"},
            all_day("d", "2026-10-04", "2026-10-05", "Drei"),
        ],
    )

    choose(client, parent, MAMA, None)

    assert stored_titles() == ["Drei", "Eins", "Zwei"]


@pytest.mark.parametrize(
    ("error", "code"),
    [
        ((403, "rateLimitExceeded"), "calendar.rate_limited"),
        ((429, "rateLimitExceeded"), "calendar.rate_limited"),
        ((404, "notFound"), "calendar.calendar_unavailable"),
        ((500, "backendError"), "calendar.google_failed"),
    ],
)
def test_sync_error_keeps_old_events(client, parent, connected, error, code):
    connected.set_events(
        MAMA, [timed("a", "2026-10-03T10:00:00+02:00", "2026-10-03T11:00:00+02:00")]
    )
    choose(client, parent, MAMA, None)
    connected.api_errors[MAMA] = error

    sync(SATURDAY_NIGHT_UTC + calendar_sync.FULL_RELOAD_AFTER)

    assert calendars(client)[MAMA]["sync_error"] == code
    assert stored_titles() == ["Termin"]

    # Beim nächsten Mal klappt es wieder.
    del connected.api_errors[MAMA]
    sync(SATURDAY_NIGHT_UTC + 2 * calendar_sync.FULL_RELOAD_AFTER)
    assert calendars(client)[MAMA]["sync_error"] is None


def test_google_unreachable(client, parent, connected, now):
    choose(client, parent, MAMA, None)
    connected.unreachable = True

    sync(SATURDAY_NIGHT_UTC + calendar_sync.FULL_RELOAD_AFTER)

    assert calendars(client)[MAMA]["sync_error"] == "calendar.google_unreachable"
    assert week(client)["problem"] is True


def test_revoked_access_marks_calendars(client, parent, connected, now):
    choose(client, parent, MAMA, None)
    connected.refresh_error = "invalid_grant"

    # Zugriffstoken abgelaufen, Erneuern scheitert.
    sync(dt.datetime.now(dt.UTC) + dt.timedelta(hours=2))

    [connection] = calendar_settings(client)["connections"]
    assert connection["status"] == "reconnect"
    assert calendars(client)[MAMA]["sync_error"] == "calendar.reconnect"
    assert week(client)["problem"] is True


def test_sync_now(client, parent, connected):
    connected.set_events(FAMILY, [all_day("a", "2026-10-03", "2026-10-04", "Ausflug")])
    calendar_id = calendars(client)["Familie"]["id"]
    with SessionLocal() as db:
        from app.models import Calendar

        db.get(Calendar, calendar_id).selected = True
        db.commit()

    response = client.post("/api/calendar/sync", headers=csrf(parent))

    assert response.status_code == 200
    [connection] = response.json()["connections"]
    [family] = [c for c in connection["calendars"] if c["name"] == "Familie"]
    assert family["synced_at"] is not None
    assert stored_titles() == ["Ausflug"]


def test_sync_now_needs_configuration(client, parent):
    response = client.post("/api/calendar/sync", headers=csrf(parent))

    assert response.json() == {"code": "calendar.not_configured"}


def test_parse_event():
    assert calendar_sync.parse_event({"id": "x", "status": "cancelled"}) is None
    event = calendar_sync.parse_event(
        {"id": "x", "summary": "  ", "start": {"date": "2026-10-03"}, "end": {}}
    )
    assert event["title"] is None
    assert (event["start_date"], event["end_date"]) == (dt.date(2026, 10, 3), dt.date(2026, 10, 4))
    assert calendar_sync.parse_event({"id": "x", "start": {"dateTime": "kaputt"}}) is None


# --- Wochenansicht --------------------------------------------------------------------


def test_week_groups_events_by_day_in_family_timezone(client, parent, connected, now):
    connected.set_events(
        MAMA,
        [
            # 23:30 UTC am Freitag ist Samstag, 01:30 in Berlin.
            timed("nacht", "2026-10-02T23:30:00Z", "2026-10-03T00:30:00Z", "Nachts"),
            timed("spaet", "2026-10-03T18:00:00+02:00", "2026-10-03T19:00:00+02:00", "Später"),
            all_day("fest", "2026-10-03", "2026-10-04", "Feiertag"),
            timed("naechste", "2026-10-05T10:00:00+02:00", "2026-10-05T11:00:00+02:00"),
        ],
    )
    choose(client, parent, MAMA, None)

    data = week(client)

    assert (data["start"], data["today"]) == ("2026-09-28", "2026-10-03")
    assert data["timezone"] == "Europe/Berlin"
    assert data["family_color"] == "pink"
    assert data["problem"] is False
    days = titles_by_day(data)
    assert list(days) == [
        f"2026-{d}" for d in ("09-28", "09-29", "09-30", "10-01", "10-02", "10-03", "10-04")
    ]
    assert days["2026-10-02"] == []
    # Ganztägige zuerst, dann nach Uhrzeit.
    assert days["2026-10-03"] == ["Feiertag", "Nachts", "Später"]

    assert titles_by_day(week(client, offset=1))["2026-10-05"] == ["Termin"]


def test_week_multi_day_events(client, parent, connected, now):
    connected.set_events(
        MAMA,
        [
            all_day("urlaub", "2026-10-01", "2026-10-06", "Urlaub"),
            timed(
                "nacht", "2026-09-29T22:00:00+02:00", "2026-09-30T02:00:00+02:00", "Nachtschicht"
            ),
        ],
    )
    choose(client, parent, MAMA, None)

    days = {day["date"]: day["events"] for day in week(client)["days"]}

    assert [e["title"] for e in days["2026-09-30"]] == ["Nachtschicht"]
    night = days["2026-09-29"][0]
    assert (night["continues_before"], night["continues_after"]) == (False, True)
    assert days["2026-09-30"][0]["continues_before"] is True
    assert "Urlaub" not in [e["title"] for e in days["2026-09-30"]]
    first, middle = days["2026-10-01"][0], days["2026-10-03"][0]
    assert (first["all_day"], first["continues_before"], first["continues_after"]) == (
        True,
        False,
        True,
    )
    assert (middle["continues_before"], middle["continues_after"]) == (True, True)
    assert (middle["start"], middle["end"]) == ("2026-10-01", "2026-10-06")


def test_week_merges_same_event_from_several_calendars(client, parent, connected, now):
    lena = add_member(client, parent)
    shared = timed("fest", "2026-10-03T15:00:00+02:00", "2026-10-03T18:00:00+02:00", "Geburtstag")
    connected.set_events(MAMA, [shared])
    connected.set_events(FAMILY, [{**shared, "id": "anders"}])
    choose(client, parent, MAMA, lena)
    choose(client, parent, "Familie", None)

    [event] = next(d for d in week(client)["days"] if d["date"] == "2026-10-03")["events"]

    assert event["title"] == "Geburtstag"
    assert (event["member_ids"], event["family"]) == ([lena], True)
    assert event["start"] == "2026-10-03T13:00:00Z"


def test_week_hides_deselected_calendars(client, parent, connected, now):
    connected.set_events(MAMA, [all_day("a", "2026-10-03", "2026-10-04")])
    choose(client, parent, MAMA, None)
    with SessionLocal() as db:
        from app.models import Calendar

        for calendar in db.scalars(select(Calendar)):
            calendar.selected = False
        db.commit()

    assert all(day["events"] == [] for day in week(client)["days"])


def test_week_is_for_the_display(client, admin, now):
    assert client.get("/api/calendar/week").status_code == 200
    assert client.get("/api/calendar/week", params={"offset": 60}).status_code == 422
    client.cookies.clear()
    assert client.get("/api/calendar/week").status_code == 401
