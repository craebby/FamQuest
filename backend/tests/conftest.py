import datetime as dt
import os
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.config import Settings

# Tests laufen gegen eine eigene Datenbank auf demselben PostgreSQL-Server.
# Das muss passieren, bevor app.db die Engine anlegt.
TEST_DB = f"{Settings().postgres_db}_test"
os.environ["POSTGRES_DB"] = TEST_DB
# Hochgeladene Bilder landen in einem temporären Verzeichnis.
UPLOAD_DIR = Path(tempfile.mkdtemp(prefix="famquest-test-uploads-"))
os.environ["UPLOAD_DIR"] = str(UPLOAD_DIR)
# Keine Kalender-Synchronisation im Hintergrund; Tests rufen sie gezielt auf.
os.environ["CALENDAR_SYNC_MINUTES"] = "0"
# Google-Zugangsdaten aus der lokalen .env gelten nicht; Tests schalten sie mit `configured` ein.
for name in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY"):
    os.environ[name] = ""

# Freitag, 2. Oktober 2026, 23:30 UTC = Samstag, 3. Oktober, 01:30 in Berlin.
SATURDAY_NIGHT_UTC = dt.datetime(2026, 10, 2, 23, 30, tzinfo=dt.UTC)
SATURDAY = "2026-10-03"

BACKEND_DIR = Path(__file__).resolve().parents[1]

SETUP_DATA = {
    "language": "de",
    "family_name": "Familie Test",
    "email": "Mama@Example.org",
    "password": "sehr-geheim-123",
    "pin": "1234",
    "timezone": "Europe/Berlin",
}


def alembic_config() -> Config:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["configure_logger"] = False
    return config


def _recreate_test_database(settings: Settings) -> None:
    admin = create_engine(settings.database_url("postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{TEST_DB}"'))
    admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def database() -> None:
    _recreate_test_database(Settings())
    command.upgrade(alembic_config(), "head")


@pytest.fixture(autouse=True)
def clean_state() -> Iterator[None]:
    """Jeder Test startet mit leerer Datenbank und zurückgesetzten Rate-Limits."""
    yield
    from app.db import Base, engine
    from app.security import login_limiter, pin_limiter

    tables = ", ".join(f'"{table.name}"' for table in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    login_limiter.clear()
    pin_limiter.clear()
    shutil.rmtree(UPLOAD_DIR / "avatars", ignore_errors=True)


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def run_setup(client: TestClient, **overrides) -> dict:
    response = client.post("/api/setup", json={**SETUP_DATA, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def csrf(me: dict) -> dict[str, str]:
    return {"X-CSRF-Token": me["csrf_token"]}


@pytest.fixture
def admin(client) -> dict:
    """Setup ausgeführt, Client ist als Admin angemeldet. Liefert die /me-Antwort."""
    return run_setup(client)


@pytest.fixture
def parent(client, admin) -> dict:
    """Wie `admin`, zusätzlich ist der Elternbereich entsperrt."""
    response = client.post(
        "/api/parent/unlock", json={"pin": SETUP_DATA["pin"]}, headers=csrf(admin)
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def now(monkeypatch):
    """Stellt die Uhr; Standard ist Samstag früh in Berlin."""
    import app.today

    current = {"value": SATURDAY_NIGHT_UTC}
    monkeypatch.setattr(app.today, "utcnow", lambda: current["value"])
    return current


@pytest.fixture
def lena(client, parent) -> int:
    """Ein Kind namens Lena; liefert die Id."""
    from tests.test_tasks import add_member

    return add_member(client, parent)


@pytest.fixture
def configured(monkeypatch):
    """Google-Zugangsdaten gesetzt, Kalender damit eingeschaltet."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "client-id")
    monkeypatch.setattr(settings, "google_client_secret", "client-secret")
    monkeypatch.setattr(settings, "token_encryption_key", "ein-langer-test-schluessel")


@pytest.fixture
def fake_google(configured, monkeypatch):
    """Nachgebautes Google statt echter Anfragen."""
    import httpx2 as httpx

    from app import google
    from tests.fake_google import FakeGoogle

    fake = FakeGoogle()
    monkeypatch.setattr(google, "transport", httpx.MockTransport(fake.handler))
    return fake
