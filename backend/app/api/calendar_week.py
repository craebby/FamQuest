"""Termine einer Woche für die Kalenderansicht am Display (Montag bis Sonntag).

Die Tage werden in der Zeitzone der Familie gebildet. Steht derselbe Termin in mehreren
Kalendern (z. B. eine Einladung an beide Eltern), erscheint er einmal mit allen Personen.
"""

import datetime as dt
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import and_, or_, select

from app.auth import CurrentSession, DbSession, get_family
from app.calendar_sync import local_midnight
from app.holidays import holidays_between
from app.models import Calendar, CalendarConnection, CalendarEvent, FamilyMember
from app.today import family_now

router = APIRouter(prefix="/calendar", tags=["calendar"])

# So weit lässt sich vor- und zurückblättern (die Synchronisation lädt ohnehin weniger).
MAX_WEEK_OFFSET = 52


class WeekEventOut(BaseModel):
    # Stabiler Schlüssel für das Frontend (mehrere Kalender können einen Termin teilen).
    key: str
    title: str | None
    location: str | None
    description: str | None
    # Namen der Kalender, aus denen der Termin stammt.
    calendars: list[str]
    all_day: bool
    # Ganztägig: Datum (Ende exklusiv); sonst Zeitpunkt mit Zeitzone.
    start: dt.date | dt.datetime
    end: dt.date | dt.datetime
    member_ids: list[int]
    # Gehört (auch) der ganzen Familie.
    family: bool
    # Begann vor diesem Tag bzw. geht über ihn hinaus.
    continues_before: bool
    continues_after: bool


class HolidayOut(BaseModel):
    kind: Literal["public", "school"]
    name: str


class WeekDayOut(BaseModel):
    date: dt.date
    # Feiertage und Schulferien an diesem Tag (falls im Elternbereich eingeschaltet).
    holidays: list[HolidayOut]
    events: list[WeekEventOut]


class WeekOut(BaseModel):
    start: dt.date
    today: dt.date
    timezone: str
    family_color: str
    # Mindestens ein angezeigter Kalender wird gerade nicht aktualisiert.
    problem: bool
    days: list[WeekDayOut]


class _Merged:
    """Ein Termin, ggf. aus mehreren Kalendern zusammengeführt."""

    def __init__(self, event: CalendarEvent) -> None:
        self.event = event
        self.member_ids: set[int] = set()
        self.family = False
        self.calendars: list[str] = []


@router.get("/week")
def week(
    _: CurrentSession,
    db: DbSession,
    offset: Annotated[int, Query(ge=-MAX_WEEK_OFFSET, le=MAX_WEEK_OFFSET)] = 0,
    # Sprache des Geräts für die Namen der Feiertage; Standard ist die der Familie.
    lang: Annotated[str | None, Query(pattern=r"^[a-z]{2}$")] = None,
) -> WeekOut:
    family = get_family(db)
    tz = ZoneInfo(family.timezone)
    today = family_now(family).date()
    start = today - dt.timedelta(days=today.weekday()) + dt.timedelta(weeks=offset)
    end = start + dt.timedelta(days=7)
    range_start, range_end = local_midnight(start, tz), local_midnight(end, tz)

    rows = db.execute(
        select(CalendarEvent, Calendar.member_id, Calendar.name)
        .join(Calendar, CalendarEvent.calendar_id == Calendar.id)
        .where(
            Calendar.selected,
            or_(
                and_(
                    CalendarEvent.all_day,
                    CalendarEvent.start_date < end,
                    CalendarEvent.end_date > start,
                ),
                and_(
                    ~CalendarEvent.all_day,
                    CalendarEvent.start_at < range_end,
                    # Termine ohne Dauer zählen zu dem Tag, an dem sie beginnen.
                    or_(CalendarEvent.end_at > range_start, CalendarEvent.start_at >= range_start),
                ),
            ),
        )
        .order_by(CalendarEvent.id)
    ).all()

    merged: dict[tuple, _Merged] = {}
    for event, member_id, calendar_name in rows:
        times = (
            (event.start_date, event.end_date) if event.all_day else (event.start_at, event.end_at)
        )
        key = (event.ical_uid or f"event:{event.id}", event.all_day, *times)
        entry = merged.setdefault(key, _Merged(event))
        if member_id is None:
            entry.family = True
        else:
            entry.member_ids.add(member_id)
        if calendar_name not in entry.calendars:
            entry.calendars.append(calendar_name)
        # Aus mehreren Kalendern die ausführlichste Fassung zeigen.
        if (entry.event.title is None and event.title) or (
            entry.event.description is None and event.description
        ):
            entry.event = event

    positions = {
        member_id: index
        for index, member_id in enumerate(
            db.scalars(select(FamilyMember.id).order_by(FamilyMember.position, FamilyMember.id))
        )
    }
    holidays = holidays_between(db, family, start, end, lang or family.default_language)
    days = []
    for index in range(7):
        day = start + dt.timedelta(days=index)
        day_start, day_end = local_midnight(day, tz), local_midnight(day + dt.timedelta(days=1), tz)
        events = []
        for entry in merged.values():
            out = _event_on_day(entry, day, day_start, day_end, positions)
            if out is not None:
                events.append(out)
        # Ganztägige zuerst, dann nach Beginn.
        events.sort(
            key=lambda e: (
                not (e.all_day or (e.continues_before and e.continues_after)),
                e.start if isinstance(e.start, dt.datetime) else day_start,
                (e.title or "").lower(),
            )
        )
        days.append(
            WeekDayOut(
                date=day,
                holidays=[
                    HolidayOut(kind=h.kind, name=h.name) for h in holidays if h.start <= day < h.end
                ],
                events=events,
            )
        )

    return WeekOut(
        start=start,
        today=today,
        timezone=family.timezone,
        family_color=family.calendar_color,
        problem=_has_problem(db),
        days=days,
    )


def _event_on_day(
    entry: _Merged,
    day: dt.date,
    day_start: dt.datetime,
    day_end: dt.datetime,
    positions: dict[int, int],
) -> WeekEventOut | None:
    event = entry.event
    if event.all_day:
        if not (event.start_date <= day < event.end_date):
            return None
        start, end = event.start_date, event.end_date
        before = event.start_date < day
        after = event.end_date > day + dt.timedelta(days=1)
    else:
        overlaps = event.start_at < day_end and (
            event.end_at > day_start or event.start_at >= day_start
        )
        if not overlaps:
            return None
        start, end = event.start_at, event.end_at
        before = event.start_at < day_start
        after = event.end_at > day_end
    return WeekEventOut(
        key=f"{event.id}",
        title=event.title,
        location=event.location,
        description=event.description,
        calendars=entry.calendars,
        all_day=event.all_day,
        start=start,
        end=end,
        member_ids=sorted(entry.member_ids, key=lambda m: positions.get(m, len(positions))),
        family=entry.family,
        continues_before=before,
        continues_after=after,
    )


def _has_problem(db: DbSession) -> bool:
    return bool(
        db.scalar(
            select(Calendar.id)
            .join(CalendarConnection)
            .where(
                Calendar.selected,
                or_(Calendar.sync_error.is_not(None), CalendarConnection.status != "ok"),
            )
            .limit(1)
        )
    )
