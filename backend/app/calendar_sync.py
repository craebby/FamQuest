"""Synchronisation der ausgewählten Google-Kalender in die Datenbank.

Gespeichert werden die Termine eines festen Zeitraums um die aktuelle Woche, Serientermine als
einzelne Vorkommen. Damit nicht bei jedem Durchlauf alles neu geladen wird, fragt die
Synchronisation Google zuerst per Sync-Token, ob sich im Kalender überhaupt etwas geändert hat.
Nur dann (oder wenn der Zeitraum weiterrückt bzw. zur Sicherheit alle paar Stunden) wird der
Zeitraum neu geladen und ersetzt.

Fehler landen als Code am Kalender (`sync_error`); die zuletzt geladenen Termine bleiben sichtbar.
"""

import asyncio
import datetime as dt
import html
import re
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import google
from app.auth import utcnow
from app.config import get_settings
from app.db import SessionLocal, engine
from app.holidays import refresh_school_holidays
from app.logs import logger
from app.models import Calendar, CalendarConnection, CalendarEvent, Family

# Geladener Zeitraum: ab vier Wochen vor der aktuellen Woche, insgesamt ein halbes Jahr.
WINDOW_WEEKS_BEFORE = 4
WINDOW_DAYS = 26 * 7
# Spätestens nach dieser Zeit wird der Zeitraum auch ohne gemeldete Änderung neu geladen.
FULL_RELOAD_AFTER = dt.timedelta(hours=6)
# Schützt vor gleichzeitigen Durchläufen (Hintergrund und „Jetzt aktualisieren“).
_LOCK_KEY = 0x46514341  # "FQCA"
TITLE_MAX_LENGTH = 500
DESCRIPTION_MAX_LENGTH = 4000
_LINE_BREAK_TAGS = re.compile(r"<\s*(br|/p|/div|/li|/h\d)\s*/?>", re.IGNORECASE)
_TAGS = re.compile(r"<[^>]+>")
_BLANK_LINES = re.compile(r"\n{3,}")


def plain_text(value: str | None, max_length: int) -> str | None:
    """Beschreibungen aus Google können HTML enthalten; angezeigt wird nur der Text."""
    if not value:
        return None
    text = _TAGS.sub("", _LINE_BREAK_TAGS.sub("\n", value))
    text = _BLANK_LINES.sub("\n\n", html.unescape(text).replace("\r\n", "\n")).strip()
    return text[:max_length] or None


def window_for(today: dt.date) -> tuple[dt.date, dt.date]:
    """Zeitraum (Start inklusiv, Ende exklusiv); rückt jeden Montag eine Woche weiter."""
    monday = today - dt.timedelta(days=today.weekday())
    start = monday - dt.timedelta(weeks=WINDOW_WEEKS_BEFORE)
    return start, start + dt.timedelta(days=WINDOW_DAYS)


def local_midnight(day: dt.date, tz: ZoneInfo) -> dt.datetime:
    return dt.datetime.combine(day, dt.time(), tzinfo=tz)


def parse_event(item: dict) -> dict | None:
    """Termin aus der Google-API → Spalten von CalendarEvent; None bei abgesagten Terminen."""
    if item.get("status") == "cancelled" or not item.get("id"):
        return None
    start, end = item.get("start") or {}, item.get("end") or {}
    fields: dict = {
        "external_id": item["id"],
        "ical_uid": item.get("iCalUID"),
        "title": (item.get("summary") or "").strip()[:TITLE_MAX_LENGTH] or None,
        "location": (item.get("location") or "").strip()[:TITLE_MAX_LENGTH] or None,
        "description": plain_text(item.get("description"), DESCRIPTION_MAX_LENGTH),
    }
    try:
        if "date" in start:
            start_date = dt.date.fromisoformat(start["date"])
            end_date = dt.date.fromisoformat(end["date"]) if "date" in end else start_date
            # Das Ende ist exklusiv; mindestens ein Tag.
            end_date = max(end_date, start_date + dt.timedelta(days=1))
            return {**fields, "all_day": True, "start_date": start_date, "end_date": end_date}
        if "dateTime" in start:
            start_at = dt.datetime.fromisoformat(start["dateTime"])
            end_at = dt.datetime.fromisoformat(end["dateTime"]) if "dateTime" in end else start_at
            if start_at.tzinfo is None or end_at.tzinfo is None:
                return None
            end_at = max(end_at, start_at)
            return {**fields, "all_day": False, "start_at": start_at, "end_at": end_at}
    except ValueError:
        logger.warning("Termin mit unlesbarer Zeitangabe übersprungen")
    return None


def refresh_calendar_list(db: Session, connection: CalendarConnection, token: str) -> None:
    """Gleicht die gespeicherten Kalender mit der Kalenderliste des Kontos ab."""
    found = {info.id: info for info in google.list_calendars(token)}
    known = {
        calendar.external_id: calendar
        for calendar in db.scalars(select(Calendar).where(Calendar.connection_id == connection.id))
    }
    for external_id, calendar in known.items():
        info = found.get(external_id)
        if info is None:
            # Nicht mehr in der Liste (gelöscht, Freigabe entzogen, abbestellt).
            db.delete(calendar)
        else:
            calendar.name, calendar.primary = info.name, info.primary
    for external_id, info in found.items():
        if external_id not in known:
            db.add(
                Calendar(
                    connection_id=connection.id,
                    external_id=external_id,
                    name=info.name,
                    primary=info.primary,
                )
            )
    db.commit()


