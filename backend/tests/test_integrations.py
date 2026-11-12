import json

import httpx2 as httpx
import pytest

from app.receipt import receipt_text
from app.shopping_areas import auto_area, default_icon
from tests.conftest import csrf
from tests.test_shopping import BREAD, MILK, add, check


def new_token(client, parent, scope="read", name="Drucker") -> str:
    response = client.post(
        "/api/integrations/tokens", json={"name": name, "scope": scope}, headers=csrf(parent)
    )
    assert response.status_code == 201, response.text
    return response.json()["token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def read_key(client, parent) -> str:
    return new_token(client, parent)


@pytest.fixture
def write_key(client, parent) -> str:
    return new_token(client, parent, scope="write", name="Home Assistant")


# --- Bereiche wie im Frontend ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "area"),
    [
        ("Milchschokolade", "sweets"),
        ("Orangensaft", "drinks"),
        ("Erdbeerjoghurt", "chilled"),
        ("Olivenöl", "pantry"),
        ("Eistee", "drinks"),
        ("Teelichter", "household"),
        ("peanut butter", "pantry"),
        ("Spinat TK", "frozen"),
        ("Erbsen (TK)", "frozen"),
        ("Tiefkühlgemüse", "frozen"),
        ("Spinat", "produce"),
        ("Wasserfilter", "drugstore"),
        ("Paprikapulver", "pantry"),
        ("Paprika", "produce"),
        ("Schrauben", "hardware"),
        ("USB-Kabel", "online"),
        ("Wattestäbchen", "drugstore"),
        ("Lieblingsdings", "other"),
    ],
)
def test_auto_area_matches_frontend(name, area):
    assert auto_area(name, "fluent-emoji-flat:shopping-bags") == area


def test_auto_area_falls_back_to_icon():
    assert auto_area("Lieblingsdings", "fluent-emoji-flat:cheese-wedge") == "chilled"


def test_default_icon_by_store():
    assert default_icon("Zahnpasta") == "fluent-emoji-flat:lotion-bottle"
    assert default_icon("Milch") == "fluent-emoji-flat:shopping-bags"


def test_labels_match_frontend():
    from pathlib import Path

    from app.shopping_areas import LABELS

    locales = Path(__file__).resolve().parents[2] / "frontend/src/locales"
    if not locales.is_dir():
        pytest.skip("Frontend nicht vorhanden (Container)")
    for lang, labels in LABELS.items():
        shopping = json.loads((locales / lang / "common.json").read_text())["shopping"]
        expected = {**shopping["area"], **shopping["store"]}
        assert labels == expected


# --- Schlüssel verwalten -----------------------------------------------------------------------


def test_tokens_need_parent_pin(client, admin):
    response = client.post("/api/integrations/tokens", json={"name": "x"}, headers=csrf(admin))
    assert response.json() == {"code": "parent.locked"}


def test_token_is_shown_once_and_listed_without_secret(client, parent):
    token = new_token(client, parent)
    assert token.startswith("fq_")
    listed = client.get("/api/integrations/tokens").json()
    assert [(t["name"], t["scope"], t["prefix"]) for t in listed] == [
        ("Drucker", "read", token[:7])
    ]
    assert "token" not in listed[0]
    assert listed[0]["last_used_at"] is None


def test_deleted_token_stops_working(client, parent, read_key):
    token_id = client.get("/api/integrations/tokens").json()[0]["id"]
    response = client.delete(f"/api/integrations/tokens/{token_id}", headers=csrf(parent))
    assert response.status_code == 204
    response = client.get("/api/v1/shopping", headers=bearer(read_key))
    assert response.json() == {"code": "api.token_invalid"}


# --- Anmeldung mit Schlüssel -------------------------------------------------------------------


def test_v1_needs_a_token_even_with_session(client, admin):
    response = client.get("/api/v1/shopping")
    assert response.status_code == 401
    assert response.json() == {"code": "api.token_missing"}


def test_wrong_tokens_are_rate_limited(client, admin):
    for _ in range(20):
        assert client.get("/api/v1/shopping", headers=bearer("fq_falsch")).status_code == 401
    assert client.get("/api/v1/shopping", headers=bearer("fq_falsch")).status_code == 429


def test_token_marks_last_use(client, parent, read_key):
    client.get("/api/v1/shopping", headers=bearer(read_key))
    assert client.get("/api/integrations/tokens").json()[0]["last_used_at"] is not None


def test_read_token_cannot_write(client, parent, read_key):
    response = client.post("/api/v1/shopping", json={"name": "Milch"}, headers=bearer(read_key))
    assert response.status_code == 403
    assert response.json() == {"code": "api.read_only"}


# --- Einkaufsliste -----------------------------------------------------------------------------


