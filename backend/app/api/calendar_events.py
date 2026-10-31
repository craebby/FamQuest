"""Termine anlegen, ändern und löschen, nur hinter der Eltern-PIN.

Die Änderung geht zuerst an Google und landet dann gleich in der eigenen Tabelle, damit sie
sofort sichtbar ist; die nächste Synchronisation gleicht alles Übrige ab. Steht ein Termin in
mehreren Kalendern (z. B. Einladung an beide Eltern), wird er überall geändert, wo FamQuest
schreiben darf. Bei Serien gilt alles nur für das eine Vorkommen. Unterscheidet ein Kalender die
Personen über Farben, wird die gewählte Person als Farbe zurückgeschrieben.
"""

import datetime as dt
from collections.abc import Callable
from typing import Annotated, Self
from zoneinfo import ZoneInfo

from fastapi import APIRouter, status
from pydantic import BaseModel, StringConstraints, model_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app import google
from app.api.calendar_week import writable_calendars
from app.auth import DbSession, ParentSession, get_family, utcnow
from app.calendar_colors import ColorRules
from app.calendar_sync import DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, parse_event
from app.demo_mode import NotInDemo
from app.errors import ApiError
from app.logs import logger
from app.models import Calendar, CalendarConnection, CalendarEvent

router = APIRouter(prefix="/calendar", tags=["calendar"])


class EventIn(BaseModel):
    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TITLE_MAX_LENGTH)
    ]
    location: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=TITLE_MAX_LENGTH)] | None
    ) = None
    description: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=DESCRIPTION_MAX_LENGTH)]
        | None
    ) = None
    all_day: bool
    start_date: dt.date
    # Letzter Tag des Termins, also inklusiv (anders als bei Google).
    end_date: dt.date
    # Uhrzeiten in der Zeitzone der Familie; bei ganztägigen Terminen ohne Bedeutung.
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    # Wem der Termin gehört (None = Familie), siehe app.calendar_colors. Fehlt das Feld, bleibt
    # die Farbe, wie sie ist.
    member_id: int | None = None

    @model_validator(mode="after")
    def check_times(self) -> Self:
        if self.all_day:
            valid = self.end_date >= self.start_date
        else:
            valid = (
                self.start_time is not None
                and self.end_time is not None
                and (self.end_date, self.end_time) >= (self.start_date, self.start_time)
            )
        if not valid:
            raise PydanticCustomError("validation.invalid_event_times", "invalid event times")
        return self

    def google_times(self, tz: ZoneInfo) -> dict[str, dict]:
        """Beginn und Ende im Format von Google."""
        if self.all_day:
            end = self.end_date + dt.timedelta(days=1)
            return {
                "start": {"date": self.start_date.isoformat()},
                "end": {"date": end.isoformat()},
            }

        def moment(day: dt.date, time: dt.time | None) -> dict:
            value = dt.datetime.combine(day, time, tzinfo=tz)
            return {"dateTime": value.isoformat(), "timeZone": tz.key}

        return {
            "start": moment(self.start_date, self.start_time),
            "end": moment(self.end_date, self.end_time),
        }

    def same_times_as(self, event: CalendarEvent, tz: ZoneInfo) -> bool:
        if self.all_day != event.all_day:
            return False
        if self.all_day:
            return (event.start_date, event.end_date) == (
                self.start_date,
                self.end_date + dt.timedelta(days=1),
            )
        return (event.start_at, event.end_at) == (
            dt.datetime.combine(self.start_date, self.start_time, tzinfo=tz),
            dt.datetime.combine(self.end_date, self.end_time, tzinfo=tz),
        )


class EventCreate(EventIn):
    calendar_id: int


def _changes(event: CalendarEvent, body: EventIn, tz: ZoneInfo) -> dict:
    """Nur was sich geändert hat: Beschreibungen speichert FamQuest gekürzt und ohne HTML, ein
    unveränderter Text darf das Original bei Google nicht überschreiben."""
    changes: dict = {}
    if body.title != event.title:
        changes["summary"] = body.title
    if (body.location or None) != event.location:
        changes["location"] = body.location or None
    if (body.description or None) != event.description:
        changes["description"] = body.description or None
    if not body.same_times_as(event, tz):
        # PATCH führt verschachtelte Felder zusammen, die alte Zeitart muss also weg.
        empty = {"date": None, "dateTime": None, "timeZone": None}
        for key, value in body.google_times(tz).items():
            changes[key] = {**empty, **value}
    return changes


