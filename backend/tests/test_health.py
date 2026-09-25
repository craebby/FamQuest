from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import app


def test_health_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_reports_unreachable_database(client):
    unreachable = create_engine("postgresql+psycopg://nobody@127.0.0.1:1/none")

    def broken_db():
        with Session(unreachable) as session:
            yield session

    app.dependency_overrides[get_db] = broken_db
    try:
        response = client.get("/api/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"status": "error", "database": "error"}


def test_unknown_api_route_returns_error_code(client):
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"code": "common.not_found"}
