import datetime as dt

from tests.conftest import SATURDAY, csrf
from tests.test_chores import TOILET, add_chore, add_room, plan
from tests.test_tasks import add_member

FEED = "fluent-emoji-flat:chicken"


def add_todo(client, me, title="Hühnerfutter holen", icon=FEED) -> dict:
    response = client.post("/api/todos", json={"title": title, "icon": icon}, headers=csrf(me))
    assert response.status_code == 201, response.text
    return response.json()


def done(client, me, todo_id, member_id=None):
    return client.put(f"/api/todos/{todo_id}/done", json={"member_id": member_id}, headers=csrf(me))


def todos(client) -> list[dict]:
    return plan(client)["todos"]


def test_needs_login(client):
    response = client.post("/api/todos", json={"title": "Putzen", "icon": FEED})

    assert response.status_code == 401


def test_add_without_parent_pin(client, admin, now):
    created = add_todo(client, admin, "  Hühnerfutter   holen ")

    assert created == {
        "id": created["id"],
        "title": "Hühnerfutter holen",
        "icon": FEED,
        "done": False,
        "done_by": None,
    }
    assert todos(client) == [created]


def test_same_open_todo_is_not_added_twice(client, admin, now):
    first = add_todo(client, admin)

    again = add_todo(client, admin, "hühnerfutter HOLEN", TOILET)

    assert again == first | {"icon": TOILET}
    assert todos(client) == [again]


def test_title_is_required(client, admin):
    response = client.post("/api/todos", json={"title": "  ", "icon": FEED}, headers=csrf(admin))

    assert response.status_code == 422
    assert response.json()["fields"] == {"title": "validation.too_short"}


def test_done_and_who_did_it_afterwards(client, parent, now):
    lena = add_member(client, parent)
    created = add_todo(client, parent)

    first = done(client, parent, created["id"])
    assert first.json() == created | {"done": True}
    second = done(client, parent, created["id"], lena)

    assert second.json() == created | {"done": True, "done_by": lena}
    assert todos(client) == [second.json()]
    assert plan(client)["shares"] == [{"member_id": lena, "count": 1}]


def test_done_by_unknown_member(client, admin, now):
    created = add_todo(client, admin)

    response = done(client, admin, created["id"], 99)

    assert response.status_code == 404
    assert response.json()["code"] == "member.not_found"
    assert todos(client) == [created]


def test_undo_puts_it_back_on_the_list(client, parent, now):
    lena = add_member(client, parent)
    created = add_todo(client, parent)
    done(client, parent, created["id"], lena)

    response = client.delete(f"/api/todos/{created['id']}/done", headers=csrf(parent))

    assert response.json() == created
    assert plan(client)["shares"] == []


def test_open_first_then_done_today(client, admin, now):
    feed = add_todo(client, admin)
    bulb = add_todo(client, admin, "Glühbirne wechseln")
    parcel = add_todo(client, admin, "Paket wegbringen")
    done(client, admin, feed["id"])

    assert [todo["title"] for todo in todos(client)] == [
        "Glühbirne wechseln",
        "Paket wegbringen",
        "Hühnerfutter holen",
    ]
    assert [bulb["done"], parcel["done"]] == [False, False]


def test_done_disappears_the_next_day_but_open_stays(client, parent, now):
    lena = add_member(client, parent)
    feed = add_todo(client, parent)
    bulb = add_todo(client, parent, "Glühbirne wechseln")
    done(client, parent, feed["id"], lena)

    now["value"] += dt.timedelta(days=1)

    assert todos(client) == [bulb]
    # Für die faire Verteilung zählt es weiter.
    assert plan(client)["shares"] == [{"member_id": lena, "count": 1}]
    # Was von der Liste ist, lässt sich nicht mehr zurücknehmen oder nochmal abhaken.
    undo = client.delete(f"/api/todos/{feed['id']}/done", headers=csrf(parent))
    assert undo.status_code == 404
    assert undo.json()["code"] == "todo.not_found"
    assert done(client, parent, feed["id"]).status_code == 404
    # Dasselbe kann wieder neu auf die Liste.
    assert add_todo(client, parent)["id"] != feed["id"]


