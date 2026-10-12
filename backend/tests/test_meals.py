from io import BytesIO

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
        "image_url": None,
        "note": None,
        "variant": None,
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


def dishes(client) -> list[dict]:
    response = client.get("/api/dishes")
    assert response.status_code == 200, response.text
    return response.json()


def upload_image(client, me, dish_id, data=None):
    from tests.test_members import image_bytes

    return client.put(
        f"/api/dishes/{dish_id}/image",
        content=image_bytes() if data is None else data,
        headers={**csrf(me), "Content-Type": "image/png"},
    )


def test_rename_and_change_icon_without_pin(client, admin, now):
    dish = plan(client, admin, MONDAY, name="Nudln")["dish_id"]

    response = client.put(
        f"/api/dishes/{dish}", json={"name": " Nudeln ", "icon": BURGER}, headers=csrf(admin)
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": dish,
        "name": "Nudeln",
        "icon": BURGER,
        "image_url": None,
        "last_planned": MONDAY,
        "times_planned": 1,
        "ingredients": [],
        "steps": [],
        "servings": None,
        "rating": None,
    }
    assert [(e["name"], e["icon"]) for e in week(client)["entries"]] == [("Nudeln", BURGER)]


def test_rename_to_an_existing_name_is_rejected(client, admin, now):
    plan(client, admin, MONDAY, name="Pizza")
    soup = plan(client, admin, "2026-09-29", name="Suppe")["dish_id"]

    response = client.put(
        f"/api/dishes/{soup}", json={"name": "PIZZA", "icon": SPAGHETTI}, headers=csrf(admin)
    )
    assert response.status_code == 409
    assert response.json()["code"] == "dish.duplicate_name"

    # Nur die Schreibweise ändern ist erlaubt.
    response = client.put(
        f"/api/dishes/{soup}", json={"name": "SUPPE", "icon": SPAGHETTI}, headers=csrf(admin)
    )
    assert response.status_code == 200, response.text


def test_unknown_dish(client, admin):
    response = client.put(
        "/api/dishes/99", json={"name": "X", "icon": SPAGHETTI}, headers=csrf(admin)
    )
    assert response.status_code == 404
    assert response.json()["code"] == "dish.not_found"


def test_delete_dish_with_its_past_entries(client, admin, now):
    dish = plan(client, admin, MONDAY, name="Suppe")["dish_id"]

    assert client.delete(f"/api/dishes/{dish}", headers=csrf(admin)).status_code == 204
    assert dishes(client) == []
    assert week(client)["entries"] == []


def test_dish_planned_today_or_later_cannot_be_deleted(client, admin, now):
    dish = plan(client, admin, SATURDAY, name="Suppe")["dish_id"]

    response = client.delete(f"/api/dishes/{dish}", headers=csrf(admin))

    assert response.status_code == 409
    assert response.json()["code"] == "dish.planned"
    assert [d["name"] for d in dishes(client)] == ["Suppe"]


def test_upload_show_and_remove_image(client, admin, now):
    from PIL import Image

    dish = plan(client, admin, SATURDAY, name="Omas Lasagne")["dish_id"]

    response = upload_image(client, admin, dish)
    assert response.status_code == 200, response.text
    url = response.json()["image_url"]
    assert url.startswith("/api/dish-images/")
    assert week(client)["entries"][0]["image_url"] == url

    image = client.get(url)
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/webp"
    with Image.open(BytesIO(image.content)) as stored:
        assert stored.size == (512, 512)

    # Ein neues Foto ersetzt das alte, dessen Datei verschwindet.
    new_url = upload_image(client, admin, dish).json()["image_url"]
    assert new_url != url
    assert client.get(url).status_code == 404

    response = client.delete(f"/api/dishes/{dish}/image", headers=csrf(admin))
    assert response.status_code == 200
    assert response.json()["image_url"] is None
    assert client.get(new_url).status_code == 404


def test_invalid_image_is_rejected(client, admin, now):
    dish = plan(client, admin, SATURDAY, name="Suppe")["dish_id"]

    response = upload_image(client, admin, dish, data=b"kein Bild")

    assert response.status_code == 422
    assert response.json()["code"] == "dish.invalid_image"


def test_deleting_a_dish_removes_its_image(client, admin, now):
    dish = plan(client, admin, MONDAY, name="Suppe")["dish_id"]
    url = upload_image(client, admin, dish).json()["image_url"]

    client.delete(f"/api/dishes/{dish}", headers=csrf(admin))

    assert client.get(url).status_code == 404


