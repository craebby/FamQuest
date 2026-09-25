"""Wochenansicht im Aufgabenbereich: je Tag und Person, was ansteht und was erledigt wurde.

Grundlage sind die heutigen Aufgaben-Definitionen (ab ihrem Anlegedatum) und die tatsächlichen
Erledigungen. Vergangene Tage zeigen, was geplant war und was davon erledigt ist; kommende Tage,
was ansteht. Flexible Aufgaben stehen an ihrem Fälligkeitstag (heute auch überfällig) und danach
im Abstand ihres Intervalls; an vergangenen Tagen nur, wenn sie erledigt wurden.
"""

import datetime as dt
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.calendar_week import MAX_WEEK_OFFSET
from app.api.tasks import positions_out
from app.api.today import due_dates, is_due
from app.auth import CurrentSession, DbSession, get_family
from app.models import Task, TaskCompletion
from app.schemas import MemberPositionOut
from app.today import family_now

router = APIRouter(tags=["tasks"])


class WeekTaskOut(BaseModel):
    id: int
    title: str
    icon: str
    points: int
    time_of_day: str | None
    color: str | None
    extra: bool
    positions: list[MemberPositionOut]


class WeekEntryOut(BaseModel):
    task_id: int
    member_id: int
    # pending: erledigt, wartet auf Kontrolle; open: (noch) nicht erledigt.
    status: Literal["done", "pending", "open"]
    # Bei „Einer für alle“: wer es erledigt hat (auch eine andere Person).
    done_by: int | None


class WeekTasksDayOut(BaseModel):
    date: dt.date
    entries: list[WeekEntryOut]


class TaskWeekOut(BaseModel):
    start: dt.date
    today: dt.date
    # Alle Aufgaben, auf die sich die Einträge beziehen.
    tasks: list[WeekTaskOut]
    days: list[WeekTasksDayOut]


def _flexible_on(task: Task, due: dt.date | None, day: dt.date, today: dt.date) -> bool:
    """Steht eine flexible Aufgabe an `day` an (heute oder später)?

    Heute, wenn sie fällig oder überfällig ist. Danach am nächsten Fälligkeitstag und von dort im
    Abstand des Intervalls; ist sie heute fällig, rechnet die Vorschau ab heute.
    """
    if due is None or day < today:
        return False
    if day == today:
        return due <= today
    interval = task.recurrence.interval_days or 0
    first = due if due > today else today + dt.timedelta(days=interval)
    if interval == 0:
        return day == first
    return day >= first and (day - first).days % interval == 0


@router.get("/tasks/week")
def task_week(
    _: CurrentSession,
    db: DbSession,
    offset: Annotated[int, Query(ge=-MAX_WEEK_OFFSET, le=MAX_WEEK_OFFSET)] = 0,
) -> TaskWeekOut:
    family = get_family(db)
    zone = ZoneInfo(family.timezone)
    today = family_now(family).date()
    start = today - dt.timedelta(days=today.weekday()) + dt.timedelta(weeks=offset)
    days = [start + dt.timedelta(days=index) for index in range(7)]

    active = [task for task in db.scalars(select(Task).where(Task.active)) if task.assignments]
    completions = db.execute(
        select(
            TaskCompletion.task_id,
            TaskCompletion.member_id,
            TaskCompletion.date,
            TaskCompletion.approved_at,
        ).where(TaskCompletion.date >= days[0], TaskCompletion.date <= days[-1])
    ).all()
    # (Aufgabe, Tag) → {Person: geprüft?}
    done: dict[tuple[int, dt.date], dict[int, bool]] = {}
    for task_id, member_id, date, approved_at in completions:
        done.setdefault((task_id, date), {})[member_id] = approved_at is not None
    dues = {
        task_id: {entry.member_id: entry.due_date for entry in entries}
        for task_id, entries in due_dates(db, active, today).items()
    }
    # Erledigungen inaktiver oder inzwischen anders geplanter Aufgaben zählen mit.
    known = {task.id: task for task in active}
    for task_id, *_ in completions:
        if task_id not in known:
            task = db.get(Task, task_id)
            if task is not None:
                known[task_id] = task

    out_days = []
    for day in days:
        entries = []
        for task in known.values():
            who = done.get((task.id, day), {})
            for member_id in sorted(a.member_id for a in task.assignments):
                if member_id in who:
                    by = member_id
                elif task.shared and who:
                    by = next(iter(who))
                else:
                    by = None
                planned = by is not None
                if not planned and task.active:
                    if task.recurrence.kind == "flexible":
                        due = dues.get(task.id, {}).get(member_id)
                        planned = _flexible_on(task, due, day, today)
                    else:
                        created = task.created_at.astimezone(zone).date()
                        planned = day >= created and is_due(task, day)
                if not planned:
                    continue
                status = "open" if by is None else ("done" if who[by] else "pending")
                entries.append(
                    WeekEntryOut(task_id=task.id, member_id=member_id, status=status, done_by=by)
                )
        out_days.append(WeekTasksDayOut(date=day, entries=entries))

    used = {entry.task_id for day in out_days for entry in day.entries}
    return TaskWeekOut(
        start=start,
        today=today,
        tasks=[
            WeekTaskOut(
                id=task.id,
                title=task.title,
                icon=task.icon,
                points=task.points,
                time_of_day=task.time_of_day,
                color=task.color,
                extra=task.extra,
                positions=positions_out(task),
            )
            for task in sorted(known.values(), key=lambda task: task.id)
            if task.id in used
        ],
        days=out_days,
    )
