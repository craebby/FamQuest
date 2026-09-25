"""„Heute“ und der aktuelle Tagesabschnitt, immer in der Zeitzone der Familie."""

import datetime as dt
from zoneinfo import ZoneInfo

from app.models import Family

# Beginn der Tagesabschnitte (Ortszeit der Familie); vor 11 Uhr ist Morgen.
TIME_OF_DAY_STARTS = (
    (dt.time(18), "evening"),
    (dt.time(14), "afternoon"),
    (dt.time(11), "midday"),
)


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def family_now(family: Family) -> dt.datetime:
    return utcnow().astimezone(ZoneInfo(family.timezone))


def time_of_day_at(local: dt.time) -> str:
    for start, name in TIME_OF_DAY_STARTS:
        if local >= start:
            return name
    return "morning"
