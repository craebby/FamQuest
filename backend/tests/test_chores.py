import datetime as dt

import pytest

from app.chores import chore_state
from tests.conftest import SATURDAY, csrf
from tests.test_tasks import add_member

BROOM = "fluent-emoji-flat:broom"
TOILET = "fluent-emoji-flat:toilet"
TODAY = dt.date.fromisoformat(SATURDAY)


def add_room(client, me, name="Bad oben", icon=TOILET) -> dict:
    response = client.post("/api/chores/rooms", json={"name": name, "icon": icon}, headers=csrf(me))
    assert response.status_code == 201, response.text
    return response.json()


def add_chore(client, me, room_id, title="Toilette putzen", interval_days=14, **body) -> dict:
    response = client.post(
        "/api/chores",
        json={
            "room_id": room_id,
            "title": title,
            "icon": TOILET,
            "interval_days": interval_days,
            **body,
        },
        headers=csrf(me),
    )
    assert response.status_code == 201, response.text
    return response.json()


def done(client, me, chore_id, member_id=None):
    return client.put(
        f"/api/chores/{chore_id}/done", json={"member_id": member_id}, headers=csrf(me)
    )


def plan(client) -> dict:
    response = client.get("/api/chores")
    assert response.status_code == 200, response.text
    return response.json()


def chore(client, chore_id) -> dict:
    return next(item for item in plan(client)["chores"] if item["id"] == chore_id)


@pytest.mark.parametrize(
    ("elapsed", "level", "days_left"),
    [(0, "ok", 10), (6, "ok", 4), (7, "soon", 3), (9, "soon", 1), (10, "due", 0), (25, "due", -15)],
)
def test_traffic_light(elapsed, level, days_left):
    state = chore_state(TODAY - dt.timedelta(days=elapsed), 10, TODAY)

    assert (state.level, state.days_left) == (level, days_left)
    assert state.due_date == TODAY + dt.timedelta(days=days_left)
    assert state.ratio == elapsed / 10


@pytest.mark.parametrize(("elapsed", "level"), [(300, "ok"), (350, "ok"), (351, "soon")])
def test_long_intervals_turn_yellow_two_weeks_ahead_at_most(elapsed, level):
    # 300 von 365 Tagen sind über 70 %, aber noch gut zwei Monate hin.
    assert chore_state(TODAY - dt.timedelta(days=elapsed), 365, TODAY).level == level


def test_done_in_the_future_counts_as_today():
    state = chore_state(TODAY + dt.timedelta(days=1), 7, TODAY)

    assert (state.level, state.days_left, state.ratio) == ("ok", 7, 0)


def test_empty_plan(client, admin, now):
    assert plan(client) == {
        "date": SATURDAY,
        "rooms": [],
        "chores": [],
        "share_days": 30,
        "shares": [],
    }


def test_needs_login(client):
    assert client.get("/api/chores").status_code == 401


def test_managing_needs_parent_pin(client, admin):
    response = client.post(
        "/api/chores/rooms", json={"name": "Bad", "icon": TOILET}, headers=csrf(admin)
    )

    assert response.status_code == 403
    assert response.json()["code"] == "parent.locked"


def test_create_room_and_chore(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"])

    assert room == {"id": room["id"], "name": "Bad oben", "icon": TOILET}
    # Ohne Angabe startet eine neue Aufgabe mittendrin: halber Abstand ist schon um.
    assert created == {
        "id": created["id"],
        "room_id": room["id"],
        "title": "Toilette putzen",
        "icon": TOILET,
        "interval_days": 14,
        "active": True,
        "last_done": None,
        "done_today": False,
        "done_by": None,
        "counted_from": "2026-09-26",
        "due_date": "2026-10-10",
        "days_left": 7,
        "ratio": 0.5,
        "level": "ok",
    }
    assert plan(client) == {
        "date": SATURDAY,
        "rooms": [room],
        "chores": [created],
        "share_days": 30,
        "shares": [],
    }


@pytest.mark.parametrize(
    ("state", "level", "days_left"), [("fresh", "ok", 14), ("half", "ok", 7), ("due", "due", 0)]
)
def test_start_state(client, parent, now, state, level, days_left):
    room = add_room(client, parent)

    created = add_chore(client, parent, room["id"], state=state)

    assert (created["level"], created["days_left"]) == (level, days_left)


def test_today_follows_the_family_timezone(client, parent, now):
    # In UTC ist noch Freitag, in Berlin schon Samstag.
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], state="fresh")

    assert plan(client)["date"] == SATURDAY
    assert created["due_date"] == "2026-10-17"


