import os
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

BACKEND_DIR = Path(__file__).resolve().parents[1]


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


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