def test_shopping_list_sorted_by_store_and_area(client, parent, read_key):
    add(client, parent, "Zahnpasta", "fluent-emoji-flat:tooth")
    add(client, parent, "Milch", MILK, note="2 l")
    add(client, parent, "Brot", BREAD)
    done = add(client, parent, "Äpfel", "fluent-emoji-flat:red-apple")
    check(client, parent, done["id"])

    response = client.get("/api/v1/shopping", headers=bearer(read_key))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["open"] == 3
    assert [(i["name"], i["store"], i["area"], i["area_label"]) for i in data["items"]] == [
        ("Brot", "supermarket", "bakery", "Brot & Backwaren"),
        ("Milch", "supermarket", "chilled", "Kühlung"),
        ("Zahnpasta", "drugstore", "drugstore", "Drogerie"),
    ]
    assert data["items"][1]["note"] == "2 l"

    with_checked = client.get(
        "/api/v1/shopping?include_checked=true&store=supermarket&lang=en",
        headers=bearer(read_key),
    ).json()
    assert [(i["name"], i["checked"]) for i in with_checked["items"]] == [
        ("Äpfel", True),
        ("Brot", False),
        ("Milch", False),
    ]
    assert with_checked["items"][0]["area_label"] == "Fruit & veg"


def test_manual_area_and_order_count(client, parent, read_key):
    milk = add(client, parent, "Milch", MILK)
    add(client, parent, "Käse", "fluent-emoji-flat:cheese-wedge")
    client.put(
        f"/api/shopping/items/{milk['id']}/area", json={"area": "online"}, headers=csrf(parent)
    )
    data = client.get("/api/v1/shopping", headers=bearer(read_key)).json()
    assert [(i["name"], i["store"]) for i in data["items"]] == [
        ("Käse", "supermarket"),
        ("Milch", "online"),
    ]


def test_receipt_text(client, parent, read_key):
    add(client, parent, "Milch", MILK, note="2 l")
    add(client, parent, "Zahnpasta", "fluent-emoji-flat:tooth")
    response = client.get("/api/v1/shopping/receipt?width=32", headers=bearer(read_key))
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    lines = response.text.splitlines()
    assert all(len(line) <= 32 for line in lines)
    assert "Familie Test" in response.text
    assert "SUPERMARKT" in lines
    assert "[ ] Milch (2 l)" in lines
    assert "DROGERIE" in lines
    assert "2 Artikel" in lines


def test_receipt_wraps_long_names(client, parent):
    from app.auth import get_family
    from app.db import SessionLocal
    from app.receipt import Entry

    entry = Entry(
        id=1,
        name="Sehr lange Bezeichnung für ein Produkt aus dem Laden",
        note=None,
        recipes=None,
        checked=False,
        store="supermarket",
        area="other",
        position=None,
    )
    with SessionLocal() as db:
        text = receipt_text(get_family(db), [entry], width=20, lang="en")
    lines = text.splitlines()
    assert all(len(line) <= 20 for line in lines)
    assert lines.count("1 item") == 1
    assert any(line.startswith("[ ] Sehr") for line in lines)
    assert any(line.startswith("    ") and line.strip() for line in lines)


def test_receipt_markup(client, parent, read_key):
    add(client, parent, "Milch", MILK, note="2 l")
    add(client, parent, "Zahnpasta", "fluent-emoji-flat:tooth")
    response = client.get("/api/v1/shopping/receipt?format=markup", headers=bearer(read_key))
    assert response.text.splitlines() == [
        "# Einkauf",
        "## Supermarkt",
        "- Milch (2 l)",
        "## Drogerie",
        "- Zahnpasta",
        "---",
    ]
    empty = client.get("/api/v1/shopping/receipt?format=markup&store=hardware&lang=en")
    assert empty.status_code == 401
    text = client.get(
        "/api/v1/shopping/receipt?format=markup&store=hardware&lang=en", headers=bearer(read_key)
    ).text
    assert text.splitlines() == ["# Shopping", "Nothing missing.", "---"]


def test_empty_receipt(client, parent, read_key):
    text = client.get("/api/v1/shopping/receipt?lang=en", headers=bearer(read_key)).text
    assert "Nothing missing." in text
    assert "0 items" in text


def test_add_and_check_with_write_token(client, parent, write_key):
    add(client, parent, "Milch", MILK)
    client.delete("/api/shopping/list/1", headers=csrf(parent))

    response = client.post(
        "/api/v1/shopping", json={"name": "milch", "note": "3 l"}, headers=bearer(write_key)
    )
    assert response.status_code == 201, response.text
    item = response.json()
    # Bekannter Artikel: Name und Symbol bleiben.
    assert (item["name"], item["note"], item["area"]) == ("Milch", "3 l", "chilled")
    assert client.get("/api/shopping/list").json()["items"][0]["icon"] == MILK

    new = client.post(
        "/api/v1/shopping", json={"name": "Duschgel"}, headers=bearer(write_key)
    ).json()
    assert new["store"] == "drugstore"

    response = client.put(
        f"/api/v1/shopping/{item['id']}/checked", json={"checked": True}, headers=bearer(write_key)
    )
    assert response.json()["checked"] is True
    open_items = client.get("/api/v1/shopping", headers=bearer(write_key)).json()["items"]
    assert [i["name"] for i in open_items] == ["Duschgel"]