def test_room_names_are_unique(client, parent):
    add_room(client, parent, "Bad")
    other = add_room(client, parent, "Küche")

    duplicate = client.post(
        "/api/chores/rooms", json={"name": " bad ", "icon": TOILET}, headers=csrf(parent)
    )
    renamed = client.put(
        f"/api/chores/rooms/{other['id']}",
        json={"name": "BAD", "icon": TOILET},
        headers=csrf(parent),
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "chore.room_duplicate"
    assert renamed.status_code == 409


def test_rename_room(client, parent):
    room = add_room(client, parent, "Bad")

    response = client.put(
        f"/api/chores/rooms/{room['id']}",
        json={"name": "Bad unten", "icon": BROOM},
        headers=csrf(parent),
    )

    assert response.json() == {"id": room["id"], "name": "Bad unten", "icon": BROOM}


def test_delete_room_takes_its_chores_along(client, parent, now):
    room = add_room(client, parent)
    add_chore(client, parent, room["id"])

    response = client.delete(f"/api/chores/rooms/{room['id']}", headers=csrf(parent))

    assert response.status_code == 204
    assert plan(client) == {
        "date": SATURDAY,
        "rooms": [],
        "chores": [],
        "share_days": 30,
        "shares": [],
    }


def test_chore_needs_an_existing_room(client, parent):
    response = client.post(
        "/api/chores",
        json={"room_id": 99, "title": "Putzen", "icon": BROOM, "interval_days": 7},
        headers=csrf(parent),
    )

    assert response.status_code == 404
    assert response.json()["code"] == "chore.room_not_found"


@pytest.mark.parametrize("interval_days", [0, -3, 1096])
def test_interval_must_be_sensible(client, parent, interval_days):
    room = add_room(client, parent)

    response = client.post(
        "/api/chores",
        json={
            "room_id": room["id"],
            "title": "Putzen",
            "icon": BROOM,
            "interval_days": interval_days,
        },
        headers=csrf(parent),
    )

    assert response.status_code == 422


def test_done_without_parent_pin_resets_the_clock(client, parent, admin, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], state="due")
    client.post("/api/parent/lock", headers=csrf(admin))

    response = done(client, admin, created["id"])

    assert response.status_code == 200, response.text
    assert response.json() | {"id": 0} == created | {
        "id": 0,
        "last_done": SATURDAY,
        "done_today": True,
        "counted_from": SATURDAY,
        "due_date": "2026-10-17",
        "days_left": 14,
        "ratio": 0,
        "level": "ok",
    }


def test_who_did_it_can_be_added_afterwards(client, parent, now):
    lena = add_member(client, parent)
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"])

    done(client, parent, created["id"])
    assert chore(client, created["id"])["done_by"] is None
    response = done(client, parent, created["id"], lena)

    assert response.json()["done_by"] == lena
    assert chore(client, created["id"])["done_by"] == lena


def test_done_by_unknown_member(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"])

    response = done(client, parent, created["id"], 99)

    assert response.status_code == 404
    assert response.json()["code"] == "member.not_found"
    assert chore(client, created["id"])["done_today"] is False


def test_undo_returns_to_the_state_before(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], state="due")
    done(client, parent, created["id"])

    response = client.delete(f"/api/chores/{created['id']}/done", headers=csrf(parent))

    assert response.json() == created
    # Nochmal zurücknehmen schadet nicht.
    again = client.delete(f"/api/chores/{created['id']}/done", headers=csrf(parent))
    assert again.json() == created


