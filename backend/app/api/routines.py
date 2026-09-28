"""Routinen im Elternbereich: je Kind und Tagesabschnitt Varianten mit Wochentagen und Schritten."""

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.members import get_member
from app.api.tasks import apply_task, ensure_assignment, get_task
from app.auth import DbSession, ParentSession
from app.errors import ApiError
from app.models import Routine, RoutineStep, Task, TaskAssignment
from app.schemas import (
    RoutineCreateIn,
    RoutineDaysIn,
    RoutineOut,
    RoutineStepAddIn,
    RoutineStepIn,
    RoutineStepOut,
    RoutineStepsIn,
)

router = APIRouter(tags=["routines"])


def routine_out(routine: Routine) -> RoutineOut:
    return RoutineOut(
        id=routine.id,
        member_id=routine.member_id,
        time_of_day=routine.time_of_day,
        weekdays=sorted(routine.weekdays),
        steps=[RoutineStepOut(task_id=s.task_id, optional=s.optional) for s in routine.steps],
    )


def get_routine(db: DbSession, routine_id: int) -> Routine:
    routine = db.get(Routine, routine_id)
    if routine is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "routine.not_found")
    return routine


def _claim_days(db: DbSession, routine: Routine, weekdays: list[int]) -> None:
    """Gibt der Routine diese Tage; andere Varianten desselben Abschnitts geben sie ab."""
    siblings = db.scalars(
        select(Routine).where(
            Routine.member_id == routine.member_id,
            Routine.time_of_day == routine.time_of_day,
            Routine.id != routine.id,
        )
    )
    for sibling in siblings:
        sibling.weekdays = [day for day in sibling.weekdays if day not in weekdays]
    routine.weekdays = sorted(weekdays)


def _check_step(routine: Routine, task: Task) -> None:
    if task.extra or task.time_of_day != routine.time_of_day:
        raise ApiError(status.HTTP_409_CONFLICT, "routine.step_invalid")


def _set_steps(db: DbSession, routine: Routine, steps: list[RoutineStepIn]) -> None:
    """Ersetzt die Schritte; Zuordnungen der Aufgaben zum Kind folgen den Routinen."""
    task_ids = [step.task_id for step in steps]
    if len(set(task_ids)) != len(task_ids):
        raise ApiError(status.HTTP_409_CONFLICT, "routine.step_invalid")
    for task_id in task_ids:
        task = get_task(db, task_id)
        _check_step(routine, task)
        ensure_assignment(db, task, routine.member_id)

    removed = {step.task_id for step in routine.steps} - set(task_ids)
    # Vorhandene Schritte weiterverwenden: Neu anlegen und Löschen in einem Zug verletzte sonst
    # die Eindeutigkeit (Routine, Aufgabe), weil SQLAlchemy zuerst einfügt.
    existing = {step.task_id: step for step in routine.steps}
    routine.steps = [
        existing.get(step.task_id) or RoutineStep(task_id=step.task_id) for step in steps
    ]
    for position, (step, wanted) in enumerate(zip(routine.steps, steps, strict=True)):
        step.position, step.optional = position, wanted.optional
    db.flush()
    _drop_unused_assignments(db, routine.member_id, removed)


def _drop_unused_assignments(db: DbSession, member_id: int, task_ids: set[int]) -> None:
    """Aufgaben in keiner Routine des Kindes mehr sind ihm auch nicht mehr zugeordnet."""
    if not task_ids:
        return
    still_used = set(
        db.scalars(
            select(RoutineStep.task_id)
            .join(Routine)
            .where(Routine.member_id == member_id, RoutineStep.task_id.in_(task_ids))
        )
    )
    for assignment in db.scalars(
        select(TaskAssignment).where(
            TaskAssignment.member_id == member_id,
            TaskAssignment.task_id.in_(task_ids - still_used),
        )
    ):
        db.delete(assignment)


@router.get("/routines")
def list_routines(_: ParentSession, db: DbSession) -> list[RoutineOut]:
    routines = db.scalars(select(Routine).order_by(Routine.member_id, Routine.id))
    return [routine_out(routine) for routine in routines]


@router.post("/routines", status_code=status.HTTP_201_CREATED)
def create_routine(body: RoutineCreateIn, _: ParentSession, db: DbSession) -> RoutineOut:
    member = get_member(db, body.member_id)
    if member.role != "child":
        raise ApiError(status.HTTP_409_CONFLICT, "routine.child_only")
    source = get_routine(db, body.copy_from) if body.copy_from is not None else None
    if source is not None and source.time_of_day != body.time_of_day:
        raise ApiError(status.HTTP_409_CONFLICT, "routine.step_invalid")

    routine = Routine(member_id=member.id, time_of_day=body.time_of_day, weekdays=[])
    db.add(routine)
    db.flush()
    _claim_days(db, routine, body.weekdays)
    if source is not None:
        _set_steps(
            db,
            routine,
            [RoutineStepIn(task_id=s.task_id, optional=s.optional) for s in source.steps],
        )
    db.commit()
    return routine_out(routine)


@router.put("/routines/{routine_id}/days")
def set_routine_days(
    routine_id: int, body: RoutineDaysIn, session: ParentSession, db: DbSession
) -> list[RoutineOut]:
    """Setzt die Wochentage; gibt alle Varianten dieses Kindes und Abschnitts zurück."""
    routine = get_routine(db, routine_id)
    _claim_days(db, routine, body.weekdays)
    db.commit()
    return list_routines(session, db)


@router.put("/routines/{routine_id}/steps")
def set_routine_steps(
    routine_id: int, body: RoutineStepsIn, _: ParentSession, db: DbSession
) -> RoutineOut:
    """Schritte in neuer Reihenfolge, mit „optional“; fehlende Schritte werden entfernt."""
    routine = get_routine(db, routine_id)
    _set_steps(db, routine, body.steps)
    db.commit()
    return routine_out(routine)


@router.post("/routines/{routine_id}/steps", status_code=status.HTTP_201_CREATED)
def add_routine_step(
    routine_id: int, body: RoutineStepAddIn, _: ParentSession, db: DbSession
) -> RoutineOut:
    routine = get_routine(db, routine_id)
    if (body.task_id is None) == (body.task is None):
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "routine.step_invalid")
    if body.task is not None:
        # Neue Aufgabe: gehört diesem Kind, in diesem Tagesabschnitt, keine Extra-Aufgabe.
        new = body.task.model_copy(
            update={
                "member_ids": [routine.member_id],
                "time_of_day": routine.time_of_day,
                "extra": False,
                "shared": False,
            }
        )
        task = Task()
        apply_task(db, task, new)
        db.add(task)
        db.flush()
        task_id = task.id
    else:
        task_id = body.task_id
    steps = [RoutineStepIn(task_id=s.task_id, optional=s.optional) for s in routine.steps]
    _set_steps(db, routine, [*steps, RoutineStepIn(task_id=task_id, optional=body.optional)])
    db.commit()
    return routine_out(routine)


@router.delete("/routines/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine(routine_id: int, _: ParentSession, db: DbSession) -> None:
    routine = get_routine(db, routine_id)
    member_id, task_ids = routine.member_id, {step.task_id for step in routine.steps}
    db.delete(routine)
    db.flush()
    _drop_unused_assignments(db, member_id, task_ids)
    db.commit()