def test_dish_images_need_login(client, admin, now):
    dish = plan(client, admin, MONDAY, name="Suppe")["dish_id"]
    url = upload_image(client, admin, dish).json()["image_url"]
    client.post("/api/auth/logout", headers=csrf(admin))

    assert client.get(url).status_code == 401


RUEHREI = {
    "name": "Rührei-Pfanne mit Pellkartoffeln",
    "icon": "fluent-emoji-flat:cooking",
    "ingredients": ["ca. 600 g Pellkartoffeln", "8 Eier"],
    "steps": ["Pellkartoffeln anbraten.", "Eier drübergießen und stocken lassen."],
    "servings": 4,
}


def import_recipes(client, me, *recipes):
    return client.post("/api/recipes", json={"recipes": list(recipes)}, headers=csrf(me))


def test_import_creates_dishes_with_recipes(client, admin, now):
    wraps = {"name": "Hähnchen-Wraps", "icon": BURGER, "steps": ["Tortillas erwärmen."]}

    response = import_recipes(client, admin, RUEHREI, wraps)

    assert response.status_code == 200, response.text
    created = response.json()
    assert [(d["name"], d["ingredients"], d["steps"], d["servings"]) for d in created] == [
        (RUEHREI["name"], RUEHREI["ingredients"], RUEHREI["steps"], 4),
        ("Hähnchen-Wraps", [], ["Tortillas erwärmen."], None),
    ]
    assert {d["name"] for d in client.get("/api/dishes").json()} == {
        RUEHREI["name"],
        "Hähnchen-Wraps",
    }


def test_import_adds_the_recipe_to_an_existing_dish(client, admin, now):
    dish = plan(client, admin, MONDAY, name="rührei-pfanne mit pellkartoffeln")["dish_id"]
    client.put(f"/api/dishes/{dish}/rating", json={"rating": 4}, headers=csrf(admin))

    [updated] = import_recipes(client, admin, RUEHREI).json()

    # Name, Symbol und Bewertung bleiben, das Rezept kommt dazu.
    assert updated["id"] == dish
    assert updated["name"] == "rührei-pfanne mit pellkartoffeln"
    assert updated["icon"] == SPAGHETTI
    assert updated["rating"] == 4
    assert updated["steps"] == RUEHREI["steps"]
    assert updated["times_planned"] == 1


@pytest.mark.parametrize(
    "recipe",
    [
        {**RUEHREI, "steps": ["  "]},
        {**RUEHREI, "steps": ["x" * 1001]},
        {**RUEHREI, "ingredients": ["Ei"] * 61},
        {**RUEHREI, "name": " "},
        {**RUEHREI, "servings": 0},
        {**RUEHREI, "servings": 51},
    ],
)
def test_import_rejects_invalid_recipes(client, admin, recipe):
    assert import_recipes(client, admin, recipe).status_code == 422
    assert client.get("/api/dishes").json() == []


def test_import_needs_a_recipe_and_csrf(client, admin):
    assert client.post("/api/recipes", json={"recipes": []}, headers=csrf(admin)).status_code == 422
    assert client.post("/api/recipes", json={"recipes": [RUEHREI]}).status_code == 403


def test_edit_and_remove_a_recipe(client, admin, now):
    [dish] = import_recipes(client, admin, RUEHREI).json()

    response = client.put(
        f"/api/dishes/{dish['id']}/recipe",
        json={"ingredients": [" 6 Eier "], "steps": ["Braten.", "Essen."], "servings": 2},
        headers=csrf(admin),
    )

    assert response.status_code == 200, response.text
    edited = response.json()
    assert (edited["ingredients"], edited["steps"], edited["servings"]) == (
        ["6 Eier"],
        ["Braten.", "Essen."],
        2,
    )
    cleared = client.put(
        f"/api/dishes/{dish['id']}/recipe",
        json={"ingredients": [], "steps": [], "servings": 2},
        headers=csrf(admin),
    ).json()
    # Das Gericht bleibt, nur ohne Rezept (und damit ohne Portionen).
    assert (cleared["name"], cleared["ingredients"], cleared["steps"], cleared["servings"]) == (
        RUEHREI["name"],
        [],
        [],
        None,
    )
    missing = client.put("/api/dishes/999/recipe", json={"steps": []}, headers=csrf(admin))
    assert missing.json()["code"] == "dish.not_found"


