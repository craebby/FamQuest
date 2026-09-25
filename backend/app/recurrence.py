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
    return False
