from datetime import timedelta

from sqlalchemy import update

from app.auth import utcnow
from app.db import engine
from app.models import AuthSession
from tests.conftest import SETUP_DATA, csrf


def unlock(client, me, pin="1234"):
    return client.post("/api/parent/unlock", json={"pin": pin}, headers=csrf(me))


def test_parent_area_is_locked_after_setup(client, admin):
    response = client.put("/api/parent/pin", json={"pin": "5678"}, headers=csrf(admin))

    assert response.status_code == 403
    assert response.json() == {"code": "parent.locked"}


def test_parent_area_requires_login(client):
    assert client.post("/api/parent/unlock", json={"pin": "1234"}).status_code == 401


def test_unlock_with_correct_pin(client, admin):
    response = unlock(client, admin)

    assert response.status_code == 200
    assert response.json()["parent_unlocked"] is True
    assert client.get("/api/auth/me").json()["parent_unlocked"] is True


def test_unlock_with_wrong_pin(client, admin):
    response = unlock(client, admin, pin="0000")

    assert response.status_code == 403
    assert response.json() == {"code": "pin.wrong"}
    assert client.get("/api/auth/me").json()["parent_unlocked"] is False


def test_pin_entry_is_rate_limited(client, admin):
    for _ in range(5):
        assert unlock(client, admin, pin="0000").status_code == 403

    response = unlock(client, admin)

    assert response.status_code == 429
    assert response.json() == {"code": "auth.rate_limited"}


def test_lock_closes_parent_area(client, admin):
    unlock(client, admin)

    me = client.post("/api/parent/lock", headers=csrf(admin)).json()

    assert me["parent_unlocked"] is False


def test_unlock_expires(client, admin):
    unlock(client, admin)
    with engine.begin() as conn:
        conn.execute(update(AuthSession).values(parent_unlocked_until=utcnow() - timedelta(1)))

    response = client.put("/api/parent/pin", json={"pin": "5678"}, headers=csrf(admin))

    assert response.status_code == 403
    assert response.json() == {"code": "parent.locked"}


def test_change_pin(client, admin):
    unlock(client, admin)

    response = client.put("/api/parent/pin", json={"pin": "987654"}, headers=csrf(admin))
    assert response.status_code == 200
    client.post("/api/parent/lock", headers=csrf(admin))

    assert unlock(client, admin, pin="1234").status_code == 403
    assert unlock(client, admin, pin="987654").status_code == 200


def test_invalid_new_pin_is_rejected(client, admin):
    unlock(client, admin)

    response = client.put("/api/parent/pin", json={"pin": "12"}, headers=csrf(admin))

    assert response.status_code == 422
    assert response.json()["fields"] == {"pin": "validation.invalid_format"}


def test_disable_pin_opens_parent_area(client, admin):
    unlock(client, admin)

    me = client.delete("/api/parent/pin", headers=csrf(admin)).json()
    assert me["family"]["pin_enabled"] is False

    client.post("/api/parent/lock", headers=csrf(admin))
    assert client.get("/api/auth/me").json()["parent_unlocked"] is True


def test_enable_pin_again(client, admin):
    unlock(client, admin)
    client.delete("/api/parent/pin", headers=csrf(admin))

    me = client.put("/api/parent/pin", json={"pin": "4321"}, headers=csrf(admin)).json()
    assert me["family"]["pin_enabled"] is True

    client.post("/api/parent/lock", headers=csrf(admin))
    assert client.get("/api/auth/me").json()["parent_unlocked"] is False
    assert unlock(client, admin, pin="4321").status_code == 200


def test_forgotten_pin_can_be_reset_with_password(client, admin):
    response = client.post(
        "/api/parent/pin/reset",
        json={"password": SETUP_DATA["password"], "pin": "2468"},
        headers=csrf(admin),
    )

    assert response.status_code == 200
    assert response.json()["parent_unlocked"] is True
    client.post("/api/parent/lock", headers=csrf(admin))
    assert unlock(client, admin, pin="2468").status_code == 200


def test_pin_reset_with_wrong_password(client, admin):
    response = client.post(
        "/api/parent/pin/reset",
        json={"password": "falsch-falsch", "pin": "2468"},
        headers=csrf(admin),
    )

    assert response.status_code == 403
    assert response.json() == {"code": "auth.invalid_credentials"}
    assert unlock(client, admin, pin="1234").status_code == 200
