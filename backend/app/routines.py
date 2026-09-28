"""Routinen: Wann steht eine Aufgabe für eine bestimmte Person an, und an welchem Platz?

Ist eine Aufgabe für eine Person Schritt einer Routine, entscheidet allein die Routine: Die Aufgabe
steht an den Wochentagen der Routine an, an deren Platz und ggf. optional. Für alle anderen
zugeordneten Personen gilt die Wiederholung der Aufgabe wie bisher.
"""

import datetime as dt
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Routine, Task
from app.recurrence import occurs_on

# Aufgaben ohne Routine stehen innerhalb eines Tagesabschnitts hinter den Routinenschritten.
AFTER_ROUTINE = 1000


@dataclass(frozen=True)
class Slot:
    """Platz einer Aufgabe für eine Person an einem Tag."""

    position: int
    optional: bool = False


class RoutinePlan:
    """Alle Routinen der Familie, einmal geladen, für Abfragen je Aufgabe, Person und Tag."""

    def __init__(self, db: Session) -> None:
        self._steps: dict[tuple[int, int], dict[int, Slot]] = {}
        for routine in db.scalars(select(Routine)):
            for step in routine.steps:
                days = self._steps.setdefault((step.task_id, routine.member_id), {})
                for weekday in routine.weekdays:
                    days[weekday] = Slot(step.position, step.optional)

    def in_routine(self, task_id: int, member_id: int) -> bool:
        return (task_id, member_id) in self._steps

    def slot(self, task: Task, member_id: int, day: dt.date) -> Slot | None:
        """Platz der Aufgabe für diese Person an diesem Tag; None = steht nicht an."""
        if not task.active or not any(a.member_id == member_id for a in task.assignments):
            return None
        days = self._steps.get((task.id, member_id))
        if days is not None:
            return days.get(day.isoweekday())
        if not occurs_on(task.recurrence, day):
            return None
        position = next(a.position for a in task.assignments if a.member_id == member_id)
        return Slot(AFTER_ROUTINE + position)

    def due_members(self, task: Task, day: dt.date) -> dict[int, Slot]:
        """Personen, für die die Aufgabe an diesem Tag ansteht, mit ihrem Platz."""
        slots = {a.member_id: self.slot(task, a.member_id, day) for a in task.assignments}
        return {member_id: slot for member_id, slot in sorted(slots.items()) if slot is not None}