def test_edit_title_and_icon(client, admin, now):
    created = add_todo(client, admin, "Hünerfutter holen")

    response = client.put(
        f"/api/todos/{created['id']}",
        json={"title": "  Hühnerfutter   holen ", "icon": TOILET},
        headers=csrf(admin),
    )

    assert response.status_code == 200
    assert response.json() == created | {"title": "Hühnerfutter holen", "icon": TOILET}
    assert todos(client) == [response.json()]
    # Nur die Schreibweise ändern geht; leer oder ohne CSRF nicht.
    same = client.put(
        f"/api/todos/{created['id']}",
        json={"title": "hühnerfutter holen", "icon": TOILET},
        headers=csrf(admin),
    )
    assert same.json()["title"] == "hühnerfutter holen"
    empty = client.put(
        f"/api/todos/{created['id']}", json={"title": " ", "icon": FEED}, headers=csrf(admin)
    )
    assert empty.status_code == 422
    unsafe = client.put(f"/api/todos/{created['id']}", json={"title": "Putzen", "icon": FEED})
    assert unsafe.status_code == 403


def test_edit_refuses_a_title_that_is_already_open(client, admin, now):
    add_todo(client, admin)
    bulb = add_todo(client, admin, "Glühbirne wechseln")

    response = client.put(
        f"/api/todos/{bulb['id']}",
        json={"title": "hühnerfutter HOLEN", "icon": FEED},
        headers=csrf(admin),
    )

    assert response.status_code == 409
    assert response.json()["code"] == "todo.duplicate"
    missing = client.put(
        "/api/todos/9999", json={"title": "Putzen", "icon": FEED}, headers=csrf(admin)
    )
    assert missing.json()["code"] == "todo.not_found"


def test_delete_without_doing_it(client, admin, now):
    created = add_todo(client, admin)

    response = client.delete(f"/api/todos/{created['id']}", headers=csrf(admin))

    assert response.status_code == 204
    assert todos(client) == []
    again = client.delete(f"/api/todos/{created['id']}", headers=csrf(admin))
    assert again.json()["code"] == "todo.not_found"


def test_shares_add_up_with_the_cleaning_plan(client, parent, now):
    lena = add_member(client, parent)
    tom = add_member(client, parent, "Tom", "blue")
    room = add_room(client, parent)
    chore = add_chore(client, parent, room["id"])
    client.put(f"/api/chores/{chore['id']}/done", json={"member_id": lena}, headers=csrf(parent))
    done(client, parent, add_todo(client, parent)["id"], lena)
    done(client, parent, add_todo(client, parent, "Paket wegbringen")["id"], tom)
    done(client, parent, add_todo(client, parent, "Glühbirne wechseln")["id"])

    assert plan(client)["shares"] == [
        {"member_id": lena, "count": 2},
        {"member_id": tom, "count": 1},
    ]

    # Nach 30 Tagen zählt es nicht mehr.
    now["value"] += dt.timedelta(days=30)
    assert plan(client)["shares"] == []


def test_done_survives_deleting_the_member(client, parent, now):
    lena = add_member(client, parent)
    created = add_todo(client, parent)
    done(client, parent, created["id"], lena)

    client.delete(f"/api/members/{lena}", headers=csrf(parent))

    assert todos(client) == [created | {"done": True}]


def test_comes_back_turns_an_open_todo_into_a_chore(client, parent, now):
    room = add_room(client, parent)
    feed = add_todo(client, parent)
    other = add_todo(client, parent, "Paket wegbringen")

    chore = add_chore(
        client, parent, room["id"], "Hühnerfutter holen", 30, state="due", todo_id=feed["id"]
    )

    assert (chore["title"], chore["level"]) == ("Hühnerfutter holen", "due")
    assert todos(client) == [other]


def test_comes_back_keeps_what_is_already_done(client, parent, now):
    lena = add_member(client, parent)
    room = add_room(client, parent)
    feed = add_todo(client, parent)
    done(client, parent, feed["id"], lena)

    add_chore(client, parent, room["id"], "Hühnerfutter holen", 30, todo_id=feed["id"])
    # Ein Eintrag, den es nicht mehr gibt, hält das Anlegen nicht auf.
    add_chore(client, parent, room["id"], "Paket wegbringen", 30, todo_id=999)

    assert todos(client) == [feed | {"done": True, "done_by": lena}]
    assert plan(client)["shares"] == [{"member_id": lena, "count": 1}]


def test_today_follows_the_family_timezone(client, admin, now):
    # In UTC ist noch Freitag, in Berlin schon Samstag: Um 22:30 UTC am Samstag ist dort Sonntag.
    created = add_todo(client, admin)
    done(client, admin, created["id"])
    assert plan(client)["date"] == SATURDAY

    now["value"] += dt.timedelta(hours=23)

    assert todos(client) == []