def test_overdue_counts_once_and_undo_keeps_earlier_days(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], interval_days=7, state="fresh")
    done(client, parent, created["id"])

    # 20 Tage später: einmal fällig, 13 Tage drüber, nicht dreimal verpasst.
    now["value"] += dt.timedelta(days=20)
    late = chore(client, created["id"])
    assert (late["level"], late["days_left"], late["done_today"]) == ("due", -13, False)
    assert late["last_done"] == SATURDAY

    done(client, parent, created["id"])
    client.delete(f"/api/chores/{created['id']}/done", headers=csrf(parent))
    assert chore(client, created["id"]) == late


def test_changing_the_interval_counts_from_the_last_time(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], interval_days=14, state="fresh")
    done(client, parent, created["id"])
    now["value"] += dt.timedelta(days=6)

    response = client.put(
        f"/api/chores/{created['id']}",
        json={
            "room_id": room["id"],
            "title": "Klo putzen",
            "icon": BROOM,
            "interval_days": 7,
            "active": False,
        },
        headers=csrf(parent),
    )

    updated = response.json()
    assert (updated["title"], updated["icon"], updated["active"]) == ("Klo putzen", BROOM, False)
    assert (updated["level"], updated["days_left"]) == ("soon", 1)


def update(client, me, created, **changes):
    body = {key: created[key] for key in ("room_id", "title", "icon", "interval_days", "active")}
    return client.put(f"/api/chores/{created['id']}", json=body | changes, headers=csrf(me))


def test_new_chore_was_last_done_weeks_ago(client, parent, now):
    # Fenster vor zehn Wochen geputzt, dran jedes halbe Jahr: nicht wieder bei null anfangen.
    room = add_room(client, parent)

    created = add_chore(
        client, parent, room["id"], interval_days=180, state="due", counted_from="2026-07-25"
    )

    assert (created["counted_from"], created["due_date"]) == ("2026-07-25", "2027-01-21")
    assert (created["level"], created["days_left"], created["last_done"]) == ("ok", 110, None)


def test_last_done_can_be_set_afterwards(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], interval_days=180, state="due")

    response = update(client, parent, created, counted_from="2026-07-25")

    assert response.status_code == 200, response.text
    updated = response.json()
    assert (updated["counted_from"], updated["days_left"]) == ("2026-07-25", 110)
    assert chore(client, created["id"]) == updated
    # Ein Tipp am Display zählt danach wieder ab heute.
    assert done(client, parent, created["id"]).json()["counted_from"] == SATURDAY


def test_last_done_before_a_completion_removes_it(client, parent, now):
    lena = add_member(client, parent)
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], state="fresh")
    now["value"] += dt.timedelta(days=3)
    done(client, parent, created["id"], lena)
    now["value"] += dt.timedelta(days=1)

    # Versehentlich abgehakt: Eigentlich war es schon am Samstag.
    updated = update(client, parent, created, counted_from=SATURDAY).json()

    assert (updated["counted_from"], updated["last_done"], updated["days_left"]) == (
        SATURDAY,
        None,
        10,
    )
    assert plan(client)["shares"] == []


def test_last_done_after_a_completion_keeps_it(client, parent, now):
    lena = add_member(client, parent)
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], state="due")
    done(client, parent, created["id"], lena)
    now["value"] += dt.timedelta(days=5)

    # Zwischendurch geputzt, ohne am Display zu tippen.
    updated = update(client, parent, created, counted_from="2026-10-06").json()

    assert (updated["counted_from"], updated["last_done"], updated["days_left"]) == (
        "2026-10-06",
        SATURDAY,
        12,
    )
    assert plan(client)["shares"] == [{"member_id": lena, "count": 1}]


