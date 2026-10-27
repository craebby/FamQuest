import httpx2 as httpx
import pytest

from app import mealie
from app.api import meals
from tests.conftest import csrf

URL = "https://mealie.example.org"
TOKEN = "geheimer-token"
DJUVEC = "8bbef6c5-abc0-43d9-8ad2-26eaa2913569"
TACOS = "81edce82-809c-4aa9-a3e1-57ee8435aa81"
GRAM = {"name": "Gramm", "abbreviation": "g"}


def recipe(recipe_id, name, slug, updated="1", rating=None, image="4aF2", **detail) -> dict:
    return {
        "id": recipe_id,
        "name": name,
        "slug": slug,
        "image": image,
        "rating": rating,
        "updatedAt": updated,
        "recipeServings": 4.0,
        "recipeIngredient": [
            {"quantity": 200.0, "unit": GRAM, "food": {"name": "Reis"}, "note": "Langkorn"},
            {"quantity": 0.5, "unit": None, "food": {"name": "Zwiebel"}, "note": ""},
            {"quantity": 0, "unit": None, "food": None, "note": "Salz nach Geschmack"},
        ],
        "recipeInstructions": [{"text": "Reis  kochen."}, {"text": ""}, {"text": "Servieren."}],
        **detail,
    }


class FakeMealie:
    def __init__(self) -> None:
        self.recipes = {
            DJUVEC: recipe(DJUVEC, "Djuvec Reis", "djuvec-reis", rating=4.0),
            TACOS: recipe(TACOS, "Beef Taco Bowl", "beef-taco-bowl", image=None),
        }
        self.down = False
        self.requests: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request.url.path)
        if self.down:
            raise httpx.ConnectError("down")
        if request.headers.get("authorization") != f"Bearer {TOKEN}":
            return httpx.Response(401, json={"detail": "Unauthorized"})
        path = request.url.path
        if path == "/api/users/self":
            return httpx.Response(200, json={"groupSlug": "home"})
        if path == "/api/recipes":
            items = [
                {key: value for key, value in item.items() if not key.startswith("recipe")}
                for item in self.recipes.values()
            ]
            return httpx.Response(200, json={"items": items, "total": len(items)})
        if path.startswith("/api/recipes/"):
            key = path.removeprefix("/api/recipes/")
            for item in self.recipes.values():
                if key in (item["id"], item["slug"]):
                    return httpx.Response(200, json=item)
            return httpx.Response(404, json={"detail": "not found"})
        if path.startswith("/api/media/recipes/"):
            return httpx.Response(200, content=b"RIFFwebp", headers={"content-type": "image/webp"})
        return httpx.Response(200, text="<html>", headers={"content-type": "text/html"})


@pytest.fixture
def fake_mealie(configured, monkeypatch) -> FakeMealie:
    fake = FakeMealie()
    monkeypatch.setattr(mealie, "transport", httpx.MockTransport(fake.handler))
    return fake


def connect(client, me, mode="mixed", url=URL, token=TOKEN):
    body = {"mode": mode, "url": url}
    if token is not None:
        body["token"] = token
    return client.put("/api/mealie", json=body, headers=csrf(me))


def dishes(client) -> dict[str, dict]:
    response = client.get("/api/dishes")
    assert response.status_code == 200, response.text
    return {dish["name"]: dish for dish in response.json()}


