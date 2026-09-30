from app.auth import get_family
from app.db import SessionLocal
from tests.conftest import csrf

DEFAULT = [
    {"id": "weather", "visible": True},
    {"id": "events", "visible": True},
    {"id": "tasks", "visible": True},
    {"id": "meals", "visible": True},
    {"id": "shopping", "visible": True},
]


def get_layout(client) -> list[dict]:
    response = client.get("/api/home/layout")
    assert response.status_code == 200, response.text
    return response.json()["tiles"]


def test_default_layout(client, admin):
    assert get_layout(client) == DEFAULT


def test_parents_change_order_and_visibility(client, parent):
    tiles = [
        {"id": "tasks", "visible": True},
        {"id": "weather", "visible": False},
        {"id": "events", "visible": True},
        {"id": "meals", "visible": False},
        {"id": "shopping", "visible": False},
    ]
    response = client.put("/api/home/layout", json={"tiles": tiles}, headers=csrf(parent))

    assert response.status_code == 200, response.text
    assert response.json()["tiles"] == tiles
    assert get_layout(client) == tiles


def test_missing_tiles_are_added_at_the_end(client, parent):
    tiles = [{"id": "events", "visible": False}, {"id": "tasks", "visible": True}]
    response = client.put("/api/home/layout", json={"tiles": tiles}, headers=csrf(parent))

    assert response.status_code == 200, response.text
    assert [tile["id"] for tile in get_layout(client)] == [
        "events",
        "tasks",
        "weather",
        "meals",
        "shopping",
    ]
    assert get_layout(client)[0] == {"id": "events", "visible": False}


def test_unknown_tiles_in_database_are_ignored(client, admin):
    with SessionLocal() as db:
        get_family(db).home_layout = [
            {"id": "horoscope", "visible": True},
            # Die frühere Kachel „Woche“ gibt es nicht mehr.
            {"id": "week", "visible": True},
            {"id": "meals", "visible": False},
            {"id": "meals", "visible": True},
        ]
        db.commit()

    tiles = get_layout(client)
    assert tiles[0] == {"id": "meals", "visible": False}
    assert len(tiles) == len(DEFAULT)


def test_invalid_layouts_are_rejected(client, parent):
    duplicate = [{"id": "tasks", "visible": True}, {"id": "tasks", "visible": False}]
    response = client.put("/api/home/layout", json={"tiles": duplicate}, headers=csrf(parent))
    assert response.status_code == 422
    assert response.json() == {"code": "home.invalid_layout"}

    unknown = [{"id": "horoscope", "visible": True}]
    response = client.put("/api/home/layout", json={"tiles": unknown}, headers=csrf(parent))
    assert response.status_code == 422
    assert response.json()["code"] == "common.validation"


def test_changes_need_unlocked_parent_area(client, admin):
    tiles = [{"id": "meals", "visible": False}]
    assert (
        client.put("/api/home/layout", json={"tiles": tiles}, headers=csrf(admin)).status_code
        == 403
    )
    assert get_layout(client) == DEFAULT


def test_layout_needs_login(client):
    assert client.get("/api/home/layout").status_code == 401


def test_week_is_rolling_by_default_and_can_start_on_monday(client, parent):
    assert client.get("/api/home/layout").json()["week"] == "rolling"

    body = {"tiles": DEFAULT, "week": "monday"}
    response = client.put("/api/home/layout", json=body, headers=csrf(parent))

    assert response.status_code == 200, response.text
    assert response.json()["week"] == "monday"
    assert client.get("/api/home/layout").json()["week"] == "monday"


def test_invalid_week_is_rejected(client, parent):
    body = {"tiles": DEFAULT, "week": "sunday"}
    response = client.put("/api/home/layout", json=body, headers=csrf(parent))
    assert response.status_code == 422
    assert response.json()["code"] == "common.validation"
