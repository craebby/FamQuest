import datetime as dt

from fastapi import APIRouter, status
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert

from app.api.tasks import get_task
from app.auth import CurrentSession, DbSession, get_family
from app.errors import ApiError
from app.models import FamilyMember, Task, TaskCompletion
from app.points import book, earned_on, totals
from app.recurrence import flexible_due, occurs_on
from app.schemas import MemberDueOut, MemberPointsOut, TodayOut, TodayTaskOut
from app.today import family_now, time_of_day_at

router = APIRouter(tags=["today"])

# Die Familienansicht ist für alle am Display da: Anmeldung genügt, keine Eltern-PIN.


def is_due(task: Task, day: dt.date) -> bool:
    return task.active and occurs_on(task.recurrence, day)


def assigned_only(task: Task, member_ids: list[int]) -> list[int]:
    return [m for m in member_ids if any(a.member_id == m for a in task.assignments)]


def due_dates(db: DbSession, tasks: list[Task], day: dt.date) -> dict[int, list[MemberDueOut]]:
    """Fälligkeit flexibler Aufgaben je Person, aus der letzten Erledigung vor heute."""
    flexible = [task for task in tasks if task.recurrence.kind == "flexible"]
    if not flexible:
        return {}
    last: dict[tuple[int, int], dt.date] = {
        (task_id, member_id): date
        for task_id, member_id, date in db.execute(
            select(TaskCompletion.task_id, TaskCompletion.member_id, func.max(TaskCompletion.date))
            .where(
                TaskCompletion.task_id.in_([task.id for task in flexible]),
                TaskCompletion.date < day,
            )
            .group_by(TaskCompletion.task_id, TaskCompletion.member_id)
        )
    }
    result: dict[int, list[MemberDueOut]] = {}
    for task in flexible:
        members = [a.member_id for a in task.assignments]
        if task.shared:
            # Bei „Einer für alle“ zählt die letzte Erledigung durch irgendwen.
            done = [date for (task_id, _), date in last.items() if task_id == task.id]
            due = flexible_due(task.recurrence, max(done, default=None))
            result[task.id] = [MemberDueOut(member_id=m, due_date=due) for m in members]
        else:
            result[task.id] = [
                MemberDueOut(
                    member_id=m, due_date=flexible_due(task.recurrence, last.get((task.id, m)))
                )
                for m in members
            ]
    return result


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
    pending: dict[int, list[int]] = {}
    for task_id, member_id, approved_at in db.execute(
        select(TaskCompletion.task_id, TaskCompletion.member_id, TaskCompletion.approved_at)
        .where(TaskCompletion.date == day)
        .order_by(TaskCompletion.member_id)
    ):
        done.setdefault(task_id, []).append(member_id)
        if approved_at is None:
            pending.setdefault(task_id, []).append(member_id)
    earned, total = earned_on(db, day), totals(db)
    dues = due_dates(db, tasks, day)
    week_start = day - dt.timedelta(days=day.weekday())
    week_done = {
        member_id: count
        for member_id, count in db.execute(
            select(TaskCompletion.member_id, func.count())
            .where(
                TaskCompletion.date >= week_start,
                TaskCompletion.date <= day,
                TaskCompletion.approved_at.is_not(None),
            )
            .group_by(TaskCompletion.member_id)
        )
    }

    return TodayOut(
        date=day,
        week_start=week_start,
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
                needs_approval=task.needs_approval,
                shared=task.shared,
                due_dates=dues.get(task.id, []),
                # Nur Personen, denen die Aufgabe (noch) zugeordnet ist.
                done_member_ids=assigned_only(task, done.get(task.id, [])),
                pending_member_ids=assigned_only(task, pending.get(task.id, [])),
            )
            for task in tasks
        ],
        points=[
            MemberPointsOut(
                member_id=member_id,
                today=earned.get(member_id, 0),
                total=total.get(member_id, 0),
                week_done=week_done.get(member_id, 0),
            )
            for member_id in db.scalars(select(FamilyMember.id).order_by(FamilyMember.id))
        ],
        pending_approvals=db.scalar(
            select(func.count()).where(TaskCompletion.approved_at.is_(None))
        )
        or 0,
    )


