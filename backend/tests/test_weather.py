import datetime as dt
from urllib.parse import parse_qs

import httpx2 as httpx
import pytest

from app import weather
from tests.conftest import SATURDAY_NIGHT_UTC, csrf

KOELN = {"name": "Köln", "latitude": 50.9375, "longitude": 6.9603}


class FakeOpenMeteo:
    def __init__(self) -> None:
        self.requests: list[tuple[str, dict[str, str]]] = []
        self.fail = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url).split("?")[0]
        params = {k: v[0] for k, v in parse_qs(request.url.query.decode()).items()}
        self.requests.append((url, params))
        if self.fail:
            return httpx.Response(503)
        if url == weather.GEOCODING_URL:
            return httpx.Response(
                200,
                json={
                    "results": [
                        {**KOELN, "admin1": "Nordrhein-Westfalen", "country": "Deutschland"},
                        {"name": "kaputt"},
                    ]
                },
            )
        assert url == weather.FORECAST_URL
        return httpx.Response(
            200,
            json={
                "current": {"temperature_2m": 12.4, "weather_code": 61, "is_day": 0},
                "daily": {
                    "time": ["2026-10-03", "2026-10-04", "2026-10-05"],
                    "weather_code": [61, 2, 0],
                    "temperature_2m_max": [14.1, 16.0, 18.5],
                    "temperature_2m_min": [8.2, 7.9, 9.0],
                    "precipitation_probability_max": [80, 10, None],
                },
            },
        )


@pytest.fixture
def open_meteo(monkeypatch) -> FakeOpenMeteo:
    fake = FakeOpenMeteo()
    monkeypatch.setattr(weather, "transport", httpx.MockTransport(fake.handler))
    weather.clear_cache()
    yield fake
    weather.clear_cache()


def set_place(client, me, place=KOELN) -> dict:
    response = client.put("/api/weather/place", json=place, headers=csrf(me))
    assert response.status_code == 200, response.text
    return response.json()


def get_weather(client) -> dict:
    response = client.get("/api/weather")
    assert response.status_code == 200, response.text
    return response.json()


def test_without_place_there_is_no_weather(client, admin, open_meteo):
    assert get_weather(client) == {"place": None, "current": None, "days": [], "stale": False}
    assert open_meteo.requests == []


def test_search_places(client, parent, open_meteo):
    response = client.get("/api/weather/places", params={"q": "Köln", "lang": "de"})

    assert response.status_code == 200, response.text
    assert response.json() == [{**KOELN, "region": "Nordrhein-Westfalen", "country": "Deutschland"}]
    [(_, params)] = open_meteo.requests
    assert (params["name"], params["language"]) == ("Köln", "de")


def test_search_needs_unlocked_parent_area(client, admin, open_meteo):
    response = client.get("/api/weather/places", params={"q": "Köln"})
    assert response.status_code == 403
    assert client.get("/api/weather/places", params={"q": "K"}).status_code in (403, 422)


def test_set_place_and_show_forecast(client, parent, now, open_meteo):
    assert set_place(client, parent) == {"place": KOELN}

    data = get_weather(client)

    assert data["place"] == KOELN
    assert data["current"] == {"temperature": 12.4, "code": 61, "is_day": False}
    assert data["days"][0] == {
        "date": "2026-10-03",
        "code": 61,
        "max": 14.1,
        "min": 8.2,
        "precipitation": 80,
    }
    assert data["days"][2]["precipitation"] is None
    assert data["stale"] is False
    [(_, params)] = open_meteo.requests
    assert (params["latitude"], params["longitude"]) == ("50.9375", "6.9603")
    assert params["timezone"] == "Europe/Berlin"


def test_forecast_is_cached(client, parent, now, open_meteo):
    set_place(client, parent)
    get_weather(client)
    get_weather(client)
    assert len(open_meteo.requests) == 1

    now["value"] = SATURDAY_NIGHT_UTC + weather.REFRESH_AFTER
    get_weather(client)
    assert len(open_meteo.requests) == 2


def test_older_forecast_while_open_meteo_is_down(client, parent, now, open_meteo):
    set_place(client, parent)
    get_weather(client)
    open_meteo.fail = True

    now["value"] = SATURDAY_NIGHT_UTC + dt.timedelta(hours=1)
    data = get_weather(client)
    assert (data["current"]["temperature"], data["stale"]) == (12.4, True)

    now["value"] = SATURDAY_NIGHT_UTC + weather.STALE_UNTIL
    response = client.get("/api/weather")
    assert response.status_code == 503
    assert response.json()["code"] == "weather.unavailable"


def test_search_while_open_meteo_is_down(client, parent, open_meteo):
    open_meteo.fail = True
    response = client.get("/api/weather/places", params={"q": "Köln"})
    assert (response.status_code, response.json()["code"]) == (503, "weather.unavailable")


def test_remove_place(client, parent, now, open_meteo):
    set_place(client, parent)
    response = client.delete("/api/weather/place", headers=csrf(parent))

    assert response.json() == {"place": None}
    assert get_weather(client)["place"] is None


def test_place_is_validated_and_needs_parent_area(client, admin, open_meteo):
    response = client.put("/api/weather/place", json={**KOELN, "latitude": 91}, headers=csrf(admin))
    assert response.status_code in (403, 422)

    client.post("/api/parent/unlock", json={"pin": "1234"}, headers=csrf(admin))
    response = client.put("/api/weather/place", json={**KOELN, "latitude": 91}, headers=csrf(admin))
    assert response.status_code == 422


def test_weather_needs_login(client, admin):
    client.cookies.clear()
    assert client.get("/api/weather").status_code == 401
