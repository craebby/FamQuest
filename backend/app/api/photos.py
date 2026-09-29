"""Fotos für den Bilderrahmen: hochladen, ein- und ausblenden, löschen (Elternbereich)."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import exists, select

from app.auth import CurrentSession, DbSession, ParentSession
from app.demo_mode import NotInDemo
from app.errors import ApiError
from app.models import Photo
from app.photos import (
    delete_photo_files,
    parse_filename,
    photo_urls,
    process_photo,
    read_photo_upload,
    store_photo,
)

router = APIRouter(tags=["photos"])

PhotoUpload = Annotated[bytes, Depends(read_photo_upload)]


class PhotoOut(BaseModel):
    id: int
    url: str
    thumb_url: str
    width: int
    height: int
    taken_at: datetime | None
    visible: bool
    created_at: datetime


class PhotoUpdate(BaseModel):
    visible: bool


def photo_out(photo: Photo) -> PhotoOut:
    url, thumb_url = photo_urls(photo.file_key)
    return PhotoOut(
        id=photo.id,
        url=url,
        thumb_url=thumb_url,
        width=photo.width,
        height=photo.height,
        taken_at=photo.taken_at,
        visible=photo.visible,
        created_at=photo.created_at,
    )


def get_photo(db: DbSession, photo_id: int) -> Photo:
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "photo.not_found")
    return photo


@router.get("/photos")
def list_photos(_: CurrentSession, db: DbSession) -> list[PhotoOut]:
    """Alle Fotos, zuletzt hochgeladene zuerst."""
    photos = db.scalars(select(Photo).order_by(Photo.created_at.desc(), Photo.id.desc()))
    return [photo_out(photo) for photo in photos]


@router.post("/photos", status_code=status.HTTP_201_CREATED, dependencies=[NotInDemo])
def upload_photo(_: ParentSession, db: DbSession, upload: PhotoUpload) -> PhotoOut:
    """Nimmt ein Foto als Request-Body entgegen; mehrere Fotos kommen einzeln nacheinander."""
    processed = process_photo(upload)
    key = store_photo(processed)
    photo = Photo(
        file_key=key,
        width=processed.width,
        height=processed.height,
        taken_at=processed.taken_at,
    )
    db.add(photo)
    try:
        db.commit()
    except Exception:
        delete_photo_files(key)
        raise
    return photo_out(photo)


@router.patch("/photos/{photo_id}")
def update_photo(photo_id: int, body: PhotoUpdate, _: ParentSession, db: DbSession) -> PhotoOut:
    photo = get_photo(db, photo_id)
    photo.visible = body.visible
    db.commit()
    return photo_out(photo)


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(photo_id: int, _: ParentSession, db: DbSession) -> None:
    photo = get_photo(db, photo_id)
    key = photo.file_key
    db.delete(photo)
    db.commit()
    delete_photo_files(key)


@router.get("/photo-files/{filename}")
def get_photo_file(filename: str, _: CurrentSession, db: DbSession) -> FileResponse:
    parsed = parse_filename(filename)
    in_use = parsed is not None and db.scalar(select(exists().where(Photo.file_key == parsed[0])))
    if not in_use or not parsed[1].is_file():
        raise ApiError(status.HTTP_404_NOT_FOUND, "common.not_found")
    # Jede Datei bekommt einen neuen Namen, daher darf der Browser lange cachen.
    return FileResponse(
        parsed[1],
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )
