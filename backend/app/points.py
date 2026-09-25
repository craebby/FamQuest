"""Punktebuchungen und Punktestände. Punkte werden nur hier gebucht, nie als Zähler geändert."""

import datetime as dt

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FamilyMember, PointTransaction

TASK_KINDS = ("task_completed", "task_undone")


def book(
    db: Session,
    member_id: int,
    amount: int,
    kind: str,
    *,
    reason: str | None = None,
    task_id: int | None = None,
    task_date: dt.date | None = None,
    user_id: int | None = None,
) -> None:
    """Legt eine Buchung an; Aufgaben mit 0 Punkten erzeugen keine."""
    if amount == 0:
        return
    db.add(
        PointTransaction(
            member_id=member_id,
            amount=amount,
            kind=kind,
            reason=reason,
            task_id=task_id,
            task_date=task_date,
            created_by_user_id=user_id,
        )
    )


def lock_member(db: Session, member_id: int) -> None:
    """Sperrt die Person bis zum Commit, damit gleichzeitige Abbuchungen nacheinander prüfen."""
    db.execute(select(FamilyMember.id).where(FamilyMember.id == member_id).with_for_update())


def balance(db: Session, member_id: int) -> int:
    query = select(func.coalesce(func.sum(PointTransaction.amount), 0)).where(
        PointTransaction.member_id == member_id
    )
    return db.scalar(query) or 0


def totals(db: Session) -> dict[int, int]:
    """Punktestand je Person (nur Personen mit Buchungen)."""
    query = select(PointTransaction.member_id, func.sum(PointTransaction.amount)).group_by(
        PointTransaction.member_id
    )
    return {member_id: int(total) for member_id, total in db.execute(query)}


def earned_on(db: Session, day: dt.date) -> dict[int, int]:
    """Mit Aufgaben verdiente Punkte je Person an einem Tag der Familie."""
    query = (
        select(PointTransaction.member_id, func.sum(PointTransaction.amount))
        .where(PointTransaction.kind.in_(TASK_KINDS), PointTransaction.task_date == day)
        .group_by(PointTransaction.member_id)
    )
    return {member_id: int(total) for member_id, total in db.execute(query)}
