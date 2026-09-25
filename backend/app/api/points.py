from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.api.members import get_member
from app.auth import DbSession, ParentSession
from app.errors import ApiError
from app.models import PointTransaction
from app.points import balance, book, lock_member
from app.schemas import PointBookingIn, PointHistoryOut, PointTransactionOut

router = APIRouter(tags=["points"])

HISTORY_PAGE_SIZE = 50


def transaction_out(transaction: PointTransaction) -> PointTransactionOut:
    return PointTransactionOut(
        id=transaction.id,
        amount=transaction.amount,
        kind=transaction.kind,
        reason=transaction.reason,
        icon=transaction.redemption.reward_icon
        if transaction.redemption
        else transaction.task.icon
        if transaction.task
        else None,
        task_date=transaction.task_date,
        created_at=transaction.created_at,
    )


@router.get("/members/{member_id}/points")
def get_points(
    member_id: int,
    _: ParentSession,
    db: DbSession,
    before: Annotated[int | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=HISTORY_PAGE_SIZE)] = HISTORY_PAGE_SIZE,
) -> PointHistoryOut:
    """Punktestand und Buchungen einer Person, neueste zuerst."""
    get_member(db, member_id)
    query = select(PointTransaction).where(PointTransaction.member_id == member_id)
    if before is not None:
        query = query.where(PointTransaction.id < before)
    transactions = list(db.scalars(query.order_by(PointTransaction.id.desc()).limit(limit + 1)))
    return PointHistoryOut(
        total=balance(db, member_id),
        transactions=[transaction_out(t) for t in transactions[:limit]],
        has_more=len(transactions) > limit,
    )


@router.post("/members/{member_id}/points", status_code=status.HTTP_201_CREATED)
def add_points(
    member_id: int, body: PointBookingIn, auth_session: ParentSession, db: DbSession
) -> PointHistoryOut:
    """Manuelle Gutschrift oder Abzug; der Punktestand darf dabei nicht negativ werden."""
    get_member(db, member_id)
    lock_member(db, member_id)
    if body.amount < 0 and balance(db, member_id) + body.amount < 0:
        raise ApiError(status.HTTP_409_CONFLICT, "points.insufficient")
    book(db, member_id, body.amount, "manual", reason=body.reason, user_id=auth_session.user_id)
    db.commit()
    return get_points(member_id, auth_session, db)
