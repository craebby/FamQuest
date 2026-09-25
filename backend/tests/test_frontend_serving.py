import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def spa_client(tmp_path):
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>index</html>")
    (static / "assets" / "app.js").write_text("console.log(1)")
    (static / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("secret")

    settings = Settings(static_dir=static, upload_dir=tmp_path / "uploads")
    return TestClient(create_app(settings))


def test_serves_index_for_root_and_client_routes(spa_client):
    for path in ("/", "/family", "/parents/tasks"):
        response = spa_client.get(path)
        assert response.status_code == 200
        assert response.text == "<html>index</html>"


def test_serves_static_files(spa_client):
    assert spa_client.get("/assets/app.js").text == "console.log(1)"
    assert spa_client.get("/favicon.svg").text == "<svg/>"


def test_does_not_serve_files_outside_static_dir(spa_client):
    response = spa_client.get("/%2e%2e/secret.txt")
    assert "secret" not in response.text


def test_api_routes_are_not_swallowed_by_spa(spa_client):
    assert spa_client.get("/api/health").json()["status"] == "ok"
    assert spa_client.get("/api/unknown").json() == {"code": "common.not_found"}
