"""Begleiter-Tier: am Display aussuchen, füttern (über erledigte Aufgaben), Zubehör kaufen.

Aussuchen, Benennen, Kaufen und Anziehen gehen ohne Eltern-PIN wie das Einlösen von
Belohnungen; den Modus je Kind und das Zurücksetzen gibt es nur im Elternbereich.
"""

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.members import get_member
from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.companions import ITEMS, SPECIES, care_days, stage_for, tricks_for
from app.errors import ApiError
from app.models import Companion, CompanionItem, FamilyMember
from app.points import balance, book, lock_member
from app.schemas import (
    CompanionIn,
    CompanionItemOut,
    CompanionModeIn,
    CompanionOut,
    CompanionsOut,
    CompanionWearIn,
)
from app.today import family_now

router = APIRouter(tags=["companions"])


def companion_out(db: DbSession, member: FamilyMember) -> CompanionOut:
    companion = db.get(Companion, member.id)
    owned = list(
        db.scalars(
            select(CompanionItem.item)
            .where(CompanionItem.member_id == member.id)
            .order_by(CompanionItem.id)
        )
    )
    days = care_days(db, companion) if companion else 0
    stage, next_stage = stage_for(days)
    tricks, next_trick = tricks_for(days)
    return CompanionOut(
        member_id=member.id,
        mode=member.companion_mode,
        species=companion.species if companion else None,
        name=(companion.name or "") if companion else "",
        stage=stage,
        care_days=days,
        next_stage_at=next_stage,
        tricks=tricks,
        next_trick_at=next_trick,
        owned=owned,
        equipped=dict(companion.equipped) if companion else {},
    )


def get_child(db: DbSession, member_id: int, *, with_companion: bool = True) -> FamilyMember:
    member = get_member(db, member_id)
    if member.role != "child":
        raise ApiError(status.HTTP_409_CONFLICT, "companion.child_only")
    if with_companion and member.companion_mode == "rewards":
        raise ApiError(status.HTTP_409_CONFLICT, "companion.disabled")
    return member


def get_companion(db: DbSession, member_id: int) -> Companion:
    companion = db.get(Companion, member_id)
    if companion is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "companion.not_found")
    return companion


@router.get("/companions")
def list_companions(_: CurrentSession, db: DbSession) -> CompanionsOut:
    """Tiere aller Kinder (auch ohne Tier oder mit ausgeschaltetem Tier) und die Auswahl."""
    children = db.scalars(
        select(FamilyMember)
        .where(FamilyMember.role == "child")
        .order_by(FamilyMember.position, FamilyMember.id)
    )
    return CompanionsOut(
        species=list(SPECIES),
        items=[
            CompanionItemOut(key=key, slot=slot, cost=cost) for key, (slot, cost) in ITEMS.items()
        ],
        companions=[companion_out(db, member) for member in children],
    )


@router.put("/members/{member_id}/companion")
def choose_companion(
    member_id: int, body: CompanionIn, _: CurrentSession, db: DbSession
) -> CompanionOut:
    """Tier einmal aussuchen; danach lässt sich nur der Name ändern."""
    member = get_child(db, member_id)
    if body.species not in SPECIES:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "companion.unknown_species")
    companion = db.get(Companion, member.id)
    if companion is None:
        companion = Companion(
            member_id=member.id,
            species=body.species,
            started_on=family_now(get_family(db)).date(),
            equipped={},
        )
        db.add(companion)
    elif companion.species != body.species:
        raise ApiError(status.HTTP_409_CONFLICT, "companion.already_chosen")
    companion.name = body.name or None
    db.commit()
    return companion_out(db, member)


@router.delete("/members/{member_id}/companion", status_code=status.HTTP_204_NO_CONTENT)
def reset_companion(member_id: int, _: ParentSession, db: DbSession) -> None:
    """Neu aussuchen lassen; gekauftes Zubehör bleibt."""
    get_child(db, member_id, with_companion=False)
    companion = db.get(Companion, member_id)
    if companion is not None:
        db.delete(companion)
        db.commit()


@router.post("/members/{member_id}/companion/items/{item}", status_code=status.HTTP_201_CREATED)
def buy_item(member_id: int, item: str, _: CurrentSession, db: DbSession) -> CompanionOut:
    """Zubehör mit Punkten kaufen und gleich anziehen; gebucht wird über PointTransaction."""
    member = get_child(db, member_id)
    companion = get_companion(db, member.id)
    if item not in ITEMS:
        raise ApiError(status.HTTP_404_NOT_FOUND, "companion.unknown_item")
    slot, cost = ITEMS[item]
    lock_member(db, member.id)
    owned = select(CompanionItem.id).where(
        CompanionItem.member_id == member.id, CompanionItem.item == item
    )
    if db.scalar(owned) is not None:
        raise ApiError(status.HTTP_409_CONFLICT, "companion.already_owned")
    if balance(db, member.id) < cost:
        raise ApiError(status.HTTP_409_CONFLICT, "companion.insufficient_points")
    db.add(CompanionItem(member_id=member.id, item=item, cost=cost))
    book(db, member.id, -cost, "companion_item", reason=item)
    companion.equipped = {**companion.equipped, slot: item}
    db.commit()
    return companion_out(db, member)


@router.put("/members/{member_id}/companion/items/{item}")
def wear_item(
    member_id: int, item: str, body: CompanionWearIn, _: CurrentSession, db: DbSession
) -> CompanionOut:
    """Gekauftes Zubehör an- oder ablegen; je Platz trägt das Tier ein Teil."""
    member = get_child(db, member_id)
    companion = get_companion(db, member.id)
    owned = select(CompanionItem.id).where(
        CompanionItem.member_id == member.id, CompanionItem.item == item
    )
    if item not in ITEMS or db.scalar(owned) is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "companion.not_owned")
    slot = ITEMS[item][0]
    equipped = dict(companion.equipped)
    if body.worn:
        equipped[slot] = item
    elif equipped.get(slot) == item:
        del equipped[slot]
    companion.equipped = equipped
    db.commit()
    return companion_out(db, member)


@router.put("/members/{member_id}/companion-mode")
def set_mode(
    member_id: int, body: CompanionModeIn, _: ParentSession, db: DbSession
) -> CompanionOut:
    """Tier und Belohnungen, nur das Tier oder nur Belohnungen."""
    member = get_child(db, member_id, with_companion=False)
    member.companion_mode = body.mode
    db.commit()
    return companion_out(db, member)