def clear_events(db: Session, calendar: Calendar) -> None:
    """Termine und Synchronisationsstand eines abgewählten Kalenders verwerfen."""
    db.execute(delete(CalendarEvent).where(CalendarEvent.calendar_id == calendar.id))
    calendar.sync_token = None
    calendar.window_start = None
    calendar.window_loaded_at = None
    calendar.synced_at = None
    calendar.sync_error = None


def unselect_member_calendars(db: Session, member_id: int) -> None:
    """Die Person wird gelöscht: ihre Kalender nicht stillschweigend der Familie zuordnen."""
    for calendar in db.scalars(select(Calendar).where(Calendar.member_id == member_id)).all():
        calendar.selected = False
        calendar.member_id = None
        clear_events(db, calendar)


def sync_calendar(
    db: Session,
    calendar: Calendar,
    token: str,
    window: tuple[dt.date, dt.date],
    tz: ZoneInfo,
    now: dt.datetime,
) -> None:
    external_id = calendar.external_id
    sync_token = calendar.sync_token
    reload = (
        sync_token is None
        or calendar.window_start != window[0]
        or calendar.window_loaded_at is None
        or now - calendar.window_loaded_at >= FULL_RELOAD_AFTER
    )
    if not reload:
        try:
            reload, sync_token = google.changes_since(token, external_id, sync_token)
        except google.SyncTokenExpired:
            logger.info("Sync-Token für Kalender %s abgelaufen, lade neu", calendar.id)
            sync_token, reload = None, True

    if reload:
        # Erst den Stand merken, dann laden: Änderungen dazwischen fallen beim nächsten Mal auf.
        if sync_token is None:
            sync_token = google.initial_sync_token(token, external_id)
        items = google.events_between(
            token, external_id, local_midnight(window[0], tz), local_midnight(window[1], tz)
        )
        events = {event["external_id"]: event for event in filter(None, map(parse_event, items))}
        db.execute(delete(CalendarEvent).where(CalendarEvent.calendar_id == calendar.id))
        db.add_all(CalendarEvent(calendar_id=calendar.id, **event) for event in events.values())
        calendar.window_start = window[0]
        calendar.window_loaded_at = now
        logger.info("Kalender %s neu geladen: %s Termine", calendar.id, len(events))

    calendar.sync_token = sync_token
    calendar.synced_at = now
    calendar.sync_error = None
    db.commit()


def _sync_connection(
    db: Session,
    connection: CalendarConnection,
    window: tuple[dt.date, dt.date],
    tz: ZoneInfo,
    now: dt.datetime,
) -> None:
    selected = select(Calendar).where(
        Calendar.connection_id == connection.id, Calendar.selected.is_(True)
    )
    try:
        token = google.access_token(db, connection, now)
        refresh_calendar_list(db, connection, token)
    except google.GoogleError as exc:
        db.rollback()
        for calendar in db.scalars(selected):
            calendar.sync_error = exc.code
        db.commit()
        return

    for calendar in db.scalars(selected).all():
        try:
            sync_calendar(db, calendar, token, window, tz, now)
        except google.GoogleError as exc:
            db.rollback()
            calendar.sync_error = exc.code
            db.commit()


def sync_all(now: dt.datetime | None = None) -> bool:
    """Ein Durchlauf: Schulferien und alle Google-Verbindungen. False, wenn schon einer läuft."""
    now = now or utcnow()
    # Eigene Verbindung ohne offene Transaktion, die die Sperre bis zum Ende hält.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as lock:
        if not lock.scalar(select(func.pg_try_advisory_lock(_LOCK_KEY))):
            return False
        try:
            with SessionLocal() as db:
                family = db.scalars(select(Family)).one_or_none()
                if family is None:
                    return True
                refresh_school_holidays(db, family, now)
                if not get_settings().calendar_configured:
                    return True
                tz = ZoneInfo(family.timezone)
                window = window_for(now.astimezone(tz).date())
                connections = db.scalars(
                    select(CalendarConnection)
                    .where(CalendarConnection.status == "ok")
                    .order_by(CalendarConnection.id)
                ).all()
                for connection in connections:
                    _sync_connection(db, connection, window, tz, now)
        finally:
            lock.scalar(select(func.pg_advisory_unlock(_LOCK_KEY)))
    return True


async def run_periodically(interval: dt.timedelta) -> None:
    """Hintergrundschleife im App-Prozess; Fehler beenden sie nicht."""
    while True:
        try:
            await asyncio.to_thread(sync_all)
        except Exception:
            logger.exception("Kalender-Synchronisation fehlgeschlagen")
        await asyncio.sleep(interval.total_seconds())
