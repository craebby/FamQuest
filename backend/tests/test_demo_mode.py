import datetime as dt

import pytest
from fastapi.testclient import TestClient

import app.today
from app import demo, demo_mode, weather
from app.config import Settings, get_settings
from tests.conftest import SETUP_DATA, csrf


@pytest.fixture
def demo_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "demo_mode", "de")


@pytest.fixture
def restore_clock(monkeypatch):
    monkeypatch.setattr(app.today, "utcnow", app.today.utcnow)
    monkeypatch.setattr(weather, "transport", weather.transport)
    yield
    weather.clear_cache()


def test_status_without_demo(client):
    assert client.get("/api/setup/status").json() == {"setup_required": True, "demo": None}


def test_status_in_demo(client, demo_on):
    assert client.get("/api/setup/status").json()["demo"] == {
        "language": "de",
        "pin": demo.PIN,
        "reset_minutes": 60,
    }


def test_demo_login_only_in_demo(client, admin):
    client.cookies.clear()
    response = client.post("/api/demo/login")
    assert response.status_code == 404


def test_demo_login(client, admin, demo_on):
    client.cookies.clear()
    assert client.get("/api/auth/me").status_code == 401
    response = client.post("/api/demo/login")
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == SETUP_DATA["email"].lower()
    assert client.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("PUT", "/api/parent/pin", {"pin": "9999"}),
        ("DELETE", "/api/parent/pin", None),
        ("POST", "/api/parent/pin/reset", {"password": "x", "pin": "9999"}),
        (
            "PUT",
            "/api/parent/family",
            {"name": "X", "default_language": "de", "timezone": "Europe/Berlin"},
        ),
        ("POST", "/api/photos", None),
        ("PUT", "/api/members/1/avatar", None),
        ("PUT", "/api/dishes/1/image", None),
    ],
)
def test_blocked_in_demo(client, parent, demo_on, method, path, body):
    response = client.request(method, path, json=body, headers=csrf(parent))
    assert response.status_code == 403, response.text
    assert response.json() == {"code": "demo.disabled"}


def test_not_blocked_without_demo(client, parent):
    response = client.put("/api/parent/pin", json={"pin": "9999"}, headers=csrf(parent))
    assert response.status_code == 200


def test_reset(client, restore_clock, demo_on):
    demo_mode.reset("de")
    # Nach dem Anlegen läuft die Uhr wieder echt.
    assert abs(app.today.utcnow() - dt.datetime.now(dt.UTC)) < dt.timedelta(seconds=5)

    client.post("/api/demo/login")
    me = client.get("/api/auth/me").json()
    names = [m["name"] for m in client.get("/api/members").json()]
    assert names == ["Mia", "Ben", "Anna", "Tom"]
    # Was Besucher ändern, ist nach dem nächsten Zurücksetzen wieder weg.
    client.post("/api/parent/unlock", json={"pin": demo.PIN}, headers=csrf(me))
    client.delete("/api/members/1", headers=csrf(me))
    assert len(client.get("/api/members").json()) == 3

    demo_mode.reset("de")
    assert client.get("/api/auth/me").status_code == 401
    client.post("/api/demo/login")
    assert [m["name"] for m in client.get("/api/members").json()] == names


def test_api_waits_while_resetting(monkeypatch):
    from app.main import create_app

    demo_app = create_app(Settings(demo_mode="de", calendar_sync_minutes=0))
    client = TestClient(demo_app)  # ohne Lifespan: kein Zurücksetzen im Hintergrund
    monkeypatch.setattr(demo_mode, "_resetting", type("Set", (), {"is_set": lambda self: True})())

    response = client.get("/api/setup/status")
    assert response.status_code == 503
    assert response.json() == {"code": "demo.resetting"}
    assert client.get("/api/health").status_code == 200
    seed = client.get("/api/setup/status", headers={demo_mode.SEED_HEADER: demo_mode.SEED_TOKEN})
    assert seed.status_code == 200


def test_next_reset_on_the_hour():
    now = dt.datetime(2026, 9, 29, 14, 37, 12, tzinfo=dt.UTC)
    hour = dt.timedelta(minutes=60)
    assert demo_mode.next_reset(now, hour) == dt.datetime(2026, 9, 29, 15, 0, tzinfo=dt.UTC)
    exact = dt.datetime(2026, 9, 29, 15, 0, tzinfo=dt.UTC)
    assert demo_mode.next_reset(exact, hour) == dt.datetime(2026, 9, 29, 16, 0, tzinfo=dt.UTC)
