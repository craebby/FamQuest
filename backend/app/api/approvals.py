from fastapi import APIRouter, status
from sqlalchemy import delete, func, select, update

from app.auth import DbSession, ParentSession
from app.errors import ApiError
from app.models import Task, TaskCompletion
from app.points import book
from app.schemas import ApprovalOut

router = APIRouter(tags=["approvals"])

# Kontrolle durch die Eltern: ungeprüfte Erledigungen bestätigen (Punkte buchen) oder ablehnen
# (Erledigung löschen, die Aufgabe ist wieder offen). Später auch per PWA am Smartphone.


@router.get("/approvals")
def list_approvals(_: ParentSession, db: DbSession) -> list[ApprovalOut]:
    """Ungeprüfte Erledigungen aller Tage, älteste zuerst."""
    completions = db.scalars(
        select(TaskCompletion)
        .where(TaskCompletion.approved_at.is_(None))
        .order_by(TaskCompletion.completed_at, TaskCompletion.id)
    )
    return [
        ApprovalOut(
            id=completion.id,
            task_id=completion.task_id,
            title=completion.task.title,
            icon=completion.task.icon,
            points=completion.points,
            member_id=completion.member_id,
            date=completion.date,
            completed_at=completion.completed_at,
        )
        for completion in completions
    ]


@router.post("/approvals/{completion_id}", status_code=status.HTTP_204_NO_CONTENT)
def approve(completion_id: int, auth_session: ParentSession, db: DbSession) -> None:
    """Bestätigt die Erledigung und bucht ihre Punkte, genau einmal (auch bei Doppel-Tipp)."""
    approved = db.execute(
        update(TaskCompletion)
        .where(TaskCompletion.id == completion_id, TaskCompletion.approved_at.is_(None))
        .values(approved_at=func.now(), approved_by_user_id=auth_session.user_id)
        .returning(
            TaskCompletion.task_id,
            TaskCompletion.member_id,
            TaskCompletion.date,
            TaskCompletion.points,
        )
    ).first()
    if approved is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "approval.not_found")
    title = db.scalar(select(Task.title).where(Task.id == approved.task_id))
    book(
        db,
        approved.member_id,
        approved.points,
        "task_completed",
        reason=title,
        task_id=approved.task_id,
        task_date=approved.date,
        user_id=auth_session.user_id,
    )
    db.commit()


@router.delete("/approvals/{completion_id}", status_code=status.HTTP_204_NO_CONTENT)
def reject(completion_id: int, _: ParentSession, db: DbSession) -> None:
    """Lehnt die Erledigung ab: Sie wird gelöscht, die Aufgabe ist wieder offen."""
    rejected = db.scalar(
        delete(TaskCompletion)
        .where(TaskCompletion.id == completion_id, TaskCompletion.approved_at.is_(None))
        .returning(TaskCompletion.id)
    )
    if rejected is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "approval.not_found")
    db.commit()
