import datetime as dt

import pytest

import app.today
from app import demo, weather


@pytest.fixture
def restore_clock(monkeypatch):
    """Die Demo stellt Uhr und Wetter um; nach dem Test gilt wieder das Original."""
    monkeypatch.setattr(app.today, "utcnow", app.today.utcnow)
    monkeypatch.setattr(weather, "transport", weather.transport)
    yield
    weather.clear_cache()


@pytest.mark.parametrize("lang", ["de", "en"])
def test_demo_family(client, restore_clock, lang):
    now = demo.fixed_clock(dt.time(7, 25), 4)
    demo.Demo(lang, now).run()
    demo.fixed_weather(now.astimezone(demo.ZoneInfo(demo.TIMEZONE)).date())

    login = client.post(
        "/api/auth/login", json={"email": demo.EMAIL, "password": demo.PASSWORD}
    ).json()
    today = client.get("/api/today").json()
    assert today["date"] == now.astimezone(demo.ZoneInfo(demo.TIMEZONE)).date().isoformat()
    assert today["time_of_day"] == "morning"
    assert today["pending_approvals"] == 1
    assert [m["name"] for m in client.get("/api/members").json()] == ["Mia", "Ben", "Anna", "Tom"]

    week = client.get("/api/calendar/week").json()
    icons = {e["title"]: e["icon"] for d in week["days"] for e in d["events"]}
    assert icons[demo.TEXT[lang]["events"]["judo"]] == "fluent-emoji-flat:martial-arts-uniform"
    # Erwachsene bekommen keine Symbole.
    assert icons[demo.TEXT[lang]["events"]["lunch"]] is None

    chores = client.get("/api/chores").json()
    levels = [chore["level"] for chore in chores["chores"]]
    assert (levels.count("due"), levels.count("soon"), levels.count("ok")) == (3, 2, 3)
    assert sorted(share["count"] for share in chores["shares"]) == [2, 5, 6]

    assert client.get("/api/weather").json()["current"]["temperature"] == 14
    client.post(
        "/api/parent/unlock", json={"pin": demo.PIN}, headers={"X-CSRF-Token": login["csrf_token"]}
    )
    assert len(client.get("/api/photos").json()) == 4