def test_delete_a_recipe_keeps_only_planned_dishes(client, admin, now):
    planned = plan(client, admin, MONDAY, name=RUEHREI["name"])["dish_id"]
    [_, wraps] = import_recipes(
        client, admin, RUEHREI, {"name": "Wraps", "icon": BURGER, "steps": ["Rollen."]}
    ).json()

    for dish in (planned, wraps["id"]):
        response = client.delete(f"/api/dishes/{dish}/recipe", headers=csrf(admin))
        assert response.status_code == 204, response.text

    # Das geplante Gericht bleibt ohne Rezept, das nur eingefügte ist ganz weg.
    [kept] = client.get("/api/dishes").json()
    assert (kept["id"], kept["ingredients"], kept["steps"], kept["servings"]) == (
        planned,
        [],
        [],
        None,
    )
    assert client.delete("/api/dishes/999/recipe", headers=csrf(admin)).status_code == 404
    assert client.delete(f"/api/dishes/{planned}/recipe").status_code == 403


def set_variant(client, me, date=SATURDAY, meal="dinner", **body):
    return client.put(f"/api/meals/{date}/{meal}/variant", json=body, headers=csrf(me))


def test_variant_for_one_day_keeps_the_recipe(client, admin, now):
    [dish] = import_recipes(client, admin, RUEHREI).json()
    plan(client, admin, SATURDAY, name=RUEHREI["name"])
    plan(client, admin, "2026-10-04", name=RUEHREI["name"])

    response = set_variant(
        client,
        admin,
        note="  mit Speck  ",
        ingredients=["ca. 600 g Pellkartoffeln", "8 Eier", "100 g Speck"],
        steps=RUEHREI["steps"],
        servings=4,
    )

    assert response.status_code == 200, response.text
    saturday, sunday = week(client)["entries"]
    assert saturday == response.json()
    assert saturday["note"] == "mit Speck"
    assert saturday["variant"] == {
        "ingredients": ["ca. 600 g Pellkartoffeln", "8 Eier", "100 g Speck"],
        "steps": RUEHREI["steps"],
        "servings": 4,
    }
    # Der andere Tag und das Rezept selbst bleiben unverändert.
    assert (sunday["note"], sunday["variant"]) == (None, None)
    [unchanged] = [d for d in client.get("/api/dishes").json() if d["id"] == dish["id"]]
    assert unchanged["ingredients"] == RUEHREI["ingredients"]


def test_variant_like_the_recipe_is_only_a_note(client, admin, now):
    import_recipes(client, admin, RUEHREI)
    plan(client, admin, SATURDAY, name=RUEHREI["name"])

    same = set_variant(
        client,
        admin,
        note="doppelt",
        ingredients=RUEHREI["ingredients"],
        steps=RUEHREI["steps"],
        servings=4,
    ).json()
    empty = set_variant(client, admin, note="").json()

    assert (same["note"], same["variant"]) == ("doppelt", None)
    assert (empty["note"], empty["variant"]) == (None, None)


def test_remove_variant(client, admin, now):
    import_recipes(client, admin, RUEHREI)
    plan(client, admin, SATURDAY, name=RUEHREI["name"])
    set_variant(client, admin, note="mit Speck", steps=["Anders."])

    response = client.delete(f"/api/meals/{SATURDAY}/dinner/variant", headers=csrf(admin))

    assert response.status_code == 200, response.text
    assert (response.json()["note"], response.json()["variant"]) == (None, None)


def test_variant_goes_with_another_dish(client, admin, now, seeded):
    import_recipes(client, admin, RUEHREI, recipe("Pfannkuchen"))
    plan(client, admin, SATURDAY, name=RUEHREI["name"])
    set_variant(client, admin, note="mit Speck", steps=["Anders."])

    # Dasselbe Gericht noch einmal eingetragen: Die Variante bleibt.
    kept = plan(client, admin, SATURDAY, name=RUEHREI["name"].upper(), icon=BURGER)
    other = plan(client, admin, SATURDAY, name="Pizza")
    set_variant(client, admin, note="mit Pilzen")
    [rerolled] = fill(client, admin, end=SATURDAY, replace=True).json()

    assert kept["note"] == "mit Speck" and kept["variant"] is not None
    assert (other["note"], other["variant"]) == (None, None)
    assert (rerolled["note"], rerolled["variant"]) == (None, None)


@pytest.mark.parametrize(
    "body",
    [{"note": "x" * 101}, {"steps": ["Braten."], "servings": 0}, {"steps": ["x" * 1001]}],
)
def test_invalid_variants_are_rejected(client, admin, now, body):
    plan(client, admin, SATURDAY)
    assert set_variant(client, admin, **body).status_code == 422


def test_variant_needs_a_planned_meal(client, admin, now):
    response = set_variant(client, admin, note="mit Speck")
    removed = client.delete(f"/api/meals/{SATURDAY}/dinner/variant", headers=csrf(admin))

    assert response.status_code == removed.status_code == 404
    assert response.json()["code"] == "meals.not_planned"


