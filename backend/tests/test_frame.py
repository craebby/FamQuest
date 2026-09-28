import pytest

from app.auth import get_family
from app.db import SessionLocal
from tests.conftest import csrf

DEFAULT = {
    "show_clock": True,
    "show_weather": True,
    "show_event": True,
    "show_tasks": False,
    "photo_seconds": 60,
    "night_enabled": False,
    "night_start": "22:00",
    "night_end": "06:00",
    "night_style": "clock",
}


def get_settings(client) -> dict:
    response = client.get("/api/frame/settings")
    assert response.status_code == 200, response.text
    return response.json()


def test_default_settings(client, admin):
    assert get_settings(client) == DEFAULT


def test_parents_change_settings(client, parent):
    settings = {
        "show_clock": False,
        "show_weather": True,
        "show_event": False,
        "show_tasks": True,
        "photo_seconds": 15,
        "night_enabled": True,
        "night_start": "21:30",
        "night_end": "07:15",
        "night_style": "dark",
    }
    response = client.put("/api/frame/settings", json=settings, headers=csrf(parent))

    assert response.status_code == 200, response.text
    assert response.json() == settings
    assert get_settings(client) == settings


def test_missing_fields_keep_their_default(client, parent):
    response = client.put("/api/frame/settings", json={"show_tasks": True}, headers=csrf(parent))

    assert response.status_code == 200, response.text
    assert get_settings(client) == {**DEFAULT, "show_tasks": True}


def test_invalid_values_in_database_fall_back_to_default(client, admin):
    with SessionLocal() as db:
        get_family(db).frame_settings = {
            "photo_seconds": 7,
            "show_clock": False,
            "horoscope": 1,
            "night_start": "25:00",
            "night_end": "05:30",
            "night_style": "moon",
        }
        db.commit()

    assert get_settings(client) == {**DEFAULT, "show_clock": False, "night_end": "05:30"}


def test_invalid_duration_is_rejected(client, parent):
    response = client.put("/api/frame/settings", json={"photo_seconds": 7}, headers=csrf(parent))
    assert response.status_code == 422
    assert response.json()["code"] == "common.validation"
    assert get_settings(client) == DEFAULT


@pytest.mark.parametrize(
    "change",
    [
        {"night_start": "24:00"},
        {"night_end": "7:00"},
        {"night_end": "07:60"},
        {"night_start": "22:00:00"},
        {"night_style": "moon"},
    ],
)
def test_invalid_night_mode_is_rejected(client, parent, change):
    response = client.put("/api/frame/settings", json=change, headers=csrf(parent))
    assert response.status_code == 422
    assert response.json()["code"] == "common.validation"
    assert get_settings(client) == DEFAULT


def test_changes_need_unlocked_parent_area(client, admin):
    response = client.put("/api/frame/settings", json={"show_tasks": True}, headers=csrf(admin))
    assert response.status_code == 403
    assert get_settings(client) == DEFAULT


def test_settings_need_login(client):
    assert client.get("/api/frame/settings").status_code == 401