def check_completable(
    db: DbSession, task_id: int, member_id: int, date: dt.date
) -> tuple[Task, dt.date]:
    """Prüft, dass `date` heute ist und die Aufgabe heute für die Person ansteht."""
    today = family_now(get_family(db)).date()
    if date != today:
        # Das Display zeigt noch einen anderen Tag (z. B. kurz nach Mitternacht).
        raise ApiError(status.HTTP_409_CONFLICT, "completion.day_changed")
    task = get_task(db, task_id)
    assigned = any(a.member_id == member_id for a in task.assignments)
    if not assigned or not is_due(task, today):
        raise ApiError(status.HTTP_409_CONFLICT, "task.not_due")
    return task, today


@router.put("/today/tasks/{task_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def complete_task(
    task_id: int, member_id: int, date: dt.date, _: CurrentSession, db: DbSession
) -> None:
    """Markiert die Aufgabe als erledigt und bucht die Punkte.

    Ist sie schon erledigt (Doppel-Tipp), passiert nichts: Der Unique-Constraint lässt nur eine
    Erledigung je Tag zu, und nur wer sie tatsächlich anlegt, bucht Punkte. Aufgaben mit
    Elternkontrolle warten ungeprüft; ihre Punkte bucht erst die Bestätigung (api/approvals).
    """
    task, today = check_completable(db, task_id, member_id, date)
    if task.shared:
        # „Einer für alle“: Sperre auf die Aufgabe, damit gleichzeitige Tipps in verschiedenen
        # Spalten nicht zwei Erledigungen anlegen.
        db.execute(select(Task.id).where(Task.id == task_id).with_for_update())
        already = db.scalar(
            select(TaskCompletion.id).where(
                TaskCompletion.task_id == task_id, TaskCompletion.date == today
            )
        )
        if already is not None:
            db.commit()
            return
    created = db.scalar(
        insert(TaskCompletion)
        .values(
            task_id=task_id,
            member_id=member_id,
            date=today,
            points=task.points,
            approved_at=None if task.needs_approval else func.now(),
        )
        .on_conflict_do_nothing(index_elements=["task_id", "member_id", "date"])
        .returning(TaskCompletion.id)
    )
    if created is not None and not task.needs_approval:
        book(
            db,
            member_id,
            task.points,
            "task_completed",
            reason=task.title,
            task_id=task_id,
            task_date=today,
        )
    db.commit()


@router.delete("/today/tasks/{task_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def undo_task(
    task_id: int, member_id: int, date: dt.date, _: CurrentSession, db: DbSession
) -> None:
    """Macht die heutige Erledigung rückgängig und bucht ihre Punkte zurück (Gegenbuchung).

    War sie nicht erledigt, passiert nichts; war sie noch ungeprüft, gibt es nichts zurückzubuchen.
    Bei „Einer für alle“ nimmt jede zugeordnete Person die Erledigung zurück, egal wer sie war;
    die Gegenbuchung trifft die Person, die sie erledigt hatte.
    """
    task, today = check_completable(db, task_id, member_id, date)
    condition = [TaskCompletion.task_id == task_id, TaskCompletion.date == today]
    if not task.shared:
        condition.append(TaskCompletion.member_id == member_id)
    removed = db.execute(
        delete(TaskCompletion)
        .where(*condition)
        .returning(TaskCompletion.member_id, TaskCompletion.points, TaskCompletion.approved_at)
    ).all()
    # Mehrere Zeilen nur, wenn eine Aufgabe erst nachträglich auf „Einer für alle“ gestellt wurde.
    for completion in removed:
        if completion.approved_at is None:
            continue
        book(
            db,
            completion.member_id,
            -completion.points,
            "task_undone",
            reason=task.title,
            task_id=task_id,
            task_date=today,
        )
    db.commit()
