from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import SETUP_DATA, run_setup


def test_setup_required_on_first_start(client):
    assert client.get("/api/setup/status").json() == {"setup_required": True}


def test_setup_creates_family_and_admin_and_logs_in(client):
    me = run_setup(client)

    assert me["user"] == {"email": "mama@example.org", "role": "admin", "language": None}
    assert me["family"] == {
        "name": "Familie Test",
        "default_language": "de",
        "timezone": "Europe/Berlin",
        "pin_enabled": True,
    }
    assert me["parent_unlocked"] is False
    assert client.get("/api/auth/me").json()["user"]["email"] == "mama@example.org"
    assert client.get("/api/setup/status").json() == {"setup_required": False}


def test_session_cookie_is_http_only_and_same_site(client):
    response = client.post("/api/setup", json=SETUP_DATA)

    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "secure" not in cookie  # nur über HTTPS


def test_setup_is_locked_after_first_admin(client):
    run_setup(client)

    response = client.post("/api/setup", json={**SETUP_DATA, "email": "angreifer@example.org"})

    assert response.status_code == 409
    assert response.json() == {"code": "setup.already_done"}


def test_concurrent_setup_creates_only_one_admin():
    def attempt(index: int) -> int:
        with TestClient(app) as client:
            data = {**SETUP_DATA, "email": f"user{index}@example.org"}
            return client.post("/api/setup", json=data).status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = sorted(pool.map(attempt, range(4)))

    assert results == [201, 409, 409, 409]


def test_setup_validation_returns_field_codes(client):
    response = client.post(
        "/api/setup",
        json={
            "language": "deutsch",
            "family_name": "   ",
            "email": "keine-mail",
            "password": "kurz",
            "pin": "12a4",
            "timezone": "Mars/Olympus",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "code": "common.validation",
        "fields": {
            "language": "validation.invalid_format",
            "family_name": "validation.too_short",
            "email": "validation.invalid_email",
            "password": "validation.too_short",
            "pin": "validation.invalid_format",
            "timezone": "validation.invalid_timezone",
        },
    }


def test_setup_accepts_lan_email_addresses(client):
    me = run_setup(client, email="papa@familie.local")
    assert me["user"]["email"] == "papa@familie.local"


def test_setup_rejects_foreign_origin(client):
    response = client.post("/api/setup", json=SETUP_DATA, headers={"Origin": "https://evil.test"})

    assert response.status_code == 403
    assert response.json() == {"code": "auth.csrf_failed"}
    assert client.get("/api/setup/status").json() == {"setup_required": True}
