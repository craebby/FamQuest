import datetime as dt

from fastapi import APIRouter, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.api.tasks import get_task
from app.auth import CurrentSession, DbSession, get_family
from app.errors import ApiError
from app.models import Task, TaskCompletion
from app.recurrence import occurs_on
from app.schemas import TodayOut, TodayTaskOut
from app.today import family_now, time_of_day_at

router = APIRouter(tags=["today"])

# Die Familienansicht ist für alle am Display da: Anmeldung genügt, keine Eltern-PIN.


def is_due(task: Task, day: dt.date) -> bool:
    return task.active and occurs_on(task.recurrence, day)


@router.get("/today")
def get_today(_: CurrentSession, db: DbSession) -> TodayOut:
    now = family_now(get_family(db))
    day = now.date()
    tasks = [
        task
        for task in db.scalars(select(Task).where(Task.active).order_by(Task.id))
        if is_due(task, day) and task.assignments
    ]
    done: dict[int, list[int]] = {}
    for task_id, member_id in db.execute(
        select(TaskCompletion.task_id, TaskCompletion.member_id)
        .where(TaskCompletion.date == day)
        .order_by(TaskCompletion.member_id)
    ):
        done.setdefault(task_id, []).append(member_id)

    return TodayOut(
        date=day,
        time_of_day=time_of_day_at(now.time()),
        tasks=[
            TodayTaskOut(
                id=task.id,
                title=task.title,
                icon=task.icon,
                points=task.points,
                time_of_day=task.time_of_day,
                color=task.color,
                member_ids=[a.member_id for a in task.assignments],
                # Nur Personen, denen die Aufgabe (noch) zugeordnet ist.
                done_member_ids=[
                    member_id
                    for member_id in done.get(task.id, [])
                    if any(a.member_id == member_id for a in task.assignments)
                ],
            )
            for task in tasks
        ],
    )


def check_completable(db: DbSession, task_id: int, member_id: int, date: dt.date) -> dt.date:
    """Prüft, dass `date` heute ist und die Aufgabe heute für die Person ansteht."""
    today = family_now(get_family(db)).date()
    if date != today:
        # Das Display zeigt noch einen anderen Tag (z. B. kurz nach Mitternacht).
        raise ApiError(status.HTTP_409_CONFLICT, "completion.day_changed")
    task = get_task(db, task_id)
    assigned = any(a.member_id == member_id for a in task.assignments)
    if not assigned or not is_due(task, today):
        raise ApiError(status.HTTP_409_CONFLICT, "task.not_due")
    return today


@router.put("/today/tasks/{task_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def complete_task(
    task_id: int, member_id: int, date: dt.date, _: CurrentSession, db: DbSession
) -> None:
    """Markiert die Aufgabe als erledigt; ist sie es schon (Doppel-Tipp), passiert nichts."""
    today = check_completable(db, task_id, member_id, date)
    db.execute(
        insert(TaskCompletion)
        .values(task_id=task_id, member_id=member_id, date=today)
        .on_conflict_do_nothing(index_elements=["task_id", "member_id", "date"])
    )
    db.commit()


@router.delete("/today/tasks/{task_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def undo_task(
    task_id: int, member_id: int, date: dt.date, _: CurrentSession, db: DbSession
) -> None:
    """Macht die heutige Erledigung rückgängig; war sie nicht erledigt, passiert nichts."""
    today = check_completable(db, task_id, member_id, date)
    db.execute(
        delete(TaskCompletion).where(
            TaskCompletion.task_id == task_id,
            TaskCompletion.member_id == member_id,
            TaskCompletion.date == today,
        )
    )
    db.commit()