def test_rate_a_dish_without_parent_pin(client, admin, now):
    dish = plan(client, admin, MONDAY)["dish_id"]

    rated = client.put(f"/api/dishes/{dish}/rating", json={"rating": 5}, headers=csrf(admin))

    assert rated.status_code == 200, rated.text
    assert rated.json()["rating"] == 5
    for invalid in (0, 6):
        response = client.put(
            f"/api/dishes/{dish}/rating", json={"rating": invalid}, headers=csrf(admin)
        )
        assert response.status_code == 422
    cleared = client.put(f"/api/dishes/{dish}/rating", json={"rating": None}, headers=csrf(admin))
    assert cleared.json()["rating"] is None


def recipe(name: str, **extra) -> dict:
    return {"name": name, "icon": SPAGHETTI, "steps": [f"{name} kochen."]} | extra


def fill(client, me, start=SATURDAY, end="2026-10-04", **body):
    return client.post(
        "/api/meals/fill", json={"start": start, "end": end} | body, headers=csrf(me)
    )


@pytest.fixture
def seeded(monkeypatch):
    import random

    from app.api import meals

    monkeypatch.setattr(meals, "fill_random", random.Random(7))


def test_fill_needs_recipes(client, admin, now):
    plan(client, admin, SATURDAY)  # ein Gericht ohne Rezept zählt nicht

    response = fill(client, admin)

    assert response.status_code == 409
    assert response.json()["code"] == "meals.no_recipes"


def test_fill_only_empty_days_from_today(client, admin, now, seeded):
    import_recipes(client, admin, *(recipe(f"Gericht {i}") for i in range(10)))
    planned = plan(client, admin, "2026-10-04", name="Pizza", icon=BURGER)

    # Montag bis Sonntag dieser Woche; heute ist Samstag.
    response = fill(client, admin, start=MONDAY, end="2026-10-04")

    assert response.status_code == 200, response.text
    assert [entry["date"] for entry in response.json()] == [SATURDAY]
    assert response.json()[0]["name"].startswith("Gericht ")
    entries = week(client)["entries"]
    assert [entry["date"] for entry in entries] == [SATURDAY, "2026-10-04"]
    # Geplantes bleibt.
    assert entries[1] == planned


def test_fill_does_not_repeat_a_dish_within_a_week(client, admin, now, seeded):
    import_recipes(client, admin, *(recipe(f"Gericht {i}") for i in range(8)))

    entries = fill(client, admin, start=SATURDAY, end="2026-10-16").json()

    assert len(entries) == 14
    names = [entry["name"] for entry in entries]
    for index in range(len(names)):
        assert names[index] not in names[max(0, index - 6) : index]


def test_fill_prefers_well_rated_dishes(client, admin, now, seeded):
    loved, disliked = import_recipes(
        client, admin, recipe("Pfannkuchen"), recipe("Rosenkohl")
    ).json()
    client.put(f"/api/dishes/{loved['id']}/rating", json={"rating": 5}, headers=csrf(admin))
    client.put(f"/api/dishes/{disliked['id']}/rating", json={"rating": 1}, headers=csrf(admin))

    counts = {"Pfannkuchen": 0, "Rosenkohl": 0}
    # Mit nur zwei Gerichten reicht die Sammlung nicht für den Abstand; dann zählt die Bewertung.
    for _ in range(20):
        for entry in fill(client, admin, end=SATURDAY, replace=True).json():
            counts[entry["name"]] += 1
        client.delete(f"/api/meals/{SATURDAY}/dinner", headers=csrf(admin))

    assert counts["Pfannkuchen"] > 3 * counts["Rosenkohl"]


def test_reroll_a_single_day_picks_another_dish(client, admin, now, seeded):
    import_recipes(client, admin, recipe("Pfannkuchen"), recipe("Wraps"))
    [first] = fill(client, admin, end=SATURDAY).json()

    [again] = fill(client, admin, end=SATURDAY, replace=True).json()

    assert again["date"] == SATURDAY
    assert again["name"] != first["name"]
    assert [entry["name"] for entry in week(client)["entries"]] == [again["name"]]


@pytest.mark.parametrize(
    "body",
    [
        {"start": "2026-10-05", "end": SATURDAY},
        {"start": SATURDAY, "end": "2026-10-17"},
        {"start": SATURDAY, "end": SATURDAY, "meal": "brunch"},
    ],
)
def test_fill_rejects_invalid_ranges(client, admin, now, body):
    import_recipes(client, admin, recipe("Pfannkuchen"))
    response = client.post("/api/meals/fill", json=body, headers=csrf(admin))
    assert response.status_code == 422
