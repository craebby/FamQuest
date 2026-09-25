from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import select

from app import google
from app.auth import utcnow
from app.config import get_settings
from app.db import SessionLocal
from app.models import CalendarConnection
from tests.conftest import csrf
from tests.fake_google import CALLBACK, REDIRECT_URI, FakeGoogle


def start(client, me, fake: FakeGoogle | None = None) -> dict[str, str]:
    """Startet die Anmeldung; liefert die Parameter der Google-Adresse."""
    response = client.post("/api/calendar/google/connect", headers=csrf(me))
    assert response.status_code == 200, response.text
    url = urlsplit(response.json()["url"])
    assert f"{url.scheme}://{url.netloc}{url.path}" == google.AUTH_URL
    params = {key: values[0] for key, values in parse_qs(url.query).items()}
    if fake:
        fake.challenges[params["state"]] = params["code_challenge"]
    return params


def callback(client, **params):
    return client.get(CALLBACK, params=params, follow_redirects=False)


def connect(client, me, fake) -> None:
    params = start(client, me, fake)
    response = callback(client, state=params["state"], code="guter-code")
    assert response.headers["location"] == "/parents?calendar=connected"


def connections():
    with SessionLocal() as db:
        return list(db.scalars(select(CalendarConnection)))


def test_settings_without_configuration(client, parent):
    response = client.get("/api/calendar/settings")

    assert response.status_code == 200
    assert response.json() == {
        "configured": False,
        "redirect_uri": REDIRECT_URI,
        "family_color": "pink",
        "holidays": {"region": None, "public": False, "school": False},
        "connections": [],
    }


def test_connect_requires_configuration(client, parent):
    response = client.post("/api/calendar/google/connect", headers=csrf(parent))

    assert response.status_code == 409
    assert response.json() == {"code": "calendar.not_configured"}


def test_calendar_settings_need_unlocked_parent_area(client, admin, configured):
    assert client.get("/api/calendar/settings").status_code == 403
    response = client.post("/api/calendar/google/connect", headers=csrf(admin))
    assert response.json() == {"code": "parent.locked"}


def test_authorization_url(client, parent, configured):
    params = start(client, parent)

    assert params["client_id"] == "client-id"
    assert params["redirect_uri"] == REDIRECT_URI
    assert params["response_type"] == "code"
    assert google.CALENDAR_SCOPE in params["scope"].split()
    assert params["code_challenge_method"] == "S256"
    assert params["access_type"] == "offline"


def test_connect_google_account(client, parent, fake_google):
    connect(client, parent, fake_google)

    settings = client.get("/api/calendar/settings").json()
    assert settings["configured"] is True
    [connection] = settings["connections"]
    assert connection["account_email"] == "mama@gmail.com"
    assert connection["provider"] == "google"
    assert connection["status"] == "ok"

    # Tokens liegen nur verschlüsselt in der Datenbank.
    [stored] = connections()
    assert "refresh-1" not in stored.refresh_token
    assert "access-1" not in (stored.access_token or "")


def test_reconnecting_same_account_replaces_tokens(client, parent, fake_google):
    connect(client, parent, fake_google)
    connect(client, parent, fake_google)
    fake_google.account = {"sub": "google-456", "email": "papa@gmail.com"}
    connect(client, parent, fake_google)

    emails = [
        c["account_email"] for c in client.get("/api/calendar/settings").json()["connections"]
    ]
    assert emails == ["mama@gmail.com", "papa@gmail.com"]


def test_callback_rejects_unknown_state(client, parent, fake_google):
    start(client, parent, fake_google)

    response = callback(client, state="geraten", code="guter-code")

    assert response.headers["location"] == "/parents?calendar_error=calendar.state_invalid"
    assert connections() == []


def test_state_can_only_be_used_once(client, parent, fake_google):
    params = start(client, parent, fake_google)
    callback(client, state=params["state"], code="guter-code")

    response = callback(client, state=params["state"], code="guter-code")

    assert response.headers["location"] == "/parents?calendar_error=calendar.state_invalid"


