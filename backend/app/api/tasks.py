from fastapi import APIRouter, status
from sqlalchemy import func, select

from app.api.members import get_member
from app.auth import DbSession, ParentSession
from app.errors import ApiError
from app.models import Routine, RoutineStep, Task, TaskAssignment, TaskRecurrence
from app.schemas import MemberPositionOut, TaskIn, TaskOut

router = APIRouter(tags=["tasks"])


def task_out(task: Task, routine_members: set[int] | None = None) -> TaskOut:
    recurrence = task.recurrence
    return TaskOut(
        id=task.id,
        title=task.title,
        icon=task.icon,
        description=task.description or "",
        points=task.points,
        time_of_day=task.time_of_day,
        color=task.color,
        active=task.active,
        needs_approval=task.needs_approval,
        shared=task.shared,
        extra=task.extra,
        recurrence={
            "kind": recurrence.kind,
            "weekdays": recurrence.weekdays,
            "date": recurrence.date,
            "interval_days": recurrence.interval_days,
        },
        member_ids=sorted(assignment.member_id for assignment in task.assignments),
        positions=positions_out(task),
        routine_member_ids=sorted(routine_members or ()),
    )


def positions_out(task: Task) -> list[MemberPositionOut]:
    return [
        MemberPositionOut(member_id=a.member_id, position=a.position)
        for a in sorted(task.assignments, key=lambda a: a.member_id)
    ]


def routine_members(db: DbSession, task_ids: list[int] | None = None) -> dict[int, set[int]]:
    """Aufgabe → Personen, für die sie Schritt einer Routine ist."""
    query = select(RoutineStep.task_id, Routine.member_id).join(Routine)
    if task_ids is not None:
        query = query.where(RoutineStep.task_id.in_(task_ids))
    result: dict[int, set[int]] = {}
    for task_id, member_id in db.execute(query):
        result.setdefault(task_id, set()).add(member_id)
    return result


def ensure_assignment(db: DbSession, task: Task, member_id: int) -> None:
    """Ordnet die Aufgabe der Person zu, falls noch nicht geschehen (ans Ende ihrer Reihenfolge)."""
    if not any(a.member_id == member_id for a in task.assignments):
        task.assignments.append(
            TaskAssignment(member_id=member_id, position=_next_position(db, member_id))
        )


def get_task(db: DbSession, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "task.not_found")
    return task


def apply_task(db: DbSession, task: Task, body: TaskIn) -> None:
    for member_id in body.member_ids:
        get_member(db, member_id)
    in_routines = routine_members(db, [task.id]).get(task.id, set()) if task.id else set()
    if in_routines and (body.time_of_day != task.time_of_day or body.extra):
        # Routinenschritte haben den Tagesabschnitt ihrer Routine und sind keine Extras.
        raise ApiError(status.HTTP_409_CONFLICT, "task.in_routine")
    removed = in_routines - set(body.member_ids)
    if removed:
        # Wer die Aufgabe nicht mehr hat, verliert auch den Schritt in seinen Routinen.
        for step in db.scalars(
            select(RoutineStep)
            .join(Routine)
            .where(RoutineStep.task_id == task.id, Routine.member_id.in_(removed))
        ):
            db.delete(step)

    task.title, task.icon, task.points = body.title, body.icon, body.points
    task.description = body.description or None
    task.time_of_day, task.color, task.active = body.time_of_day, body.color, body.active
    task.needs_approval, task.shared, task.extra = body.needs_approval, body.shared, body.extra

    rule = body.recurrence
    if task.recurrence is None:
        task.recurrence = TaskRecurrence()
    task.recurrence.kind = rule.kind
    task.recurrence.weekdays = getattr(rule, "weekdays", None)
    task.recurrence.date = getattr(rule, "date", None)
    task.recurrence.interval_days = getattr(rule, "interval_days", None)

    # Bestehende Zuordnungen behalten, damit sie ihre Id und ihren Platz nicht wechseln;
    # neue Personen bekommen die Aufgabe ans Ende ihrer Reihenfolge.
    wanted = set(body.member_ids)
    task.assignments = [a for a in task.assignments if a.member_id in wanted] + [
        TaskAssignment(member_id=member_id, position=_next_position(db, member_id))
        for member_id in sorted(wanted - {a.member_id for a in task.assignments})
    ]


def _next_position(db: DbSession, member_id: int) -> int:
    last = db.scalar(
        select(func.max(TaskAssignment.position)).where(TaskAssignment.member_id == member_id)
    )
    return 0 if last is None else last + 1


@router.get("/tasks")
def list_tasks(_: ParentSession, db: DbSession) -> list[TaskOut]:
    tasks = db.scalars(select(Task).order_by(Task.id))
    members = routine_members(db)
    return [task_out(task, members.get(task.id)) for task in tasks]


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
def create_task(body: TaskIn, _: ParentSession, db: DbSession) -> TaskOut:
    task = Task()
    apply_task(db, task, body)
    db.add(task)
    db.commit()
    return task_out(task)


@router.put("/tasks/{task_id}")
def update_task(task_id: int, body: TaskIn, _: ParentSession, db: DbSession) -> TaskOut:
    task = get_task(db, task_id)
    apply_task(db, task, body)
    db.commit()
    return task_out(task, routine_members(db, [task.id]).get(task.id))


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, _: ParentSession, db: DbSession) -> None:
    db.delete(get_task(db, task_id))
    db.commit()
