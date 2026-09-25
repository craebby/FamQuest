"""Wetter auf der Startseite; den Ort legen die Eltern im Elternbereich fest."""

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field, StringConstraints

from app import weather
from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.errors import ApiError
from app.schemas import LanguageCode
from app.today import family_now

router = APIRouter(prefix="/weather", tags=["weather"])


class PlaceIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class PlaceOut(PlaceIn):
    region: str | None = None
    country: str | None = None


class CurrentOut(BaseModel):
    temperature: float
    code: int
    is_day: bool


class DayOut(BaseModel):
    date: dt.date
    code: int
    max: float
    min: float
    precipitation: int | None


class WeatherOut(BaseModel):
    # None: Kein Ort festgelegt, die Startseite zeigt dann einen Hinweis.
    place: PlaceIn | None
    current: CurrentOut | None
    # Heute und die nächsten Tage.
    days: list[DayOut]
    # Open-Meteo war zuletzt nicht erreichbar; gezeigt wird eine ältere Vorhersage.
    stale: bool


class WeatherSettingsOut(BaseModel):
    place: PlaceIn | None


def _place(db: DbSession) -> PlaceIn | None:
    family = get_family(db)
    if family.weather_place is None or family.weather_latitude is None:
        return None
    return PlaceIn(
        name=family.weather_place,
        latitude=family.weather_latitude,
        longitude=family.weather_longitude,
    )


@router.get("")
def get_weather(_: CurrentSession, db: DbSession) -> WeatherOut:
    place = _place(db)
    if place is None:
        return WeatherOut(place=None, current=None, days=[], stale=False)
    family = get_family(db)
    now = family_now(family)
    try:
        found = weather.forecast(place.latitude, place.longitude, family.timezone, now)
    except weather.WeatherUnavailable:
        raise ApiError(status.HTTP_503_SERVICE_UNAVAILABLE, "weather.unavailable") from None
    return WeatherOut(
        place=place,
        current=CurrentOut(**vars(found.current)),
        days=[DayOut(**vars(day)) for day in found.days],
        stale=now - found.fetched_at >= weather.REFRESH_AFTER,
    )


@router.get("/places")
def search_places(
    _: ParentSession,
    q: Annotated[str, Query(min_length=2, max_length=100)],
    lang: Annotated[LanguageCode, Query()] = "de",
) -> list[PlaceOut]:
    """Ortssuche für den Elternbereich (über den Server, damit der Browser nichts extern lädt)."""
    try:
        places = weather.search_places(q.strip(), lang)
    except weather.WeatherUnavailable:
        raise ApiError(status.HTTP_503_SERVICE_UNAVAILABLE, "weather.unavailable") from None
    return [PlaceOut(**vars(place)) for place in places]


@router.put("/place")
def set_place(body: PlaceIn, _: ParentSession, db: DbSession) -> WeatherSettingsOut:
    family = get_family(db)
    family.weather_place = body.name
    family.weather_latitude, family.weather_longitude = body.latitude, body.longitude
    db.commit()
    return WeatherSettingsOut(place=_place(db))


@router.delete("/place")
def remove_place(_: ParentSession, db: DbSession) -> WeatherSettingsOut:
    family = get_family(db)
    family.weather_place = family.weather_latitude = family.weather_longitude = None
    db.commit()
    return WeatherSettingsOut(place=None)