def test_state_belongs_to_the_starting_session(client, parent, fake_google):
    params = start(client, parent, fake_google)
    client.cookies.clear()

    response = callback(client, state=params["state"], code="guter-code")

    assert response.headers["location"] == "/parents?calendar_error=calendar.state_invalid"
    assert connections() == []


def test_state_expires(client, parent, fake_google, monkeypatch):
    params = start(client, parent, fake_google)
    import app.api.calendar

    later = utcnow() + timedelta(minutes=11)
    monkeypatch.setattr(app.api.calendar, "utcnow", lambda: later)

    response = callback(client, state=params["state"], code="guter-code")

    assert response.headers["location"] == "/parents?calendar_error=calendar.state_invalid"


def test_cancelled_consent(client, parent, fake_google):
    params = start(client, parent, fake_google)

    response = callback(client, state=params["state"], error="access_denied")

    assert response.headers["location"] == "/parents?calendar_error=calendar.access_denied"


def test_calendar_access_not_granted(client, parent, fake_google):
    fake_google.scope = "openid email"
    params = start(client, parent, fake_google)

    response = callback(client, state=params["state"], code="guter-code")

    assert response.headers["location"] == "/parents?calendar_error=calendar.scope_missing"
    assert connections() == []


def test_callback_unlocks_parent_area_again(client, parent, fake_google):
    params = start(client, parent, fake_google)
    client.post("/api/parent/lock", headers=csrf(parent))

    callback(client, state=params["state"], code="guter-code")

    assert client.get("/api/auth/me").json()["parent_unlocked"] is True


def test_access_token_is_reused_until_it_expires(client, parent, fake_google):
    connect(client, parent, fake_google)
    now = utcnow()

    with SessionLocal() as db:
        connection = db.scalars(select(CalendarConnection)).one()
        assert google.access_token(db, connection, now) == "access-1"
        later = now + timedelta(minutes=59, seconds=30)
        assert google.access_token(db, connection, later) == "access-refreshed-1"
        assert google.access_token(db, connection, later) == "access-refreshed-1"
    assert fake_google.refresh_count == 1


def test_revoked_access_needs_reconnect(client, parent, fake_google):
    connect(client, parent, fake_google)
    fake_google.refresh_error = "invalid_grant"

    with SessionLocal() as db:
        connection = db.scalars(select(CalendarConnection)).one()
        with pytest.raises(google.GoogleError) as error:
            google.access_token(db, connection, utcnow() + timedelta(hours=2))
    assert error.value.code == "calendar.reconnect"

    [shown] = client.get("/api/calendar/settings").json()["connections"]
    assert shown["status"] == "reconnect"


def test_changed_encryption_key_needs_reconnect(client, parent, fake_google, monkeypatch):
    connect(client, parent, fake_google)
    monkeypatch.setattr(get_settings(), "token_encryption_key", "ein-anderer-schluessel")

    with SessionLocal() as db:
        connection = db.scalars(select(CalendarConnection)).one()
        with pytest.raises(google.GoogleError):
            google.access_token(db, connection, utcnow())
    assert connections()[0].status == "reconnect"


def test_disconnect_revokes_access(client, parent, fake_google):
    connect(client, parent, fake_google)
    connection_id = connections()[0].id

    response = client.delete(f"/api/calendar/connections/{connection_id}", headers=csrf(parent))

    assert response.status_code == 204
    assert connections() == []
    assert (google.REVOKE_URL, {"token": "refresh-1"}) in fake_google.requests


def test_disconnect_unknown_connection(client, parent):
    response = client.delete("/api/calendar/connections/99", headers=csrf(parent))

    assert response.status_code == 404
    assert response.json() == {"code": "calendar.connection_not_found"}


def test_public_url_sets_redirect_uri(client, parent, configured, monkeypatch):
    monkeypatch.setattr(get_settings(), "public_url", "https://familie.example.com/")

    params = start(client, parent)

    expected = "https://familie.example.com/api/calendar/google/callback"
    assert params["redirect_uri"] == expected
    assert client.get("/api/calendar/settings").json()["redirect_uri"] == expected
