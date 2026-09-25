"""Feiertage und Schulferien für den Kalender (vorerst nur Deutschland, je Bundesland).

Gesetzliche Feiertage berechnet die Bibliothek `holidays` offline. Schulferien gibt es nicht als
Regel; sie kommen einmal täglich von OpenHolidays (https://openholidaysapi.org, frei, ohne
Schlüssel) und liegen in der Tabelle school_holidays.
"""

import datetime as dt
from dataclasses import dataclass

import holidays as holiday_rules
import httpx2 as httpx
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.logs import logger
from app.models import Family, SchoolHoliday

# Bundesländer (ISO 3166-2 ohne "DE-"); die Namen stehen in den Übersetzungen.
REGIONS = (
    "BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV",
    "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH",
)  # fmt: skip
SCHOOL_HOLIDAYS_URL = "https://openholidaysapi.org/SchoolHolidays"
# So oft werden die Schulferien neu geladen (sie ändern sich selten).
REFRESH_AFTER = dt.timedelta(days=1)
# Namen der Feiertage je Sprache der Oberfläche.
_RULE_LANGUAGES = {"de": "de", "en": "en_US"}

# Tests setzen hier einen httpx.MockTransport ein.
transport: httpx.BaseTransport | None = None


@dataclass
class Holiday:
    # "public" (Feiertag) oder "school" (Schulferien)
    kind: str
    name: str
    start: dt.date
    # exklusiv
    end: dt.date


def public_holidays(region: str, start: dt.date, end: dt.date, language: str) -> list[Holiday]:
    rules = holiday_rules.Germany(
        subdiv=region,
        years=range(start.year, end.year + 1),
        language=_RULE_LANGUAGES.get(language, "de"),
    )
    return [
        Holiday("public", name, day, day + dt.timedelta(days=1))
        for day, name in sorted(rules.items())
        if start <= day < end
    ]


def school_holidays(
    db: Session, region: str, start: dt.date, end: dt.date, language: str
) -> list[Holiday]:
    rows = db.scalars(
        select(SchoolHoliday)
        .where(
            SchoolHoliday.region == region,
            SchoolHoliday.start_date < end,
            SchoolHoliday.end_date > start,
        )
        .order_by(SchoolHoliday.start_date)
    )
    return [
        Holiday(
            "school",
            row.name_en if language == "en" else row.name_de,
            row.start_date,
            row.end_date,
        )
        for row in rows
    ]


def holidays_between(
    db: Session, family: Family, start: dt.date, end: dt.date, language: str
) -> list[Holiday]:
    """Was die Familie im Kalender sehen möchte."""
    region = family.holiday_region
    if region not in REGIONS:
        return []
    found = []
    if family.show_public_holidays:
        found += public_holidays(region, start, end, language)
    if family.show_school_holidays:
        found += school_holidays(db, region, start, end, language)
    return found


def _name(item: dict, language: str) -> str | None:
    for entry in item.get("name") or []:
        if str(entry.get("language", "")).lower() == language and entry.get("text"):
            return str(entry["text"])[:200]
    return None


def refresh_school_holidays(db: Session, family: Family, now: dt.datetime) -> None:
    """Lädt die Schulferien des Bundeslands neu, wenn sie gebraucht werden und veraltet sind.

    Fehler sind nicht schlimm: Die bisherigen Ferien bleiben, der nächste Durchlauf versucht es
    wieder.
    """
    region = family.holiday_region
    if region not in REGIONS or not family.show_school_holidays:
        return
    last = db.scalar(
        select(func.max(SchoolHoliday.fetched_at)).where(SchoolHoliday.region == region)
    )
    if last is not None and now - last < REFRESH_AFTER:
        return

    year = now.date().year
    params = {
        "countryIsoCode": "DE",
        "subdivisionCode": f"DE-{region}",
        "validFrom": f"{year - 1}-01-01",
        "validTo": f"{year + 1}-12-31",
    }
    try:
        with httpx.Client(timeout=15, transport=transport) as client:
            response = client.get(SCHOOL_HOLIDAYS_URL, params=params)
            response.raise_for_status()
            items = response.json()
        rows = []
        for item in items:
            name_de = _name(item, "de") or _name(item, "en")
            if not name_de:
                continue
            rows.append(
                SchoolHoliday(
                    region=region,
                    start_date=dt.date.fromisoformat(item["startDate"]),
                    # OpenHolidays nennt den letzten Ferientag, gespeichert wird exklusiv.
                    end_date=dt.date.fromisoformat(item["endDate"]) + dt.timedelta(days=1),
                    name_de=name_de,
                    name_en=_name(item, "en") or name_de,
                    fetched_at=now,
                )
            )
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        logger.warning("Schulferien nicht geladen: %s", type(exc).__name__)
        return

    db.execute(delete(SchoolHoliday).where(SchoolHoliday.region == region))
    db.add_all(rows)
    db.commit()
    logger.info("Schulferien für %s geladen: %s Einträge", region, len(rows))
