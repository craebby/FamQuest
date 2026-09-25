import datetime as dt
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.today import due_dates, is_due
from app.auth import DbSession, ParentSession, get_family
from app.models import FamilyMember, Task, TaskCompletion
from app.schemas import WeekDayOut, WeekMemberOut, WeekOut
from app.today import family_now

router = APIRouter(tags=["week"])


def monday_of(day: dt.date) -> dt.date:
    return day - dt.timedelta(days=day.weekday())


@router.get("/week")
def get_week(
    _: ParentSession, db: DbSession, start: Annotated[dt.date | None, Query()] = None
) -> WeekOut:
    """Wochenübersicht: je Person und Tag, wie viele Aufgaben anstanden und erledigt wurden.

    Grundlage sind die heutigen Aufgaben-Definitionen (ab ihrem Anlegedatum) und die
    tatsächlichen Erledigungen. Flexible Aufgaben zählen am Tag ihrer Erledigung bzw. an ihrem
    Fälligkeitstag (heute auch überfällige).
    """
    family = get_family(db)
    zone = ZoneInfo(family.timezone)
    today = family_now(family).date()
    monday = monday_of(start or today)
    days = [monday + dt.timedelta(days=offset) for offset in range(7)]

    tasks = [task for task in db.scalars(select(Task).where(Task.active)) if task.assignments]
    completions = db.execute(
        select(TaskCompletion.task_id, TaskCompletion.member_id, TaskCompletion.date).where(
            TaskCompletion.date >= days[0], TaskCompletion.date <= days[-1]
        )
    ).all()
    # Erledigt je (Aufgabe, Tag): wer; bei „Einer für alle“ gilt es für alle Zugeordneten.
    done_by: dict[tuple[int, dt.date], set[int]] = {}
    for task_id, member_id, date in completions:
        done_by.setdefault((task_id, date), set()).add(member_id)
    shared = {task.id: task for task in tasks if task.shared}
    dues = {
        task_id: {entry.member_id: entry.due_date for entry in entries}
        for task_id, entries in due_dates(db, tasks, today).items()
    }

    members = list(db.scalars(select(FamilyMember).order_by(FamilyMember.id)))
    result = []
    for member in members:
        entries = []
        for day in days:
            planned: set[int] = set()
            done: set[int] = set()
            for task in tasks:
                if member.id not in (a.member_id for a in task.assignments):
                    continue
                created = task.created_at.astimezone(zone).date()
                who = done_by.get((task.id, day), set())
                is_done = member.id in who or (task.id in shared and bool(who))
                if task.recurrence.kind == "flexible":
                    due = dues.get(task.id, {}).get(member.id)
                    scheduled = due is not None and (due == day or (day == today and due < today))
                    if is_done or (day >= today and scheduled):
                        planned.add(task.id)
                elif day >= created and is_due(task, day):
                    planned.add(task.id)
                if is_done:
                    done.add(task.id)
            # Erledigungen von Aufgaben, die heute anders geplant sind, zählen trotzdem mit.
            for (task_id, date), who in done_by.items():
                if date == day and member.id in who and task_id not in shared:
                    planned.add(task_id)
                    done.add(task_id)
            entries.append(WeekDayOut(date=day, planned=len(planned), done=len(done)))
        result.append(WeekMemberOut(member_id=member.id, days=entries))

    return WeekOut(start=monday, today=today, members=result)
