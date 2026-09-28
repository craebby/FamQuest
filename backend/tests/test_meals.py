import pytest

from app.auth import get_family
from app.db import SessionLocal
from tests.conftest import csrf

MONDAY = "2026-09-28"
SATURDAY = "2026-10-03"
SPAGHETTI = "fluent-emoji-flat:spaghetti"
BURGER = "fluent-emoji-flat:hamburger"


def put_meal(client, me, date, meal="dinner", name="Nudeln mit Tomatensoße", icon=SPAGHETTI):
    return client.put(
        f"/api/meals/{date}/{meal}", json={"name": name, "icon": icon}, headers=csrf(me)
    )


def plan(client, me, date, meal="dinner", **body) -> dict:
    response = put_meal(client, me, date, meal, **body)
    assert response.status_code == 200, response.text
    return response.json()


def week(client, offset=0) -> dict:
    response = client.get(f"/api/meals/week?offset={offset}")
    assert response.status_code == 200, response.text
    return response.json()


def set_meals(client, me, meals):
    return client.put("/api/meals/settings", json={"meals": meals}, headers=csrf(me))


def test_only_dinner_by_default(client, admin):
    assert client.get("/api/meals/settings").json() == {"meals": ["dinner"]}


def test_parents_choose_meals_in_order_of_the_day(client, parent):
    response = set_meals(client, parent, ["snack", "dinner", "breakfast"])

    assert response.status_code == 200, response.text
    assert response.json() == {"meals": ["breakfast", "dinner", "snack"]}
    assert client.get("/api/meals/settings").json() == {"meals": ["breakfast", "dinner", "snack"]}


@pytest.mark.parametrize("meals", [[], ["dinner", "brunch"]])
def test_invalid_meal_settings_are_rejected(client, parent, meals):
    assert set_meals(client, parent, meals).status_code == 422
    assert client.get("/api/meals/settings").json() == {"meals": ["dinner"]}


def test_meal_settings_need_the_parent_pin(client, admin):
    response = set_meals(client, admin, ["lunch"])
    assert response.status_code == 403
    assert response.json()["code"] == "parent.locked"


def test_invalid_stored_settings_fall_back_to_default(client, admin):
    with SessionLocal() as db:
        get_family(db).meal_settings = {"meals": ["brunch"]}
        db.commit()

    assert client.get("/api/meals/settings").json() == {"meals": ["dinner"]}


def test_plan_the_week_without_parent_pin(client, admin, now):
    entry = plan(client, admin, SATURDAY)

    assert entry == {
        "date": SATURDAY,
        "meal": "dinner",
        "dish_id": entry["dish_id"],
        "name": "Nudeln mit Tomatensoße",
        "icon": SPAGHETTI,
    }
    assert week(client) == {
        "start": MONDAY,
        "today": SATURDAY,
        "meals": ["dinner"],
        "entries": [entry],
    }


def test_replacing_and_clearing_a_meal(client, admin, now):
    plan(client, admin, SATURDAY)
    burger = plan(client, admin, SATURDAY, name="Burger", icon=BURGER)

    assert week(client)["entries"] == [burger]

    response = client.delete(f"/api/meals/{SATURDAY}/dinner", headers=csrf(admin))
    assert response.status_code == 204
    assert week(client)["entries"] == []
    # Leeren ist idempotent; das Gericht bleibt als Vorschlag.
    assert client.delete(f"/api/meals/{SATURDAY}/dinner", headers=csrf(admin)).status_code == 204
    assert [dish["name"] for dish in client.get("/api/dishes").json()] == [
        "Burger",
        "Nudeln mit Tomatensoße",
    ]


def test_same_name_is_the_same_dish(client, admin, now):
    first = plan(client, admin, MONDAY, name="Pizza")
    second = plan(client, admin, "2026-09-29", name="  pizza ", icon=BURGER)

    assert second["dish_id"] == first["dish_id"]
    # Der Name bleibt wie zuerst geschrieben, das neue Symbol gilt für das Gericht überall.
    assert second["name"] == "Pizza"
    assert [(e["name"], e["icon"]) for e in week(client)["entries"]] == [("Pizza", BURGER)] * 2


def test_whitespace_in_names_is_collapsed(client, admin, now):
    assert plan(client, admin, MONDAY, name="  Nudeln   mit  Soße ")["name"] == "Nudeln mit Soße"


@pytest.mark.parametrize(
    ("meal", "body"),
    [
        ("dinner", {"name": "   ", "icon": SPAGHETTI}),
        ("dinner", {"name": "x" * 101, "icon": SPAGHETTI}),
        ("dinner", {"name": "Pizza", "icon": "<svg>"}),
        ("brunch", {"name": "Pizza", "icon": SPAGHETTI}),
    ],
)
def test_invalid_entries_are_rejected(client, admin, meal, body):
    response = client.put(f"/api/meals/{MONDAY}/{meal}", json=body, headers=csrf(admin))
    assert response.status_code == 422


def test_week_shows_only_planned_meals_of_that_week(client, parent, now):
    set_meals(client, parent, ["lunch", "dinner"])
    plan(client, parent, MONDAY, "dinner", name="Suppe")
    plan(client, parent, MONDAY, "lunch", name="Brot")
    plan(client, parent, MONDAY, "snack", name="Apfel")
    plan(client, parent, "2026-10-05", "dinner", name="Curry")

    this_week = week(client)
    assert this_week["meals"] == ["lunch", "dinner"]
    assert [(e["meal"], e["name"]) for e in this_week["entries"]] == [
        ("dinner", "Suppe"),
        ("lunch", "Brot"),
    ]

    next_week = week(client, 1)
    assert next_week["start"] == "2026-10-05"
    assert [e["name"] for e in next_week["entries"]] == ["Curry"]


def test_dishes_recently_planned_first(client, admin, now):
    plan(client, admin, MONDAY, name="Suppe")
    plan(client, admin, "2026-09-30", name="Pizza")
    plan(client, admin, "2026-10-01", name="Suppe")
    plan(client, admin, "2026-10-02", name="Burger")
    client.delete("/api/meals/2026-10-02/dinner", headers=csrf(admin))

    dishes = client.get("/api/dishes").json()

    assert [(d["name"], d["last_planned"], d["times_planned"]) for d in dishes] == [
        ("Suppe", "2026-10-01", 2),
        ("Pizza", "2026-09-30", 1),
        ("Burger", None, 0),
    ]


def test_meals_need_login(client, admin):
    client.post("/api/auth/logout", headers=csrf(admin))

    assert client.get("/api/meals/week").status_code == 401
    assert client.get("/api/dishes").status_code == 401