def test_unchanged_last_done_keeps_completions(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"], state="due")
    before = done(client, parent, created["id"]).json()

    response = update(client, parent, created, title="Klo putzen", counted_from=SATURDAY)

    assert response.json() == before | {"title": "Klo putzen"}


def test_last_done_cannot_be_in_the_future(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"])

    changed = update(client, parent, created, counted_from="2026-10-04")
    new = client.post(
        "/api/chores",
        json={
            "room_id": room["id"],
            "title": "Putzen",
            "icon": BROOM,
            "interval_days": 7,
            "counted_from": "2026-10-04",
        },
        headers=csrf(parent),
    )

    assert (changed.status_code, new.status_code) == (422, 422)
    assert changed.json()["code"] == new.json()["code"] == "chore.counted_from_future"
    assert chore(client, created["id"]) == created


def test_delete_chore(client, parent, now):
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"])

    response = client.delete(f"/api/chores/{created['id']}", headers=csrf(parent))

    assert response.status_code == 204
    assert plan(client)["chores"] == []
    assert done(client, parent, created["id"]).json()["code"] == "chore.not_found"


def test_completion_survives_deleting_the_member(client, parent, now):
    lena = add_member(client, parent)
    room = add_room(client, parent)
    created = add_chore(client, parent, room["id"])
    done(client, parent, created["id"], lena)

    client.delete(f"/api/members/{lena}", headers=csrf(parent))

    after = chore(client, created["id"])
    assert (after["done_today"], after["done_by"]) == (True, None)


SETUP = {
    "rooms": [
        {
            "name": "Küche",
            "icon": BROOM,
            "chores": [
                {"title": "Müll rausbringen", "icon": BROOM, "interval_days": 3},
                {"title": "Kühlschrank auswischen", "icon": BROOM, "interval_days": 30},
                {"title": "Backofen reinigen", "icon": BROOM, "interval_days": 90},
            ],
        },
        {
            "name": "Bad oben",
            "icon": TOILET,
            "chores": [{"title": "Toilette putzen", "icon": TOILET, "interval_days": 7}],
        },
    ]
}


def run_setup_wizard(client, me, body=SETUP):
    return client.post("/api/chores/setup", json=body, headers=csrf(me))


def test_wizard_creates_rooms_and_chores(client, parent, now):
    response = run_setup_wizard(client, parent)

    assert response.status_code == 201, response.text
    assert response.json() == {"rooms": 2, "chores": 4}
    result = plan(client)
    assert [room["name"] for room in result["rooms"]] == ["Küche", "Bad oben"]
    assert [item["title"] for item in result["chores"]] == [
        "Müll rausbringen",
        "Kühlschrank auswischen",
        "Backofen reinigen",
        "Toilette putzen",
    ]


def test_wizard_spreads_the_start_and_nothing_is_due(client, parent, now):
    run_setup_wizard(client, parent)

    chores = plan(client)["chores"]
    assert all(item["level"] != "due" for item in chores)
    assert len({item["ratio"] for item in chores}) > 1


def test_wizard_can_run_again_without_duplicates(client, parent, now):
    kitchen = add_room(client, parent, "küche")
    add_chore(client, parent, kitchen["id"], "müll rausbringen", 2)

    first = run_setup_wizard(client, parent)
    second = run_setup_wizard(client, parent)

    assert first.json() == {"rooms": 1, "chores": 3}
    assert second.json() == {"rooms": 0, "chores": 0}
    result = plan(client)
    assert [room["name"] for room in result["rooms"]] == ["küche", "Bad oben"]
    assert len(result["chores"]) == 4


def test_wizard_needs_parent_pin(client, admin):
    assert run_setup_wizard(client, admin).status_code == 403


def test_shares_count_who_did_it_in_the_last_30_days(client, parent, now):
    lena = add_member(client, parent)
    tom = add_member(client, parent, "Tom", "green")
    room = add_room(client, parent)
    toilet = add_chore(client, parent, room["id"])
    floor = add_chore(client, parent, room["id"], title="Boden wischen")

    done(client, parent, toilet["id"], lena)
    now["value"] += dt.timedelta(days=29)
    done(client, parent, toilet["id"], tom)
    done(client, parent, floor["id"], tom)
    # Ohne „Wer war's?“ zählt die Erledigung für niemanden.
    anonymous = add_chore(client, parent, room["id"], title="Handtücher wechseln")
    done(client, parent, anonymous["id"])

    assert plan(client)["shares"] == [
        {"member_id": lena, "count": 1},
        {"member_id": tom, "count": 2},
    ]

    # Zurückgenommenes zählt nicht mehr, und nach 30 Tagen fällt Lenas Erledigung heraus.
    client.delete(f"/api/chores/{floor['id']}/done", headers=csrf(parent))
    now["value"] += dt.timedelta(days=1)
    assert plan(client)["shares"] == [{"member_id": tom, "count": 1}]