def plan(client, me, name, date="2026-10-03", icon="fluent-emoji-flat:pot-of-food"):
    response = client.put(
        f"/api/meals/{date}/dinner", json={"name": name, "icon": icon}, headers=csrf(me)
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_off_by_default(client, admin):
    response = client.get("/api/mealie")

    assert response.status_code == 200
    assert response.json() | {"can_store_token": False} == {
        "mode": "off",
        "url": None,
        "has_token": False,
        "can_store_token": False,
        "synced_at": None,
        "sync_error": None,
        "recipes": 0,
    }


def test_connect_needs_parent_area(client, admin, fake_mealie):
    assert connect(client, admin).status_code == 403


def test_connect_imports_recipes_as_dishes(client, parent, fake_mealie):
    response = connect(client, parent)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["mode"] == "mixed"
    assert body["has_token"] is True
    assert body["recipes"] == 2
    assert body["sync_error"] is None
    assert TOKEN not in str(body)
    djuvec = dishes(client)["Djuvec Reis"]
    assert djuvec["ingredients"] == ["200 g Reis (Langkorn)", "½ Zwiebel", "Salz nach Geschmack"]
    assert djuvec["steps"] == ["Reis kochen.", "Servieren."]
    assert djuvec["servings"] == 4
    assert djuvec["image_url"] == f"/api/mealie/images/{DJUVEC}?v=4aF2"
    assert djuvec["mealie"] == {
        "id": DJUVEC,
        "name": "Djuvec Reis",
        "url": f"{URL}/g/home/r/djuvec-reis",
        "auto": True,
        "own_recipe": False,
    }
    assert dishes(client)["Beef Taco Bowl"]["image_url"] is None


def test_token_is_stored_encrypted(client, parent, fake_mealie):
    from app.db import SessionLocal
    from app.models import Family

    connect(client, parent)

    with SessionLocal() as db:
        stored = db.query(Family).one().mealie_settings
    assert TOKEN not in str(stored)
    assert stored["url"] == URL


def test_wrong_token_or_address(client, parent, fake_mealie):
    response = connect(client, parent, token="falsch")
    assert response.status_code == 502
    assert response.json()["code"] == "mealie.unauthorized"
    assert client.get("/api/mealie").json()["mode"] == "off"

    fake_mealie.down = True
    assert connect(client, parent).json()["code"] == "mealie.unreachable"

    response = connect(client, parent, url="mealie.example.org")
    assert response.status_code == 422
    assert response.json()["fields"] == {"url": "validation.invalid_url"}


def test_recipes_need_token_and_link_needs_address(client, parent, fake_mealie):
    response = connect(client, parent, token=None)
    assert response.json()["code"] == "mealie.token_missing"

    response = client.put("/api/mealie", json={"mode": "link"}, headers=csrf(parent))
    assert response.json()["code"] == "mealie.url_missing"

    response = connect(client, parent, mode="link", token=None)
    assert response.status_code == 200
    assert response.json() | {"mode": "link", "url": URL, "has_token": False} == response.json()
    assert fake_mealie.requests == []


def test_token_needs_encryption_key(client, parent):
    response = connect(client, parent)
    assert response.status_code == 409
    assert response.json()["code"] == "mealie.no_encryption_key"


def test_sync_only_fetches_changed_recipes(client, parent, fake_mealie):
    connect(client, parent)
    fake_mealie.requests.clear()
    fake_mealie.recipes[TACOS] |= {"name": "Taco Bowl", "updatedAt": "2"}

    response = client.post("/api/mealie/sync", headers=csrf(parent))

    assert response.status_code == 200, response.text
    assert fake_mealie.requests == ["/api/recipes", "/api/recipes/beef-taco-bowl"]
    assert "Taco Bowl" in dishes(client)


def test_renamed_dish_keeps_its_name(client, parent, fake_mealie):
    connect(client, parent)
    djuvec = dishes(client)["Djuvec Reis"]
    client.put(
        f"/api/dishes/{djuvec['id']}",
        json={"name": "Djuvec", "icon": "fluent-emoji-flat:cooked-rice"},
        headers=csrf(parent),
    )
    fake_mealie.recipes[DJUVEC] |= {"name": "Djuvec Reis original", "updatedAt": "2"}

    client.post("/api/mealie/sync", headers=csrf(parent))

    assert dishes(client)["Djuvec"]["mealie"]["name"] == "Djuvec Reis original"


def test_mealie_down_keeps_last_state(client, parent, fake_mealie):
    connect(client, parent)
    fake_mealie.down = True

    response = client.post("/api/mealie/sync", headers=csrf(parent))

    assert response.json()["sync_error"] == "mealie.unreachable"
    assert dishes(client)["Djuvec Reis"]["steps"] == ["Reis kochen.", "Servieren."]


def test_deleted_in_mealie(client, parent, fake_mealie, now):
    connect(client, parent)
    plan(client, parent, "Djuvec Reis")
    del fake_mealie.recipes[DJUVEC]
    del fake_mealie.recipes[TACOS]

    client.post("/api/mealie/sync", headers=csrf(parent))

    # Nie geplant: weg. Geplant: bleibt, mit dem letzten Stand als eigenem Rezept.
    left = dishes(client)
    assert "Beef Taco Bowl" not in left
    assert left["Djuvec Reis"]["mealie"] is None
    assert left["Djuvec Reis"]["steps"] == ["Reis kochen.", "Servieren."]


def test_typed_dish_gets_linked(client, parent, fake_mealie, now):
    plan(client, parent, "djuvec reis")

    connect(client, parent)

    assert dishes(client)["djuvec reis"]["mealie"]["auto"] is True


def test_own_recipe_with_same_name_stays(client, parent, fake_mealie):
    client.post(
        "/api/recipes",
        json={
            "recipes": [
                {
                    "name": "Djuvec Reis",
                    "icon": "fluent-emoji-flat:cooked-rice",
                    "ingredients": ["Reis"],
                    "steps": ["Kochen"],
                }
            ]
        },
        headers=csrf(parent),
    )

    connect(client, parent)

    found = dishes(client)
    assert found["Djuvec Reis"]["mealie"] is None
    assert found["Djuvec Reis"]["steps"] == ["Kochen"]
    assert found["Djuvec Reis (Mealie)"]["mealie"]["auto"] is True


def test_link_own_dish_without_parent_pin(client, parent, fake_mealie, now):
    connect(client, parent)
    dish = plan(client, parent, "Hackbällchen mit Djuvec-Reis")

    response = client.put(
        f"/api/dishes/{dish['dish_id']}/mealie", json={"recipe_id": DJUVEC}, headers=csrf(parent)
    )

    assert response.status_code == 200, response.text
    assert response.json()["mealie"]["auto"] is False
    assert response.json()["steps"] == ["Reis kochen.", "Servieren."]
    week = client.get("/api/meals/week").json()["entries"]
    assert week[0]["image_url"] == f"/api/mealie/images/{DJUVEC}?v=4aF2"

    response = client.put(
        f"/api/dishes/{dish['dish_id']}/mealie", json={"recipe_id": None}, headers=csrf(parent)
    )
    assert response.json()["mealie"] is None
    assert response.json()["steps"] == []


def test_mealie_dishes_cannot_be_unlinked_or_deleted(client, parent, fake_mealie):
    connect(client, parent)
    djuvec = dishes(client)["Djuvec Reis"]

    unlink = client.put(
        f"/api/dishes/{djuvec['id']}/mealie", json={"recipe_id": None}, headers=csrf(parent)
    )
    delete = client.delete(f"/api/dishes/{djuvec['id']}", headers=csrf(parent))

    assert unlink.json()["code"] == "dish.from_mealie"
    assert delete.json()["code"] == "dish.from_mealie"


def test_switching_off_hides_mealie(client, parent, fake_mealie, now):
    connect(client, parent)
    dish = plan(client, parent, "Hackbällchen")
    client.put(
        f"/api/dishes/{dish['dish_id']}/mealie", json={"recipe_id": DJUVEC}, headers=csrf(parent)
    )
    plan(client, parent, "Beef Taco Bowl", date="2026-10-04")

    response = connect(client, parent, mode="off", token=None)

    assert response.status_code == 200
    left = dishes(client)
    # Geplantes bleibt sichtbar, nur ohne Mealie-Rezept; Ungeplantes aus Mealie verschwindet.
    assert set(left) == {"Hackbällchen", "Beef Taco Bowl"}
    assert left["Hackbällchen"]["mealie"] is None
    assert left["Hackbällchen"]["steps"] == []
    assert client.get("/api/mealie/recipes").json() == []

    assert connect(client, parent, token=None).status_code == 200
    assert dishes(client)["Hackbällchen"]["mealie"]["id"] == DJUVEC


def test_fill_week_by_mode(client, parent, fake_mealie, now, monkeypatch):
    monkeypatch.setattr(meals, "fill_random", __import__("random").Random(1))
    client.post(
        "/api/recipes",
        json={
            "recipes": [
                {"name": "Pfannkuchen", "icon": "fluent-emoji-flat:pancakes", "steps": ["Backen"]}
            ]
        },
        headers=csrf(parent),
    )
    fill = {"start": "2026-10-03", "end": "2026-10-05"}

    connect(client, parent, mode="only")
    only = client.post("/api/meals/fill", json=fill, headers=csrf(parent)).json()
    assert {entry["name"] for entry in only} <= {"Djuvec Reis", "Beef Taco Bowl"}

    connect(client, parent, mode="mixed", token=None)
    fill = {"start": "2026-10-20", "end": "2026-10-22"}
    mixed = client.post("/api/meals/fill", json=fill, headers=csrf(parent)).json()
    assert {entry["name"] for entry in mixed} == {"Djuvec Reis", "Beef Taco Bowl", "Pfannkuchen"}


def test_recipe_list_refresh_and_image(client, parent, fake_mealie):
    connect(client, parent)

    listed = client.get("/api/mealie/recipes").json()
    assert [(item["name"], item["rating"]) for item in listed] == [
        ("Beef Taco Bowl", None),
        ("Djuvec Reis", 4),
    ]

    fake_mealie.recipes[DJUVEC]["recipeInstructions"] = [{"text": "Neu"}]
    refresh = client.post(f"/api/mealie/recipes/{DJUVEC}/refresh", headers=csrf(parent))
    assert refresh.status_code == 204
    assert dishes(client)["Djuvec Reis"]["steps"] == ["Neu"]

    image = client.get(f"/api/mealie/images/{DJUVEC}")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/webp"
    assert client.get("/api/mealie/images/unbekannt").status_code == 404


@pytest.mark.parametrize(
    ("ingredient", "line"),
    [
        (
            {"quantity": 1.5, "unit": {"name": "Liter"}, "food": {"name": "Milch"}},
            "1,5 Liter Milch",
        ),
        ({"quantity": 0.25, "unit": None, "food": {"name": "Kohl"}}, "¼ Kohl"),
        ({"quantity": None, "food": None, "note": "", "display": "Prise  Salz"}, "Prise Salz"),
    ],
)
def test_ingredient_line(ingredient, line):
    assert mealie.ingredient_line(ingredient) == line
