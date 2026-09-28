import pytest

from app.event_symbols import SymbolMatcher
from tests.conftest import csrf
from tests.fake_google import timed
from tests.test_calendar import connect
from tests.test_calendar_sync import FAMILY, MAMA, choose, upcoming, week
from tests.test_tasks import add_member

JUDO = "fluent-emoji-flat:martial-arts-uniform"
TOOTH = "fluent-emoji-flat:tooth"
DOCTOR = "fluent-emoji-flat:stethoscope"
GRANDPARENTS = "fluent-emoji-flat:older-person"

RULES = [
    {"icon": JUDO, "terms": ["Judo", "Karate"]},
    {"icon": DOCTOR, "terms": ["Arzt"]},
    {"icon": TOOTH, "terms": ["Zahnarzt"]},
    {"icon": GRANDPARENTS, "terms": ["Oma", "Opa"]},
]


def set_symbols(client, me, symbols):
    return client.put("/api/calendar/symbols", json={"symbols": symbols}, headers=csrf(me))


@pytest.mark.parametrize(
    ("title", "icon"),
    [
        ("Judo", JUDO),
        ("JUDO-Training", JUDO),
        ("Karate mit Paul", JUDO),
        # Längster Begriff gewinnt.
        ("Kinderzahnarzt", TOOTH),
        ("Ärztin", DOCTOR),
        ("Kinderarzt", DOCTOR),
        # Kurze Begriffe nur als ganzes Wort (auch mit Plural-s).
        ("Zu Oma", GRANDPARENTS),
        ("Omas Geburtstag", GRANDPARENTS),
        ("Oma-Tag", GRANDPARENTS),
        ("Europa-Park", None),
        ("Diplomarbeit", None),
        ("Schwimmen", None),
        (None, None),
    ],
)
def test_matcher(title, icon):
    assert SymbolMatcher(RULES).icon_for(title) == icon


def test_matcher_without_rules():
    assert SymbolMatcher(None).icon_for("Judo") is None


def test_symbols_are_stored_for_the_family(client, parent):
    assert client.get("/api/calendar/symbols").json() == {"symbols": []}

    response = set_symbols(
        client, parent, [{"icon": JUDO, "terms": [" Judo ", "judo", "Karate  Kid", "JUDO"]}]
    )

    assert response.status_code == 200, response.text
    expected = {"symbols": [{"icon": JUDO, "terms": ["Judo", "Karate Kid"]}]}
    assert response.json() == expected
    assert client.get("/api/calendar/symbols").json() == expected


@pytest.mark.parametrize(
    "symbol",
    [
        {"icon": JUDO, "terms": []},
        {"icon": JUDO, "terms": ["  "]},
        {"icon": "<svg>", "terms": ["Judo"]},
        {"icon": JUDO, "terms": ["x" * 51]},
    ],
)
def test_invalid_symbols(client, parent, symbol):
    assert set_symbols(client, parent, [symbol]).status_code == 422


def test_symbols_need_unlocked_parent_area(client, admin):
    assert client.get("/api/calendar/symbols").status_code == 403
    assert set_symbols(client, admin, []).status_code == 403


def test_new_children_get_symbols_adults_not(client, parent):
    child = add_member(client, parent)
    adult = client.post(
        "/api/members",
        json={"name": "Mama", "role": "parent", "color": "blue"},
        headers=csrf(parent),
    ).json()
    members = {m["id"]: m["event_symbols"] for m in client.get("/api/members").json()}

    assert members == {child: True, adult["id"]: False}


def test_switch_symbols_per_member(client, parent):
    child = add_member(client, parent)
    body = {"name": "Lena", "role": "child", "color": "purple"}

    off = client.put(
        f"/api/members/{child}", json={**body, "event_symbols": False}, headers=csrf(parent)
    )
    assert off.json()["event_symbols"] is False
    # Ohne Angabe bleibt es, wie es ist.
    kept = client.put(f"/api/members/{child}", json=body, headers=csrf(parent))
    assert kept.json()["event_symbols"] is False


@pytest.fixture
def judo_week(client, parent, fake_google, now):
    fake_google.set_events(
        MAMA, [timed("j", "2026-10-03T10:00:00+02:00", "2026-10-03T11:00:00+02:00", "Judo")]
    )
    fake_google.set_events(
        FAMILY, [timed("o", "2026-10-03T15:00:00+02:00", "2026-10-03T18:00:00+02:00", "Zu Oma")]
    )
    connect(client, parent, fake_google)
    set_symbols(client, parent, RULES)
    return fake_google


def icons_on_saturday(client) -> dict[str, str | None]:
    day = next(d for d in week(client)["days"] if d["date"] == "2026-10-03")
    return {event["title"]: event["icon"] for event in day["events"]}


def test_events_of_members_with_symbols_get_icons(client, parent, judo_week):
    child = add_member(client, parent)
    choose(client, parent, MAMA, child)
    choose(client, parent, "Familie", None)

    assert icons_on_saturday(client) == {"Judo": JUDO, "Zu Oma": GRANDPARENTS}
    assert [e["icon"] for e in upcoming(client)["events"]] == [JUDO, GRANDPARENTS]


def test_no_icons_when_nobody_has_symbols(client, parent, judo_week):
    adult = client.post(
        "/api/members",
        json={"name": "Mama", "role": "parent", "color": "blue"},
        headers=csrf(parent),
    ).json()["id"]
    choose(client, parent, MAMA, adult)
    choose(client, parent, "Familie", None)

    assert icons_on_saturday(client) == {"Judo": None, "Zu Oma": None}