def test_check_unknown_item(client, parent, write_key):
    response = client.put("/api/v1/shopping/99/checked", json={}, headers=bearer(write_key))
    assert response.status_code == 404


# --- Zu erledigen ------------------------------------------------------------------------------


def test_todos(client, parent, write_key):
    response = client.post(
        "/api/v1/todos", json={"title": "Hühnerfutter"}, headers=bearer(write_key)
    )
    assert response.status_code == 201
    todo = response.json()
    assert client.get("/api/v1/todos", headers=bearer(write_key)).json() == [
        {"id": todo["id"], "title": "Hühnerfutter", "done": False}
    ]
    done = client.post(f"/api/v1/todos/{todo['id']}/done", headers=bearer(write_key)).json()
    assert done["done"] is True


# --- Drucken -----------------------------------------------------------------------------------


@pytest.fixture
def printer(monkeypatch):
    from app import printing

    received: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if "kaputt" in str(request.url):
            return httpx.Response(500)
        received.append(json.loads(request.content))
        return httpx.Response(200)

    monkeypatch.setattr(printing, "transport", httpx.MockTransport(handler))
    return received


def set_printer(client, parent, url, width=32):
    return client.put(
        "/api/integrations/printer", json={"url": url, "width": width}, headers=csrf(parent)
    )


def test_printer_settings(client, parent):
    assert client.get("/api/integrations/printer").json() == {
        "url": None,
        "width": 32,
        "app_url": None,
    }
    assert set_printer(client, parent, "ftp://x").status_code == 422
    response = set_printer(client, parent, "http://drucker.fritz.box:8090/print", 48)
    assert response.json() == {
        "url": "http://drucker.fritz.box:8090/print",
        "width": 48,
        "app_url": None,
    }


def test_print_app_url(client, parent):
    """Die Webseite der Druck-App für die Küchenansicht, auch ohne Bon-Adresse."""
    body = {"url": None, "width": 32, "app_url": "http://druck.fritz.box:8200"}
    response = client.put("/api/integrations/printer", json=body, headers=csrf(parent))
    assert response.json()["app_url"] == "http://druck.fritz.box:8200"
    assert client.get("/api/integrations/printer").json()["app_url"] == body["app_url"]
    bad = {**body, "app_url": "javascript:alert(1)"}
    response = client.put("/api/integrations/printer", json=bad, headers=csrf(parent))
    assert response.status_code == 422


def test_printer_needs_parent_pin(client, admin):
    response = client.put(
        "/api/integrations/printer", json={"url": "http://a.example/x"}, headers=csrf(admin)
    )
    assert response.json() == {"code": "parent.locked"}


def test_print_without_printer(client, admin):
    response = client.post("/api/shopping/print", json={}, headers=csrf(admin))
    assert response.status_code == 409
    assert response.json() == {"code": "print.not_configured"}


def test_print_sends_list(client, parent, printer):
    set_printer(client, parent, "http://drucker.example/print", 24)
    add(client, parent, "Milch", MILK, note="2 l")
    response = client.post("/api/shopping/print", json={"lang": "en"}, headers=csrf(parent))
    assert response.json() == {"items": 1}
    [sent] = printer
    assert sent["kind"] == "shopping_list"
    assert sent["width"] == 24
    assert sent["language"] == "en"
    assert sent["items"][0]["name"] == "Milch"
    assert "[ ] Milch (2 l)" in sent["text"]
    assert all(len(line) <= 24 for line in sent["text"].splitlines())
    assert sent["markup"] == "# Shopping\n## Supermarket\n- Milch (2 l)\n---"


def test_print_failure(client, parent, printer):
    set_printer(client, parent, "http://kaputt.example/print")
    response = client.post("/api/shopping/print", json={}, headers=csrf(parent))
    assert response.status_code == 502
    assert response.json() == {"code": "print.failed"}


def test_print_via_api(client, parent, printer, write_key):
    set_printer(client, parent, "http://drucker.example/print")
    response = client.post("/api/v1/shopping/print", headers=bearer(write_key))
    assert response.json() == {"items": 0}
    assert len(printer) == 1


# --- Zusammenfassung für Home Assistant --------------------------------------------------------


def test_summary(client, parent, read_key, lena):
    add(client, parent, "Milch", MILK)
    client.post(
        "/api/todos",
        json={"title": "Paket abholen", "icon": "fluent-emoji-flat:package"},
        headers=csrf(parent),
    )
    response = client.get("/api/v1/summary", headers=bearer(read_key))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["shopping_open"] == 1
    assert data["shopping"] == ["Milch"]
    assert data["todos"] == ["Paket abholen"]
    assert data["chores_due"] == 0
    assert data["events_today"] == []
    assert data["next_event"] is None
    assert [(m["name"], m["points"]) for m in data["members"]] == [("Lena", 0)]
