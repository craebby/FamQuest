import logging
from datetime import timedelta

from sqlalchemy import update

from app.auth import utcnow
from app.db import engine
from app.logs import logger
from app.models import AuthSession
from tests.conftest import SETUP_DATA, csrf


def login(client, email=SETUP_DATA["email"], password=SETUP_DATA["password"], **kwargs):
    return client.post("/api/auth/login", json={"email": email, "password": password}, **kwargs)


def test_me_requires_login(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json() == {"code": "auth.not_authenticated"}


def test_login_and_logout(client, admin):
    client.post("/api/auth/logout", headers=csrf(admin))
    assert client.get("/api/auth/me").status_code == 401

    response = login(client, email="  MAMA@example.org ")
    assert response.status_code == 200
    me = response.json()
    assert me["user"]["email"] == "mama@example.org"

    assert client.post("/api/auth/logout", headers=csrf(me)).status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_logout_invalidates_session_on_server(client, admin):
    token = client.cookies.get("famquest_session")
    client.post("/api/auth/logout", headers=csrf(admin))

    client.cookies.set("famquest_session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_login_with_wrong_password(client, admin):
    response = login(client, password="falsch-falsch")

    assert response.status_code == 401
    assert response.json() == {"code": "auth.invalid_credentials"}


def test_login_with_unknown_email(client, admin):
    response = login(client, email="niemand@example.org")

    assert response.status_code == 401
    assert response.json() == {"code": "auth.invalid_credentials"}


def test_login_is_rate_limited(client, admin):
    for _ in range(5):
        assert login(client, password="falsch-falsch").status_code == 401

    response = login(client)  # auch das richtige Passwort wird jetzt abgewiesen

    assert response.status_code == 429
    assert response.json() == {"code": "auth.rate_limited"}


def test_login_rejects_foreign_origin(client, admin):
    response = login(client, headers={"Origin": "https://evil.test"})

    assert response.status_code == 403
    assert response.json() == {"code": "auth.csrf_failed"}


def test_login_accepts_same_origin(client, admin):
    assert login(client, headers={"Origin": "http://testserver"}).status_code == 200


def test_write_requests_require_csrf_token(client, admin):
    missing = client.post("/api/auth/logout")
    wrong = client.post("/api/auth/logout", headers={"X-CSRF-Token": "falsch"})

    for response in (missing, wrong):
        assert response.status_code == 403
        assert response.json() == {"code": "auth.csrf_failed"}
    assert client.get("/api/auth/me").status_code == 200


def test_expired_session_is_rejected(client, admin):
    with engine.begin() as conn:
        conn.execute(update(AuthSession).values(expires_at=utcnow() - timedelta(seconds=1)))

    assert client.get("/api/auth/me").status_code == 401


def test_session_is_extended_on_use(client, admin):
    stale = utcnow() - timedelta(days=30)
    with engine.begin() as conn:
        conn.execute(
            update(AuthSession).values(last_seen_at=stale, expires_at=stale + timedelta(days=365))
        )

    assert client.get("/api/auth/me").status_code == 200

    with engine.connect() as conn:
        expires_at = conn.scalar(
            AuthSession.__table__.select().with_only_columns(AuthSession.expires_at)
        )
    assert expires_at > utcnow() + timedelta(days=364)


def test_failed_login_is_logged_with_reason(client, admin, caplog):
    logger.addHandler(caplog.handler)
    try:
        caplog.set_level(logging.INFO, logger="famquest")
        client.post("/api/auth/logout", headers={"X-CSRF-Token": admin["csrf_token"]})
        client.post("/api/auth/login", json={"email": "papa@example.org", "password": "x"})
        client.post(
            "/api/auth/login", json={"email": "mama@example.org", "password": "falsch-falsch"}
        )
    finally:
        logger.removeHandler(caplog.handler)

    messages = [record.getMessage() for record in caplog.records]
    assert any("kein Konto mit dieser E-Mail" in m for m in messages)
    assert any("falsches Passwort für Konto 1" in m for m in messages)
    # E-Mail-Adressen nur auf Stufe debug, Passwörter nie.
    assert not any("example.org" in m or "falsch-falsch" in m for m in messages)
