"""Wetter für die Startseite, von Open-Meteo (https://open-meteo.com, frei, ohne Schlüssel).

Der Server fragt, nicht der Browser: Übertragen werden nur die Koordinaten des Orts und die
Zeitzone. Antworten bleiben einige Minuten im Speicher, damit nicht jedes Display bei jedem Abruf
eine Anfrage auslöst. Schlägt eine Anfrage fehl, gilt eine ältere Vorhersage noch eine Weile.
"""

import datetime as dt
import threading
from dataclasses import dataclass

import httpx2 as httpx

from app.logs import logger

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
# So lange gilt eine Vorhersage als aktuell.
REFRESH_AFTER = dt.timedelta(minutes=15)
# So lange wird eine ältere Vorhersage gezeigt, wenn Open-Meteo nicht erreichbar ist.
STALE_UNTIL = dt.timedelta(hours=6)
FORECAST_DAYS = 3
MAX_RESULTS = 8

# Tests setzen hier einen httpx.MockTransport ein.
transport: httpx.BaseTransport | None = None


class WeatherUnavailable(Exception):
    """Open-Meteo nicht erreichbar oder Antwort unbrauchbar."""


@dataclass
class Current:
    temperature: float
    # WMO-Wettercode, siehe https://open-meteo.com/en/docs (Abschnitt „WMO Weather interpretation“)
    code: int
    is_day: bool


@dataclass
class Day:
    date: dt.date
    code: int
    max: float
    min: float
    # Höchste Regenwahrscheinlichkeit des Tages in Prozent; None, wenn unbekannt.
    precipitation: int | None


@dataclass
class Forecast:
    current: Current
    days: list[Day]
    fetched_at: dt.datetime


@dataclass
class Place:
    name: str
    # Bundesland bzw. Region und Land, zum Unterscheiden gleichnamiger Orte.
    region: str | None
    country: str | None
    latitude: float
    longitude: float


_cache: dict[tuple[float, float, str], Forecast] = {}
_lock = threading.Lock()


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def _get(url: str, params: dict[str, str | int | float]) -> dict:
    try:
        with httpx.Client(timeout=10, transport=transport) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Open-Meteo nicht erreichbar: %s", type(exc).__name__)
        raise WeatherUnavailable from exc
    if not isinstance(data, dict):
        raise WeatherUnavailable
    return data


def _fetch(latitude: float, longitude: float, timezone: str, now: dt.datetime) -> Forecast:
    data = _get(
        FORECAST_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "timezone": timezone,
            "forecast_days": FORECAST_DAYS,
            "current": "temperature_2m,weather_code,is_day",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,"
            "precipitation_probability_max",
        },
    )
    try:
        current, daily = data["current"], data["daily"]
        rain = daily.get("precipitation_probability_max") or []
        days = [
            Day(
                date=dt.date.fromisoformat(day),
                code=int(daily["weather_code"][index]),
                max=float(daily["temperature_2m_max"][index]),
                min=float(daily["temperature_2m_min"][index]),
                precipitation=(
                    int(rain[index]) if index < len(rain) and rain[index] is not None else None
                ),
            )
            for index, day in enumerate(daily["time"])
        ]
        return Forecast(
            current=Current(
                temperature=float(current["temperature_2m"]),
                code=int(current["weather_code"]),
                is_day=bool(current["is_day"]),
            ),
            days=days,
            fetched_at=now,
        )
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        logger.warning("Unerwartete Antwort von Open-Meteo: %s", type(exc).__name__)
        raise WeatherUnavailable from exc


def forecast(latitude: float, longitude: float, timezone: str, now: dt.datetime) -> Forecast:
    """Vorhersage für den Ort, aus dem Zwischenspeicher oder frisch geladen."""
    key = (round(latitude, 4), round(longitude, 4), timezone)
    with _lock:
        cached = _cache.get(key)
        if cached is not None and now - cached.fetched_at < REFRESH_AFTER:
            return cached
        try:
            fresh = _fetch(latitude, longitude, timezone, now)
        except WeatherUnavailable:
            if cached is not None and now - cached.fetched_at < STALE_UNTIL:
                return cached
            raise
        _cache[key] = fresh
        return fresh


def search_places(query: str, language: str) -> list[Place]:
    """Ortssuche für den Elternbereich (Name oder Postleitzahl)."""
    data = _get(
        GEOCODING_URL,
        {"name": query, "count": MAX_RESULTS, "language": language, "format": "json"},
    )
    places = []
    for item in data.get("results") or []:
        try:
            places.append(
                Place(
                    name=str(item["name"])[:200],
                    region=item.get("admin1"),
                    country=item.get("country"),
                    latitude=float(item["latitude"]),
                    longitude=float(item["longitude"]),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return places
