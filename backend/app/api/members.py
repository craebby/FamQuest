from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError

from app.auth import CurrentSession, DbSession, ParentSession
from app.avatars import (
    avatar_path,
    delete_avatar,
    process_avatar,
    read_upload,
    store_avatar,
)
from app.calendar_sync import unselect_member_calendars
from app.errors import ApiError
from app.models import FamilyMember
from app.schemas import MemberIn, MemberOrderIn, MemberOut

router = APIRouter(tags=["members"])

AvatarUpload = Annotated[bytes, Depends(read_upload)]


def member_out(member: FamilyMember) -> MemberOut:
    return MemberOut(
        id=member.id,
        name=member.name,
        role=member.role,
        color=member.color,
        avatar_url=f"/api/avatars/{member.avatar}" if member.avatar else None,
    )


def get_member(db: DbSession, member_id: int) -> FamilyMember:
    member = db.get(FamilyMember, member_id)
    if member is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "member.not_found")
    return member


def check_color_free(db: DbSession, color: str, member_id: int | None = None) -> None:
    query = select(exists().where(FamilyMember.color == color, FamilyMember.id != member_id))
    if db.scalar(query):
        raise ApiError(status.HTTP_409_CONFLICT, "member.color_taken")


def commit_member(db: DbSession) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        # Zwei gleichzeitige Anfragen mit derselben Farbe: der Unique-Constraint entscheidet.
        db.rollback()
        raise ApiError(status.HTTP_409_CONFLICT, "member.color_taken") from error


@router.get("/members")
def list_members(_: CurrentSession, db: DbSession) -> list[MemberOut]:
    members = db.scalars(select(FamilyMember).order_by(FamilyMember.position, FamilyMember.id))
    return [member_out(member) for member in members]


@router.post("/members", status_code=status.HTTP_201_CREATED)
def create_member(body: MemberIn, _: ParentSession, db: DbSession) -> MemberOut:
    check_color_free(db, body.color)
    # Neue Personen kommen ans Ende.
    last = db.scalar(select(func.max(FamilyMember.position))) or 0
    member = FamilyMember(name=body.name, role=body.role, color=body.color, position=last + 1)
    db.add(member)
    commit_member(db)
    return member_out(member)


@router.put("/members/order")
def reorder_members(body: MemberOrderIn, _: ParentSession, db: DbSession) -> list[MemberOut]:
    """Legt die Reihenfolge fest; die Liste muss jede Person genau einmal enthalten."""
    members = {member.id: member for member in db.scalars(select(FamilyMember))}
    if sorted(body.member_ids) != sorted(members):
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "member.order_invalid")
    for position, member_id in enumerate(body.member_ids, start=1):
        members[member_id].position = position
    db.commit()
    return list_members(_, db)


@router.put("/members/{member_id}")
def update_member(member_id: int, body: MemberIn, _: ParentSession, db: DbSession) -> MemberOut:
    member = get_member(db, member_id)
    check_color_free(db, body.color, member_id)
    member.name, member.role, member.color = body.name, body.role, body.color
    commit_member(db)
    return member_out(member)


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: int, _: ParentSession, db: DbSession) -> None:
    member = get_member(db, member_id)
    avatar = member.avatar
    unselect_member_calendars(db, member_id)
    db.delete(member)
    db.commit()
    delete_avatar(avatar)


@router.put("/members/{member_id}/avatar")
def upload_avatar(
    member_id: int, _: ParentSession, db: DbSession, upload: AvatarUpload
) -> MemberOut:
    """Nimmt das (im Browser zugeschnittene) Bild als Request-Body entgegen."""
    member = get_member(db, member_id)
    filename = store_avatar(process_avatar(upload))
    previous, member.avatar = member.avatar, filename
    try:
        db.commit()
    except Exception:
        delete_avatar(filename)
        raise
    delete_avatar(previous)
    return member_out(member)


@router.delete("/members/{member_id}/avatar")
def remove_avatar(member_id: int, _: ParentSession, db: DbSession) -> MemberOut:
    member = get_member(db, member_id)
    previous, member.avatar = member.avatar, None
    db.commit()
    delete_avatar(previous)
    return member_out(member)


@router.get("/avatars/{filename}")
def get_avatar(filename: str, _: CurrentSession, db: DbSession) -> FileResponse:
    path = avatar_path(filename)
    in_use = path is not None and db.scalar(select(exists().where(FamilyMember.avatar == filename)))
    if not in_use or not path.is_file():
        raise ApiError(status.HTTP_404_NOT_FOUND, "common.not_found")
    # Der Dateiname ändert sich bei jedem neuen Bild, daher darf der Browser lange cachen.
    return FileResponse(
        path,
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )
