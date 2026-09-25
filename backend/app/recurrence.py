"""Wiederholungsregeln: An welchen Tagen steht eine Aufgabe an?"""

import datetime as dt

from app.models import TaskRecurrence


def occurs_on(recurrence: TaskRecurrence, day: dt.date) -> bool:
    """`day` ist ein Kalendertag in der Zeitzone der Familie, nicht in UTC."""
    match recurrence.kind:
        case "daily":
            return True
        case "weekly":
            return day.isoweekday() in (recurrence.weekdays or ())
        case "once":
            return recurrence.date == day
        case "flexible":
            # Ohne festen Tag: jederzeit erledigbar; wann sie fällig ist, sagt flexible_due().
            return True
    return False


def flexible_due(recurrence: TaskRecurrence, last_done: dt.date | None) -> dt.date:
    """Fälligkeit einer flexiblen Aufgabe: Startdatum, danach Intervall ab letzter Erledigung."""
    if last_done is None or recurrence.interval_days is None:
        return recurrence.date or dt.date.min
    return last_done + dt.timedelta(days=recurrence.interval_days)
