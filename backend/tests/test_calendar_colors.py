import pytest
from sqlalchemy import select, update

from app import google
from app.db import SessionLocal
from app.models import Calendar, CalendarColorRule
from tests.conftest import csrf
from tests.fake_google import all_day, timed
from tests.test_calendar import connect
from tests.test_calendar_events import create, event_on_saturday, put
from tests.test_calendar_sync import (
    FAMILY,
    WINDOW_START,
    calendars,
    choose,
    loaded,
    sync,
    titles_by_day,
    week,
)
from tests.test_members import create as create_member

SATURDAY = "2026-10-03"
TIMES = ("2026-10-03T15:00:00+02:00", "2026-10-03T16:00:00+02:00")


@pytest.fixture
def source(client, parent, fake_google, now, lena):
    """Eine Quelle für alle: Familienkalender, Personen über Farben (1 und 3 Lena, 6 Stefan)."""
    fake_google.scope = f"openid email {google.CALENDAR_SCOPE} {google.EVENTS_SCOPE}"
    fake_google.calendars[1]["accessRole"] = "owner"
    connect(client, parent, fake_google)
    choose(client, parent, "Familie", None)
    loaded(WINDOW_START)
    stefan = create_member(client, parent, name="Stefan", color="blue", role="parent").json()["id"]
    response = set_rules(
        client, parent, {"1": lena, "3": lena, "6": stefan, "11": None}, name="Familie"
    )
    assert response.status_code == 200, response.text
    return fake_google


def set_rules(client, me, rules: dict[str, int | None], name="Familie"):
    return client.put(
        f"/api/calendar/calendars/{calendars(client)[name]['id']}/colors",
        json={"rules": [{"color_id": c, "member_id": m} for c, m in rules.items()]},
        headers=csrf(me),
    )


def colored(event_id: str, color: str | None, title: str = "Termin") -> dict:
    extra = {"colorId": color} if color else {}
    return timed(event_id, *TIMES, title=title, **extra)


def show(fake_google, *events) -> None:
    fake_google.set_events(FAMILY, list(events))
    sync()


def test_rules_are_in_the_settings(client, source, lena):
    rules = calendars(client)["Familie"]["color_rules"]

    assert [rule["color_id"] for rule in rules] == ["1", "3", "6", "11"]
    assert rules[0]["member_id"] == lena
    assert rules[3]["member_id"] is None


def test_rules_are_replaced_as_a_whole(client, parent, source):
    response = set_rules(client, parent, {"5": None})

    assert response.status_code == 200, response.text
    assert [rule["color_id"] for rule in calendars(client)["Familie"]["color_rules"]] == ["5"]


def test_rules_need_the_parent_pin(client, parent, source):
    calendar = calendars(client)["Familie"]["id"]
    client.post("/api/parent/lock", headers=csrf(parent))

    response = client.put(
        f"/api/calendar/calendars/{calendar}/colors", json={"rules": []}, headers=csrf(parent)
    )

    assert response.json()["code"] == "parent.locked"


@pytest.mark.parametrize("color", ["0", "12", "rot"])
def test_rules_accept_only_google_colors(client, parent, source, color):
    assert set_rules(client, parent, {color: None}).status_code == 422


def test_rule_for_unknown_member(client, parent, source):
    response = set_rules(client, parent, {"1": 999999})

    assert response.status_code == 404
    assert response.json()["code"] == "member.not_found"


def test_deleting_a_member_ends_the_rule(client, parent, source):
    stefan = next(r for r in calendars(client)["Familie"]["color_rules"] if r["color_id"] == "6")

    client.delete(f"/api/members/{stefan['member_id']}", headers=csrf(parent))

    with SessionLocal() as db:
        colors = set(db.scalars(select(CalendarColorRule.color_id)))
    assert colors == {"1", "3", "11"}


def test_color_decides_the_person(client, source, lena):
    show(source, colored("a", "1"), colored("b", "3"))

    [first, second] = next(d for d in week(client)["days"] if d["date"] == SATURDAY)["events"]
    assert (first["member_ids"], first["family"]) == ([lena], False)
    assert (second["member_ids"], second["family"]) == ([lena], False)


def test_no_color_or_no_rule_goes_to_the_calendar(client, source):
    show(source, colored("a", None), colored("b", "5"))

    events = next(d for d in week(client)["days"] if d["date"] == SATURDAY)["events"]
    assert [(e["member_ids"], e["family"]) for e in events] == [([], True), ([], True)]


def test_no_rule_goes_to_the_person_of_the_calendar(client, parent, source, lena):
    other = calendars(client)["Familie"]["color_rules"][2]["member_id"]
    choose(client, parent, "Familie", other)
    show(source, colored("a", "5"), colored("b", "1"))

    events = next(d for d in week(client)["days"] if d["date"] == SATURDAY)["events"]
    assert sorted(e["member_ids"][0] for e in events) == sorted([other, lena])


def test_hidden_color_is_gone_everywhere(client, source):
    show(source, colored("a", "11", "Feiertag"), colored("b", None, "Zahnarzt"))

    assert titles_by_day(week(client))[SATURDAY] == ["Zahnarzt"]
    upcoming = client.get("/api/calendar/upcoming", params={"limit": 20}).json()["events"]
    assert [event["title"] for event in upcoming] == ["Zahnarzt"]


def test_hidden_all_day_event(client, source):
    show(source, all_day("a", SATURDAY, "2026-10-04", "Feiertag", colorId="11"))

    assert titles_by_day(week(client))[SATURDAY] == []


