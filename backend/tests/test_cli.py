import io

from app.cli import main
from tests.conftest import SETUP_DATA


def login(client, password):
    return client.post("/api/auth/login", json={"email": SETUP_DATA["email"], "password": password})


def test_lists_users(admin, capsys):
    assert main(["users"]) == 0
    assert "mama@example.org  (admin)" in capsys.readouterr().out


def test_reset_password(client, admin, monkeypatch):
    monkeypatch.setattr("sys.stdin", io.StringIO("ganz-neues-passwort\n"))

    assert main(["reset-password", " Mama@Example.org ", "--password-stdin"]) == 0

    assert login(client, SETUP_DATA["password"]).status_code == 401
    assert login(client, "ganz-neues-passwort").status_code == 200


def test_reset_password_checks_input(client, admin, monkeypatch, capsys):
    assert main(["reset-password", "papa@example.org", "--password-stdin"]) == 1
    assert "mama@example.org" in capsys.readouterr().err

    monkeypatch.setattr("sys.stdin", io.StringIO("kurz\n"))
    assert main(["reset-password", "mama@example.org", "--password-stdin"]) == 1
    assert login(client, SETUP_DATA["password"]).status_code == 200
