import datetime as dt

from tests.conftest import csrf

MILK = "fluent-emoji-flat:glass-of-milk"
BREAD = "fluent-emoji-flat:bread"


def add(client, me, name="Milch", icon=MILK, **body) -> dict:
    response = client.post(
        "/api/shopping/list", json={"name": name, "icon": icon, **body}, headers=csrf(me)
    )
    assert response.status_code == 200, response.text
    return response.json()


def check(client, me, item_id, checked=True):
    return client.put(
        f"/api/shopping/list/{item_id}/checked", json={"checked": checked}, headers=csrf(me)
    )


def listed(client) -> list[dict]:
    response = client.get("/api/shopping/list")
    assert response.status_code == 200, response.text
    return response.json()["items"]


def names(client) -> list[tuple[str, bool]]:
    return [(item["name"], item["checked"]) for item in listed(client)]


def items(client) -> list[dict]:
    response = client.get("/api/shopping/items")
    assert response.status_code == 200, response.text
    return response.json()


def test_empty_list(client, admin):
    assert listed(client) == []
    assert items(client) == []


def test_needs_login(client):
    assert client.get("/api/shopping/list").status_code == 401


def test_add_without_parent_pin(client, admin, now):
    item = add(client, admin, note="2 ×")

    assert item == {
        "id": item["id"],
        "name": "Milch",
        "icon": MILK,
        "note": "2 ×",
        "checked": False,
        "area": None,
        "position": None,
    }
    assert listed(client) == [item]
    assert items(client) == [
        {"id": item["id"], "name": "Milch", "icon": MILK, "times_added": 1, "on_list": True}
    ]


def test_same_name_in_other_spelling_is_the_same_item(client, admin, now):
    first = add(client, admin, "Milch")
    second = add(client, admin, "  milch ", icon=BREAD)

    assert second["id"] == first["id"]
    assert second["name"] == "Milch"
    # Das Symbol gilt für den Artikel; schon offen zählt nicht doppelt.
    assert second["icon"] == BREAD
    assert items(client)[0]["times_added"] == 1


def test_note_stays_unless_given(client, admin, now):
    add(client, admin, note="laktosefrei")
    assert add(client, admin)["note"] == "laktosefrei"
    assert add(client, admin, note="2 ×")["note"] == "2 ×"
    assert add(client, admin, note="  ")["note"] is None


def test_open_items_in_order_then_checked(client, admin, now):
    milk = add(client, admin, "Milch")
    bread = add(client, admin, "Brot", icon=BREAD)
    add(client, admin, "Eier")

    assert check(client, admin, milk["id"]).json()["checked"] is True
    assert check(client, admin, bread["id"]).status_code == 200

    assert names(client) == [("Eier", False), ("Milch", True), ("Brot", True)]


def test_uncheck_puts_item_back(client, admin, now):
    milk = add(client, admin)
    check(client, admin, milk["id"])

    response = check(client, admin, milk["id"], checked=False)

    assert response.status_code == 200
    assert names(client) == [("Milch", False)]


def test_checked_items_disappear_at_midnight_in_family_timezone(client, admin, now):
    # Samstag 1:30 Uhr in Berlin, in UTC noch Freitag.
    milk = add(client, admin)
    check(client, admin, milk["id"])

    now["value"] = dt.datetime(2026, 10, 3, 21, 59, tzinfo=dt.UTC)  # Samstag 23:59 in Berlin
    assert names(client) == [("Milch", True)]

    now["value"] = dt.datetime(2026, 10, 3, 22, 1, tzinfo=dt.UTC)  # Sonntag 0:01 in Berlin
    assert listed(client) == []
    assert items(client)[0]["on_list"] is False
    assert check(client, admin, milk["id"], checked=False).json()["code"] == (
        "shopping.not_on_list"
    )

    # Neu eingetragen ist er wieder offen, ohne alte Notiz.
    again = add(client, admin)
    assert again["checked"] is False
    assert again["note"] is None
    assert items(client)[0]["times_added"] == 2


def test_readding_a_checked_item_opens_it_again(client, admin, now):
    milk = add(client, admin, note="2 ×")
    check(client, admin, milk["id"])

    again = add(client, admin)

    assert again["checked"] is False
    assert again["note"] is None
    assert names(client) == [("Milch", False)]


def test_remove_from_list_keeps_suggestion(client, admin, now):
    milk = add(client, admin)

    response = client.delete(f"/api/shopping/list/{milk['id']}", headers=csrf(admin))

    assert response.status_code == 204
    assert listed(client) == []
    assert [item["name"] for item in items(client)] == ["Milch"]


def test_clear_checked(client, admin, now):
    milk = add(client, admin)
    add(client, admin, "Brot", icon=BREAD)
    check(client, admin, milk["id"])

    response = client.delete("/api/shopping/list/checked", headers=csrf(admin))

    assert response.status_code == 204
    assert names(client) == [("Brot", False)]