def test_rule_changes_work_without_a_new_download(client, parent, source):
    show(source, colored("a", "11"))
    calls = len(source.api_calls("window"))

    set_rules(client, parent, {})

    assert titles_by_day(week(client))[SATURDAY] == ["Termin"]
    assert len(source.api_calls("window")) == calls


def test_recolored_event_moves_to_the_other_person(client, source, lena):
    show(source, colored("a", None))
    assert event_on_saturday(client)["family"] is True

    show(source, colored("a", "1"))

    assert event_on_saturday(client)["member_ids"] == [lena]


def test_choices_come_with_the_week(client, source, lena):
    stefan = calendars(client)["Familie"]["color_rules"][2]["member_id"]
    show(source, colored("a", None))
    expected = [None, *sorted([lena, stefan])]

    assert week(client)["writable_calendars"][0]["person_choices"] == expected
    assert event_on_saturday(client)["person_choices"] == expected


def test_calendar_without_colors_offers_no_choice(client, parent, source):
    set_rules(client, parent, {"11": None})
    show(source, colored("a", None))

    assert week(client)["writable_calendars"][0]["person_choices"] == []
    assert event_on_saturday(client)["person_choices"] == []


def test_old_events_are_reloaded_for_their_color(client, source):
    """Die Migration setzt `window_loaded_at` zurück; danach kommen die Farben von Google."""
    show(source, colored("a", "1"))
    with SessionLocal() as db:
        db.execute(update(Calendar).values(window_loaded_at=None))
        db.commit()
    calls = len(source.api_calls("window"))

    sync()

    assert len(source.api_calls("window")) == calls + 1


# --- Zurückschreiben -------------------------------------------------------------------


def family_id(client) -> int:
    return calendars(client)["Familie"]["id"]


def test_create_writes_the_first_color_of_the_person(client, parent, source, lena):
    response = create(client, parent, family_id(client), member_id=lena)

    assert response.status_code == 204, response.text
    [(_, _, _, body)] = source.writes
    assert body["colorId"] == "1"
    assert event_on_saturday(client)["member_ids"] == [lena]


def test_create_for_the_family_needs_no_color(client, parent, source):
    create(client, parent, family_id(client), member_id=None)

    assert "colorId" not in source.writes[0][3]


def test_create_without_person_needs_no_color(client, parent, source):
    create(client, parent, family_id(client))

    assert "colorId" not in source.writes[0][3]


def test_create_for_a_person_without_color(client, parent, source):
    other = create_member(client, parent, name="Oma", color="green", role="parent").json()["id"]

    create(client, parent, family_id(client), member_id=other)

    assert "colorId" not in source.writes[0][3]


def test_update_writes_the_color(client, parent, source, lena):
    show(source, colored("a", None, "Zahnarzt"))

    response = put(client, parent, event_on_saturday(client)["key"], member_id=lena)

    assert response.status_code == 204, response.text
    assert source.writes == [("PATCH", FAMILY, "a", {"colorId": "1"})]
    assert event_on_saturday(client)["member_ids"] == [lena]


def test_update_keeps_the_second_color_of_the_person(client, parent, source, lena):
    show(source, colored("a", "3", "Zahnarzt"))

    response = put(client, parent, event_on_saturday(client)["key"], member_id=lena)

    assert response.status_code == 204, response.text
    assert source.writes == []


def test_update_back_to_the_calendar_clears_the_color(client, parent, source):
    show(source, colored("a", "1", "Zahnarzt"))

    put(client, parent, event_on_saturday(client)["key"], member_id=None)

    assert source.writes == [("PATCH", FAMILY, "a", {"colorId": None})]
    assert event_on_saturday(client)["family"] is True


def test_update_without_person_leaves_the_color(client, parent, source, lena):
    show(source, colored("a", "1", "Zahnarzt"))

    put(client, parent, event_on_saturday(client)["key"], title="Neu")

    assert source.writes == [("PATCH", FAMILY, "a", {"summary": "Neu"})]
    assert event_on_saturday(client)["member_ids"] == [lena]


def test_update_title_and_person_together(client, parent, source, lena):
    show(source, colored("a", None, "Zahnarzt"))

    put(client, parent, event_on_saturday(client)["key"], title="Neu", member_id=lena)

    assert source.writes == [("PATCH", FAMILY, "a", {"summary": "Neu", "colorId": "1"})]


def test_update_of_a_series_occurrence_touches_only_that_one(client, parent, source, lena):
    show(source, timed("serie_1", *TIMES, recurringEventId="serie"))

    put(client, parent, event_on_saturday(client)["key"], title="Termin", member_id=lena)

    assert [write[2] for write in source.writes] == ["serie_1"]


def test_color_stays_after_the_next_sync(client, parent, source, lena):
    create(client, parent, family_id(client), member_id=lena)

    sync()

    assert event_on_saturday(client)["member_ids"] == [lena]


def test_hide_rule_is_never_written_back(client, parent, source, lena):
    """„Keine Person“ heißt bei Kalendern mit Person: zurück zur Person, nicht die Ausblendfarbe."""
    choose(client, parent, "Familie", lena)
    show(source, colored("a", "6", "Zahnarzt"))

    put(client, parent, event_on_saturday(client)["key"], member_id=None)

    assert source.writes == []


def test_calendar_without_rules_gets_no_color(client, parent, source, lena):
    set_rules(client, parent, {})

    response = create(client, parent, family_id(client), member_id=lena)

    assert response.status_code == 204, response.text
    assert "colorId" not in source.writes[0][3]