def _copies(db: DbSession, event_id: int) -> tuple[list[CalendarEvent], list[CalendarEvent]]:
    """Alle angezeigten Kopien eines Termins und davon die, in die FamQuest schreiben darf."""
    event = db.get(CalendarEvent, event_id)
    if event is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "calendar.event_not_found")
    copies = [event]
    if event.ical_uid:
        copies = db.scalars(
            select(CalendarEvent)
            .join(Calendar)
            .where(
                Calendar.selected,
                CalendarEvent.ical_uid == event.ical_uid,
                CalendarEvent.all_day == event.all_day,
                CalendarEvent.start_date.is_not_distinct_from(event.start_date),
                CalendarEvent.end_date.is_not_distinct_from(event.end_date),
                CalendarEvent.start_at.is_not_distinct_from(event.start_at),
                CalendarEvent.end_at.is_not_distinct_from(event.end_at),
            )
            .order_by(CalendarEvent.id)
        ).all()
    writable = set(db.scalars(writable_calendars().with_only_columns(Calendar.id)))
    allowed = [copy for copy in copies if copy.calendar_id in writable]
    if not allowed:
        raise ApiError(status.HTTP_403_FORBIDDEN, "calendar.event_read_only")
    return list(copies), allowed


def _token(db: DbSession, calendar: Calendar) -> str:
    return google.access_token(db, db.get(CalendarConnection, calendar.connection_id), utcnow())


def _at_google(
    db: DbSession,
    copies: list[CalendarEvent],
    action: Callable[[str, Calendar, CalendarEvent], dict | None],
) -> list[tuple[CalendarEvent, dict | None]]:
    """Führt die Änderung je Kopie aus. Sie gilt als gescheitert, wenn keine Kopie klappt: Bei
    Einladungen darf nur die einladende Person ändern, und die Änderung erreicht alle Gäste."""
    done = []
    failure = None
    for copy in copies:
        calendar = db.get(Calendar, copy.calendar_id)
        try:
            result = action(_token(db, calendar), calendar, copy)
        except google.GoogleError as exc:
            failure = failure or exc
        else:
            done.append((copy, result))
    if not done:
        raise ApiError(status.HTTP_502_BAD_GATEWAY, failure.code)
    return done


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT, dependencies=[NotInDemo])
def create_event(body: EventCreate, _: ParentSession, db: DbSession) -> None:
    calendar = db.scalars(writable_calendars().where(Calendar.id == body.calendar_id)).first()
    if calendar is None:
        raise ApiError(status.HTTP_403_FORBIDDEN, "calendar.event_read_only")

    request = {
        "summary": body.title,
        **body.google_times(ZoneInfo(get_family(db).timezone)),
    }
    if "member_id" in body.model_fields_set:
        request.update(ColorRules(db).color_change(calendar, None, body.member_id))
    if body.location:
        request["location"] = body.location
    if body.description:
        request["description"] = body.description
    try:
        created = google.create_event(_token(db, calendar), calendar.external_id, request)
    except google.GoogleError as exc:
        raise ApiError(status.HTTP_502_BAD_GATEWAY, exc.code) from exc

    fields = parse_event(created)
    if fields:
        # Die Synchronisation kann den neuen Termin schon geladen haben.
        db.execute(
            insert(CalendarEvent).values(calendar_id=calendar.id, **fields).on_conflict_do_nothing()
        )
    db.commit()
    logger.info("Termin in Kalender %s angelegt", calendar.id)


@router.put("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[NotInDemo])
def update_event(event_id: int, body: EventIn, _: ParentSession, db: DbSession) -> None:
    copies, allowed = _copies(db, event_id)
    shared = _changes(db.get(CalendarEvent, event_id), body, ZoneInfo(get_family(db).timezone))
    rules = ColorRules(db)
    # Die Farbe gilt je Kalender, die übrigen Änderungen für alle Kopien.
    changes = {copy.id: dict(shared) for copy in allowed}
    if "member_id" in body.model_fields_set:
        for copy in allowed:
            calendar = db.get(Calendar, copy.calendar_id)
            changes[copy.id].update(rules.color_change(calendar, copy.color_id, body.member_id))
    pending = [copy for copy in allowed if changes[copy.id]]
    if not pending:
        return
    done = _at_google(
        db,
        pending,
        lambda token, calendar, copy: google.update_event(
            token, calendar.external_id, copy.external_id, changes[copy.id]
        ),
    )

    fields = parse_event(done[0][1] or {})
    if fields:
        # Auch Kopien, in die FamQuest nicht schreibt: Sonst stünde der Termin bis zur nächsten
        # Synchronisation doppelt da. Die Kennungen und Farben bleiben je Kalender verschieden.
        del fields["external_id"], fields["ical_uid"], fields["color_id"]
        for copy in copies:
            copy.start_date = copy.end_date = copy.start_at = copy.end_at = None
            for name, value in fields.items():
                setattr(copy, name, value)
    for copy, result in done:
        copy.color_id = (result or {}).get("colorId")
    db.commit()
    logger.info("Termin %s geändert", event_id)


@router.delete(
    "/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[NotInDemo]
)
def delete_event(event_id: int, _: ParentSession, db: DbSession) -> None:
    allowed = _copies(db, event_id)[1]
    done = _at_google(
        db,
        allowed,
        lambda token, calendar, copy: google.delete_event(
            token, calendar.external_id, copy.external_id
        ),
    )
    for copy, _result in done:
        db.delete(copy)
    db.commit()
    logger.info("Termin %s gelöscht", event_id)