def test_items_sorted_by_how_often_they_were_added(client, admin, now):
    bread = add(client, admin, "Brot", icon=BREAD)
    milk = add(client, admin, "Milch")
    for _ in range(2):
        check(client, admin, milk["id"])
        add(client, admin, "Milch")
    check(client, admin, bread["id"])

    assert [(item["name"], item["times_added"], item["on_list"]) for item in items(client)] == [
        ("Milch", 3, True),
        ("Brot", 1, False),
    ]


def test_rename_and_change_icon(client, admin, now):
    milk = add(client, admin)

    response = client.put(
        f"/api/shopping/items/{milk['id']}",
        json={"name": "Hafermilch", "icon": BREAD},
        headers=csrf(admin),
    )

    assert response.status_code == 200, response.text
    assert listed(client)[0] | {"note": None} == {
        "id": milk["id"],
        "name": "Hafermilch",
        "icon": BREAD,
        "note": None,
        "checked": False,
        "area": None,
        "position": None,
    }


def test_rename_to_existing_name_is_rejected(client, admin, now):
    milk = add(client, admin)
    add(client, admin, "Brot", icon=BREAD)

    response = client.put(
        f"/api/shopping/items/{milk['id']}",
        json={"name": "brot", "icon": MILK},
        headers=csrf(admin),
    )

    assert response.status_code == 409
    assert response.json()["code"] == "shopping.duplicate_name"


def test_delete_item(client, admin, now):
    milk = add(client, admin)

    response = client.delete(f"/api/shopping/items/{milk['id']}", headers=csrf(admin))

    assert response.status_code == 204
    assert listed(client) == []
    assert items(client) == []
    missing = client.delete(f"/api/shopping/list/{milk['id']}", headers=csrf(admin))
    assert missing.json()["code"] == "shopping.not_found"


def test_invalid_input_is_rejected(client, admin):
    for body in (
        {"name": " ", "icon": MILK},
        {"name": "Milch", "icon": "kein icon"},
        {"name": "Milch", "icon": MILK, "note": "x" * 61},
    ):
        response = client.post("/api/shopping/list", json=body, headers=csrf(admin))
        assert response.status_code == 422, body


def move(client, me, item_id, area):
    return client.put(f"/api/shopping/items/{item_id}/area", json={"area": area}, headers=csrf(me))


def order(client, me, ids):
    return client.put("/api/shopping/order", json={"ids": ids}, headers=csrf(me))


def test_move_to_other_area_without_parent_pin(client, admin, now):
    soap = add(client, admin, name="Seife")

    assert move(client, admin, soap["id"], "drugstore").status_code == 204

    assert listed(client)[0]["area"] == "drugstore"
    # Der Bereich bleibt am Artikel, auch nach dem Abhaken und neuen Eintragen.
    client.delete(f"/api/shopping/list/{soap['id']}", headers=csrf(admin))
    assert add(client, admin, name="seife")["area"] == "drugstore"
    # Zurück zur automatischen Zuordnung.
    assert move(client, admin, soap["id"], None).status_code == 204
    assert listed(client)[0]["area"] is None


def test_order_within_area(client, admin, now):
    milk, bread, eggs = (add(client, admin, name=name) for name in ("Milch", "Brot", "Eier"))

    assert order(client, admin, [eggs["id"], 99999, milk["id"]]).status_code == 204

    positions = {item["name"]: item["position"] for item in listed(client)}
    # Unbekannte IDs werden übergangen, nicht genannte behalten ihren Platz (keinen).
    assert positions == {"Eier": 0, "Milch": 2, "Brot": None}
    # Die Reihenfolge bleibt beim Abhaken erhalten.
    check(client, admin, eggs["id"])
    check(client, admin, eggs["id"], checked=False)
    assert {item["name"]: item["position"] for item in listed(client)}["Eier"] == 0


def test_move_resets_position(client, admin, now):
    milk = add(client, admin)
    order(client, admin, [milk["id"]])

    move(client, admin, milk["id"], "chilled")
    assert listed(client)[0]["position"] is None
    # Derselbe Bereich noch einmal ändert nichts.
    order(client, admin, [milk["id"]])
    move(client, admin, milk["id"], "chilled")
    assert listed(client)[0]["position"] == 0


def test_move_and_order_reject_invalid_input(client, admin, now):
    milk = add(client, admin)

    assert move(client, admin, milk["id"], "kiosk").status_code == 422
    assert move(client, admin, 99999, "online").json()["code"] == "shopping.not_found"
    assert order(client, admin, list(range(501))).status_code == 422
    assert client.put("/api/shopping/order", json={"ids": [milk["id"]]}).status_code in (401, 403)
